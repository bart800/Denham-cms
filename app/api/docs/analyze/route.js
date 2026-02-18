import { supabaseAdmin, supabase } from "../../../../lib/supabase";
import { NextResponse } from "next/server";

// --- Rule-based text analysis helpers ---

function extractDollarAmounts(text) {
  const pattern = /\$\s?[\d,]+(?:\.\d{2})?/g;
  const matches = text.match(pattern) || [];
  return [...new Set(matches.map(m => m.replace(/\s/g, "")))];
}

function extractDates(text) {
  const patterns = [
    /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
    /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi,
    /\b\d{1,2}-\d{1,2}-\d{2,4}\b/g,
  ];
  const dates = [];
  for (const p of patterns) {
    const m = text.match(p) || [];
    dates.push(...m);
  }
  return [...new Set(dates)];
}

function extractNames(text) {
  const patterns = [
    /(?:Dear|Attn:?|Attention:?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/g,
    /(?:From|To|Adjuster|Insured|Claimant|Contractor|Plaintiff|Defendant|Attorney):?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/g,
    /(?:Sincerely|Regards),?\s*\n\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/g,
  ];
  const names = [];
  for (const p of patterns) {
    let m;
    while ((m = p.exec(text)) !== null) {
      names.push(m[1].trim());
    }
  }
  return [...new Set(names)];
}

function detectDocType(text) {
  const lower = text.toLowerCase();
  const denialWords = ["denied", "not covered", "exclusion", "decline", "insufficient", "denial", "we regret"];
  const estimateWords = ["estimate", "scope of work", "line item", "total cost", "contractor", "repair cost"];
  const policyWords = ["policy number", "coverage", "deductible", "premium", "endorsement", "declarations"];
  const pleadingWords = ["plaintiff", "defendant", "court", "complaint", "motion", "filed", "circuit court"];
  const correspondenceWords = ["dear", "sincerely", "regards", "thank you for your"];

  const score = (words) => words.filter(w => lower.includes(w)).length;

  const scores = {
    "denial_letter": score(denialWords),
    "estimate": score(estimateWords),
    "policy": score(policyWords),
    "pleading": score(pleadingWords),
    "correspondence": score(correspondenceWords),
  };

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (best[1] === 0) return "unknown";
  return best[0];
}

function extractDenialInfo(text) {
  const lower = text.toLowerCase();
  const reasons = [];
  const denialPatterns = [
    /(?:denied|denial|not covered|excluded|decline[ds]?)\s+(?:because|due to|based on|as|for)\s+([^.]+)\./gi,
    /reason\s+(?:for|of)\s+(?:denial|declining)[:\s]+([^.]+)\./gi,
    /(?:exclusion|provision)\s+(?:\w+\s+){0,3}(?:states?|provides?|reads?)[:\s]+([^.]+)\./gi,
  ];
  for (const p of denialPatterns) {
    let m;
    while ((m = p.exec(text)) !== null) {
      reasons.push(m[1].trim());
    }
  }

  const provisions = [];
  const provPatterns = [
    /(?:section|provision|paragraph|article|exclusion)\s+[\d.]+[a-z]?(?:\([a-z0-9]+\))?/gi,
    /(?:policy\s+)?(?:provision|condition|exclusion)\s+[A-Z][\w.-]+/g,
  ];
  for (const p of provPatterns) {
    const m = text.match(p) || [];
    provisions.push(...m);
  }

  return {
    denial_reasons: reasons.length ? reasons : ["Specific reason not extracted — review document manually"],
    policy_provisions_cited: [...new Set(provisions)],
  };
}

function extractEstimateInfo(text) {
  const amounts = extractDollarAmounts(text);
  const sorted = amounts.map(a => parseFloat(a.replace(/[$,]/g, ""))).sort((a, b) => b - a);
  const lineItemMatch = text.match(/(\d+)\s+(?:line items?|items?)/i);
  const contractorMatch = text.match(/(?:Contractor|Prepared by|Company)[:\s]+([A-Z][^\n,]+)/i);

  return {
    total_amount: sorted.length ? `$${sorted[0].toLocaleString("en-US", { minimumFractionDigits: 2 })}` : null,
    line_items_count: lineItemMatch ? parseInt(lineItemMatch[1]) : null,
    contractor_name: contractorMatch ? contractorMatch[1].trim() : null,
  };
}

function generateSummary(text, docType) {
  const sentences = text.replace(/\n/g, " ").split(/(?<=[.!?])\s+/).filter(s => s.length > 20);
  const first = sentences.slice(0, 3).join(" ");
  const truncated = first.length > 300 ? first.slice(0, 297) + "..." : first;
  const typeLabel = docType.replace(/_/g, " ");
  return `This document appears to be a ${typeLabel}. ${truncated}`;
}

function analyzeText(text) {
  const docType = detectDocType(text);
  const amounts = extractDollarAmounts(text);
  const dates = extractDates(text);
  const parties = extractNames(text);
  const summary = generateSummary(text, docType);

  const analysis = {
    doc_type: docType,
    summary,
    dates,
    amounts,
    parties,
    action_items: [],
  };

  // Action items based on type
  if (docType === "denial_letter") {
    analysis.denial_info = extractDenialInfo(text);
    analysis.action_items.push("Review denial reason and policy provisions", "Consider filing appeal or demand letter", "Check statute of limitations for bad faith claim");
  } else if (docType === "estimate") {
    analysis.estimate_info = extractEstimateInfo(text);
    analysis.action_items.push("Compare with insurer's estimate", "Verify scope of work completeness", "Check for supplemental items needed");
  } else if (docType === "policy") {
    analysis.action_items.push("Review coverage limits and exclusions", "Check endorsements for additional coverage", "Note deductible amount");
  } else if (docType === "pleading") {
    analysis.action_items.push("Review deadlines for response", "Identify causes of action", "Check jurisdiction and venue");
  }

  if (amounts.length === 0 && dates.length === 0 && parties.length === 0) {
    analysis.flags = ["Low text extraction — document may be scanned/image-based. OCR may be needed."];
  }

  analysis.analyzed_at = new Date().toISOString();
  return analysis;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { document_id, storage_path, text } = body;
    const db = supabaseAdmin || supabase;

    let content = text || "";
    let docRecord = null;

    // Fetch document from Supabase if document_id provided
    if (document_id && db) {
      const { data: doc, error } = await db.from("documents").select("*").eq("id", document_id).single();
      if (error) return NextResponse.json({ error: "Document not found" }, { status: 404 });
      docRecord = doc;

      if (!content) {
        const path = storage_path || doc.storage_path;
        if (path) {
          const { data: fileData, error: dlError } = await db.storage.from("documents").download(path);
          if (!dlError && fileData) {
            const ext = (doc.extension || "").toLowerCase();
            if ([".txt", ".csv", ".html", ".htm", ".xml", ".json", ".md"].includes(ext)) {
              content = await fileData.text();
            } else if (ext === ".pdf") {
              // Try reading as text — works for text-based PDFs
              const raw = await fileData.text();
              // Basic PDF text extraction: grab readable strings
              content = raw.replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s{3,}/g, "\n").trim();
              if (content.length < 50) {
                content = "";
              }
            } else {
              return NextResponse.json({
                error: "Unsupported file type for text extraction",
                detail: `Extension: ${ext}. Images and scanned PDFs require OCR which is not available.`,
                doc: docRecord,
              }, { status: 422 });
            }
          }
        }
      }
    }

    if (!content || content.trim().length < 10) {
      return NextResponse.json({
        error: "No text content to analyze",
        detail: "Provide text directly, or ensure the document contains extractable text.",
        doc: docRecord,
      }, { status: 422 });
    }

    const analysis = analyzeText(content);

    // Store analysis back to document record if we have a document_id
    if (document_id && db) {
      await db.from("documents").update({
        analysis,
        doc_type: analysis.doc_type,
      }).eq("id", document_id);
    }

    return NextResponse.json({ analysis, document_id: document_id || null });
  } catch (err) {
    console.error("Document analysis error:", err);
    return NextResponse.json({ error: "Analysis failed", detail: err.message }, { status: 500 });
  }
}
