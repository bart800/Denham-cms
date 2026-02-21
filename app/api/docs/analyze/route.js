import { supabaseAdmin, supabase } from "../../../../lib/supabase";
import { aiAnalyzeDocument } from "../../../../lib/ai-analyze-document";
import { NextResponse } from "next/server";

const db = supabaseAdmin || supabase;

// ─── PDF Text Extraction ──────────────────────────────────
async function extractTextFromPdf(buffer) {
  try {
    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
    const result = await pdfParse(buffer);
    return result.text || "";
  } catch (err) {
    console.error("PDF parse error:", err.message);
    // Fallback: strip binary, grab readable strings
    const raw = buffer.toString("utf-8");
    const cleaned = raw.replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s{3,}/g, "\n").trim();
    return cleaned.length > 50 ? cleaned : "";
  }
}

async function extractTextFromDocument(doc) {
  if (!doc.storage_path) return "";
  const { data: fileData, error } = await db.storage.from("documents").download(doc.storage_path);
  if (error || !fileData) return "";

  const ext = (doc.extension || "").toLowerCase().replace(/^\./, "");

  if (["txt", "csv", "html", "htm", "xml", "json", "md"].includes(ext)) {
    return await fileData.text();
  }

  if (ext === "pdf") {
    const arrayBuf = await fileData.arrayBuffer();
    return await extractTextFromPdf(Buffer.from(arrayBuf));
  }

  return "";
}

// ─── Pattern Extraction Helpers ───────────────────────────

function extractDollarAmounts(text) {
  const pattern = /\$\s?[\d,]+(?:\.\d{2})?/g;
  const matches = text.match(pattern) || [];
  return [...new Set(matches.map(m => m.replace(/\s/g, "")))];
}

function parseDollar(str) {
  if (!str) return null;
  return parseFloat(str.replace(/[$,\s]/g, "")) || null;
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

// ─── Insurance-Specific Extraction ────────────────────────

function extractPolicyNumber(text) {
  const patterns = [
    /policy\s*(?:#|no\.?|number)?\s*[:.]?\s*([A-Z0-9][\w-]{4,20})/i,
    /(?:policy|pol)\s*#?\s*[:.]?\s*([A-Z0-9][\w-]{4,20})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return null;
}

function extractClaimNumber(text) {
  const patterns = [
    /claim\s*(?:#|no\.?|number)?\s*[:.]?\s*([A-Z0-9][\w-]{4,20})/i,
    /(?:file|reference)\s*(?:#|no\.?|number)?\s*[:.]?\s*([A-Z0-9][\w-]{4,20})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return null;
}

function extractInsuranceCompany(text) {
  const known = [
    "State Farm", "Allstate", "USAA", "Liberty Mutual", "Nationwide", "Travelers",
    "Progressive", "Erie", "QBE", "Citizens", "Farmers", "American Family", "Auto-Owners",
    "Auto Owners", "Cincinnati Financial", "Westfield", "Shelter", "Kentucky Farm Bureau",
    "KFB", "Farm Bureau", "Homesite", "Safeco", "Foremost", "Grange", "Encova",
    "Church Mutual", "Countryway", "American Bankers", "American Reliable",
    "Brotherhood Mutual", "Sedgwick", "West Bend", "Stillwater", "Mercury",
    "Guide One", "Peninsula", "Hartford", "Chubb", "Amica", "GEICO",
    "MetLife", "Zurich", "AIG", "Berkshire Hathaway",
  ];
  const lower = text.toLowerCase();
  for (const ins of known) {
    if (lower.includes(ins.toLowerCase())) return ins;
  }
  // Try letterhead pattern
  const m = text.match(/^([A-Z][A-Za-z &]+(?:Insurance|Mutual|Indemnity|Casualty|Fire)[A-Za-z &]*)/m);
  return m ? m[1].trim() : null;
}

function extractPropertyAddress(text) {
  // Common address patterns
  const patterns = [
    /(?:property\s+address|insured\s+(?:property|location)|loss\s+(?:location|address)|premises)[:\s]+([^\n]{10,80})/i,
    /(?:located\s+at|property\s+at)[:\s]+([^\n]{10,80})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const addr = m[1].trim().replace(/[.;,]$/, "");
      if (/\d/.test(addr) && addr.length > 10) return addr;
    }
  }
  // Try standalone address: number + street + city + state + zip
  const addrMatch = text.match(/\b(\d{1,6}\s+[A-Z][a-z]+(?:\s+[A-Za-z]+){1,4},?\s+[A-Z]{2}\s+\d{5}(?:-\d{4})?)\b/);
  return addrMatch ? addrMatch[1] : null;
}

function extractAdjusterInfo(text) {
  const info = { name: null, phone: null, email: null };

  const namePatterns = [
    /adjuster[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/i,
    /(?:your\s+adjuster|claims?\s+(?:adjuster|examiner|representative))[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/i,
  ];
  for (const p of namePatterns) {
    const m = text.match(p);
    if (m) { info.name = m[1].trim(); break; }
  }

  // Phone near "adjuster" context
  const phoneMatch = text.match(/(?:adjuster|examiner|representative)[\s\S]{0,200}?(\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4})/i);
  if (phoneMatch) info.phone = phoneMatch[1];

  // Email near adjuster context or any email
  const emailMatch = text.match(/(?:adjuster|examiner|representative)[\s\S]{0,200}?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (emailMatch) info.email = emailMatch[1];
  if (!info.email) {
    const anyEmail = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (anyEmail) info.email = anyEmail[1];
  }

  return (info.name || info.phone || info.email) ? info : null;
}

function extractKeyDates(text, allDates) {
  const result = {};

  // Date of loss
  const dolPatterns = [
    /(?:date\s+of\s+loss|loss\s+date|DOL)[:\s]+([^\n,;]{6,30})/i,
    /(?:loss\s+occurred|damage\s+occurred)\s+(?:on\s+)?([^\n,;]{6,30})/i,
  ];
  for (const p of dolPatterns) {
    const m = text.match(p);
    if (m) { result.date_of_loss = m[1].trim(); break; }
  }

  // Denial date
  const denialDatePatterns = [
    /(?:denial\s+date|date\s+of\s+denial|denied\s+on)[:\s]+([^\n,;]{6,30})/i,
    /(?:this\s+letter\s+(?:is\s+to\s+)?(?:inform|notify|advise)[\s\S]{0,50}?)(\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b)/i,
  ];
  for (const p of denialDatePatterns) {
    const m = text.match(p);
    if (m) { result.denial_date = m[1].trim(); break; }
  }

  // Inspection dates
  const inspPatterns = [
    /(?:inspection|inspected|inspect)\s+(?:date|on|scheduled)[:\s]+([^\n,;]{6,30})/i,
  ];
  for (const p of inspPatterns) {
    const m = text.match(p);
    if (m) { result.inspection_date = m[1].trim(); break; }
  }

  // Policy period
  const periodMatch = text.match(/(?:policy\s+period|effective)[:\s]+([^\n]{10,60})/i);
  if (periodMatch) result.policy_period = periodMatch[1].trim();

  return result;
}

function extractDenialInfo(text) {
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
  const sorted = amounts.map(a => parseDollar(a)).filter(Boolean).sort((a, b) => b - a);
  const lineItemMatch = text.match(/(\d+)\s+(?:line items?|items?)/i);
  const contractorMatch = text.match(/(?:Contractor|Prepared by|Company)[:\s]+([A-Z][^\n,]+)/i);

  return {
    total_amount: sorted[0] || null,
    all_amounts: sorted.slice(0, 10),
    line_items_count: lineItemMatch ? parseInt(lineItemMatch[1]) : null,
    contractor_name: contractorMatch ? contractorMatch[1].trim() : null,
  };
}

function extractCoverageAmounts(text) {
  const coverage = {};
  const patterns = [
    [/(?:dwelling|coverage\s*a)[:\s]*\$?([\d,]+(?:\.\d{2})?)/i, "dwelling"],
    [/(?:other\s+structures?|coverage\s*b)[:\s]*\$?([\d,]+(?:\.\d{2})?)/i, "other_structures"],
    [/(?:personal\s+property|contents|coverage\s*c)[:\s]*\$?([\d,]+(?:\.\d{2})?)/i, "contents"],
    [/(?:loss\s+of\s+use|additional\s+living|coverage\s*d|ALE)[:\s]*\$?([\d,]+(?:\.\d{2})?)/i, "loss_of_use"],
    [/(?:deductible)[:\s]*\$?([\d,]+(?:\.\d{2})?)/i, "deductible"],
  ];
  for (const [p, key] of patterns) {
    const m = text.match(p);
    if (m) coverage[key] = parseDollar(m[1]);
  }
  return Object.keys(coverage).length ? coverage : null;
}

// ─── Document Type Detection ──────────────────────────────

function detectDocType(text) {
  const lower = text.toLowerCase();
  const scoring = {
    denial_letter: ["denied", "not covered", "exclusion", "decline", "denial", "we regret", "coverage determination", "unable to provide coverage"],
    estimate: ["estimate", "scope of work", "line item", "total cost", "contractor", "repair cost", "xactimate", "replacement cost"],
    policy: ["policy number", "coverage", "deductible", "premium", "endorsement", "declarations", "named insured", "policy period"],
    pleading: ["plaintiff", "defendant", "court", "complaint", "motion", "filed", "circuit court", "cause of action"],
    correspondence: ["dear", "sincerely", "regards", "thank you for your", "please contact", "we have received"],
    inspection_report: ["inspection", "site visit", "observed", "findings", "condition of", "photographs"],
    proof_of_loss: ["proof of loss", "sworn statement", "notarized", "under oath"],
  };

  const scores = {};
  for (const [type, words] of Object.entries(scoring)) {
    scores[type] = words.filter(w => lower.includes(w)).length;
  }

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best[1] === 0 ? "unknown" : best[0];
}

// ─── Summary Generation ───────────────────────────────────

function generateSummary(text, docType, metadata) {
  const typeLabel = docType.replace(/_/g, " ");
  const parts = [`This document is a ${typeLabel}.`];

  if (metadata.insurance_company) parts.push(`Insurer: ${metadata.insurance_company}.`);
  if (metadata.policy_number) parts.push(`Policy #${metadata.policy_number}.`);
  if (metadata.claim_number) parts.push(`Claim #${metadata.claim_number}.`);

  if (docType === "denial_letter" && metadata.denial_info?.denial_reasons?.[0]) {
    const reason = metadata.denial_info.denial_reasons[0];
    if (!reason.includes("not extracted")) parts.push(`Denial reason: ${reason}.`);
  }
  if (docType === "estimate" && metadata.estimate_info?.total_amount) {
    parts.push(`Total estimate: $${metadata.estimate_info.total_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}.`);
  }
  if (metadata.property_address) parts.push(`Property: ${metadata.property_address}.`);

  // First meaningful sentences as fallback content
  const sentences = text.replace(/\n/g, " ").split(/(?<=[.!?])\s+/).filter(s => s.length > 20);
  const excerpt = sentences.slice(0, 2).join(" ");
  if (excerpt && parts.length < 4) {
    const truncated = excerpt.length > 200 ? excerpt.slice(0, 197) + "..." : excerpt;
    parts.push(truncated);
  }

  return parts.join(" ").slice(0, 500);
}

// ─── Main Analysis Pipeline ───────────────────────────────

function analyzeText(text) {
  const docType = detectDocType(text);
  const amounts = extractDollarAmounts(text);
  const dates = extractDates(text);
  const parties = extractNames(text);
  const policyNumber = extractPolicyNumber(text);
  const claimNumber = extractClaimNumber(text);
  const insuranceCompany = extractInsuranceCompany(text);
  const propertyAddress = extractPropertyAddress(text);
  const adjuster = extractAdjusterInfo(text);
  const keyDates = extractKeyDates(text, dates);
  const coverageAmounts = extractCoverageAmounts(text);

  const metadata = {
    doc_type: docType,
    policy_number: policyNumber,
    claim_number: claimNumber,
    insurance_company: insuranceCompany,
    property_address: propertyAddress,
    adjuster,
    dates: { all: dates, key: keyDates },
    amounts: {
      all: amounts,
      parsed: amounts.map(a => parseDollar(a)).filter(Boolean).sort((a, b) => b - a),
    },
    parties,
    coverage: coverageAmounts,
    action_items: [],
  };

  // Type-specific analysis
  if (docType === "denial_letter") {
    metadata.denial_info = extractDenialInfo(text);
    metadata.action_items.push(
      "Review denial reason and policy provisions",
      "Consider filing appeal or demand letter",
      "Check statute of limitations for bad faith claim",
    );
  } else if (docType === "estimate") {
    metadata.estimate_info = extractEstimateInfo(text);
    metadata.action_items.push(
      "Compare with insurer's estimate",
      "Verify scope of work completeness",
      "Check for supplemental items needed",
    );
  } else if (docType === "policy") {
    metadata.action_items.push(
      "Review coverage limits and exclusions",
      "Check endorsements for additional coverage",
      "Note deductible amount and policy period",
    );
  } else if (docType === "pleading") {
    metadata.action_items.push(
      "Review deadlines for response",
      "Identify causes of action",
      "Check jurisdiction and venue",
    );
  } else if (docType === "correspondence") {
    metadata.action_items.push(
      "Note any deadlines or action items",
      "Track adjuster communications",
    );
  }

  if (amounts.length === 0 && dates.length === 0 && parties.length === 0) {
    metadata.flags = ["Low text extraction — document may be scanned/image-based. OCR may be needed."];
  }

  const summary = generateSummary(text, docType, metadata);

  return { docType, summary, metadata, extractedText: text };
}

// ─── Update claim_details with extracted info ─────────────

async function updateClaimDetails(caseId, metadata) {
  if (!caseId || !db) return;

  const { data: existing } = await db
    .from("claim_details")
    .select("*")
    .eq("case_id", caseId)
    .single();

  if (!existing) return;

  const updates = {};

  // Only fill in missing fields
  if (!existing.policy_number && metadata.policy_number)
    updates.policy_number = metadata.policy_number;
  if (!existing.claim_number && metadata.claim_number)
    updates.claim_number = metadata.claim_number;
  if (!existing.adjuster_name && metadata.adjuster?.name)
    updates.adjuster_name = metadata.adjuster.name;
  if (!existing.adjuster_phone && metadata.adjuster?.phone)
    updates.adjuster_phone = metadata.adjuster.phone;
  if (!existing.adjuster_email && metadata.adjuster?.email)
    updates.adjuster_email = metadata.adjuster.email;
  if (!existing.property_address && metadata.property_address)
    updates.property_address = metadata.property_address;
  if (!existing.date_denied && metadata.dates?.key?.denial_date)
    updates.date_denied = metadata.dates.key.denial_date;

  // Coverage amounts from policy declarations
  if (metadata.coverage) {
    if (!existing.coverage_dwelling && metadata.coverage.dwelling)
      updates.coverage_dwelling = metadata.coverage.dwelling;
    if (!existing.coverage_other_structure && metadata.coverage.other_structures)
      updates.coverage_other_structure = metadata.coverage.other_structures;
    if (!existing.coverage_contents && metadata.coverage.contents)
      updates.coverage_contents = metadata.coverage.contents;
    if (!existing.coverage_ale && metadata.coverage.loss_of_use)
      updates.coverage_ale = metadata.coverage.loss_of_use;
    if (!existing.deductible && metadata.coverage.deductible)
      updates.deductible = metadata.coverage.deductible;
  }

  // Policy limits (largest coverage amount)
  if (!existing.policy_limits && metadata.coverage?.dwelling)
    updates.policy_limits = metadata.coverage.dwelling;

  if (Object.keys(updates).length > 0) {
    updates.updated_at = new Date().toISOString();
    const { error } = await db.from("claim_details").update(updates).eq("case_id", caseId);
    if (error) console.error("claim_details update error:", error.message);
    return updates;
  }
  return null;
}

// ─── POST Handler ─────────────────────────────────────────

export async function POST(request) {
  try {
    const body = await request.json();
    const { document_id, storage_path, text } = body;

    if (!db) return NextResponse.json({ error: "No database client" }, { status: 500 });

    let content = text || "";
    let docRecord = null;

    // Fetch document from Supabase if document_id provided
    if (document_id) {
      const { data: doc, error } = await db
        .from("documents")
        .select("*")
        .eq("id", document_id)
        .single();

      if (error) return NextResponse.json({ error: "Document not found" }, { status: 404 });
      docRecord = doc;

      // Mark as processing
      await db.from("documents").update({ ai_status: "processing" }).eq("id", document_id);

      if (!content) {
        content = await extractTextFromDocument(doc);
      }
    }

    if (!content || content.trim().length < 10) {
      if (document_id) {
        await db.from("documents").update({
          ai_status: "failed",
          ai_metadata: { error: "No extractable text content" },
        }).eq("id", document_id);
      }
      return NextResponse.json({
        error: "No text content to analyze",
        detail: "Document may be scanned/image-based and require OCR.",
        doc: docRecord,
      }, { status: 422 });
    }

    const { docType, summary, metadata, extractedText } = analyzeText(content);

    // Run AI analysis in parallel (non-blocking, enhances results)
    let aiResult = null;
    try {
      aiResult = await aiAnalyzeDocument(content, docRecord?.filename || "");
      if (aiResult && !aiResult.error) {
        // Merge AI results — AI category overrides pattern if confident
        if (aiResult.category && aiResult.confidence > 0.7) {
          metadata.ai_category = aiResult.category;
          metadata.ai_confidence = aiResult.confidence;
        }
        if (aiResult.summary) metadata.ai_summary = aiResult.summary;
        if (aiResult.key_findings) metadata.ai_key_findings = aiResult.key_findings;
        if (aiResult.key_dates?.length) metadata.ai_dates = aiResult.key_dates;
        if (aiResult.amounts?.length) metadata.ai_amounts = aiResult.amounts;
        metadata.ai_powered = true;
      }
    } catch (aiErr) {
      console.log("AI analysis skipped:", aiErr.message);
    }

    // Store analysis back to document record
    if (document_id) {
      const updatePayload = {
        ai_status: "completed",
        ai_extracted_text: extractedText.slice(0, 50000), // Cap at 50k chars
        ai_summary: aiResult?.summary || summary,
        ai_metadata: metadata,
        ai_category: aiResult?.category || null,
        extracted_text: extractedText.slice(0, 50000),
        analyzed_at: new Date().toISOString(),
        analysis: metadata, // Keep backward compat
        doc_type: docType,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await db
        .from("documents")
        .update(updatePayload)
        .eq("id", document_id);

      if (updateError) console.error("Document update error:", updateError.message);

      // Update claim_details with any missing info
      if (docRecord?.case_id) {
        const claimUpdates = await updateClaimDetails(docRecord.case_id, metadata);
        if (claimUpdates) {
          metadata.claim_details_updated = claimUpdates;
        }
      }
    }

    return NextResponse.json({
      success: true,
      document_id: document_id || null,
      doc_type: docType,
      summary,
      metadata,
    });
  } catch (err) {
    console.error("Document analysis error:", err);
    return NextResponse.json({ error: "Analysis failed", detail: err.message }, { status: 500 });
  }
}
