import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const includeDocUrls = searchParams.get("include_doc_urls") === "true";
  const docCategories = searchParams.get("doc_categories")?.split(",").map(c => c.trim());

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  try {
    // Fetch all data in parallel
    const [
      caseRes,
      claimRes,
      estimatesRes,
      negotiationsRes,
      docsRes,
      notesRes,
      emailsRes,
      discoveryRes,
      activityRes,
    ] = await Promise.all([
      // Case with attorney info
      supabaseAdmin
        .from("cases")
        .select(`
          *,
          attorney:team_members!cases_attorney_id_fkey(id, name, email, title),
          support:team_members!cases_support_id_fkey(id, name, email, title)
        `)
        .eq("id", id)
        .single(),

      // Claim details
      supabaseAdmin
        .from("claim_details")
        .select("*")
        .eq("case_id", id)
        .maybeSingle(),

      // Estimates
      supabaseAdmin
        .from("estimates")
        .select("*")
        .eq("case_id", id)
        .order("date", { ascending: true }),

      // Negotiations
      supabaseAdmin
        .from("negotiations")
        .select("*")
        .eq("case_id", id)
        .order("date", { ascending: true }),

      // Documents
      (() => {
        let q = supabaseAdmin
          .from("documents")
          .select("id, case_id, name, category, file_type, file_size, storage_path, ai_summary, extracted_text_length, created_at, modified_at")
          .eq("case_id", id)
          .order("category", { ascending: true })
          .order("modified_at", { ascending: false });
        if (docCategories?.length) {
          q = q.in("category", docCategories);
        }
        return q;
      })(),

      // Notes
      supabaseAdmin
        .from("case_notes")
        .select("*, author:team_members!case_notes_author_id_fkey(id, name)")
        .eq("case_id", id)
        .order("created_at", { ascending: false }),

      // Emails (50 most recent)
      supabaseAdmin
        .from("case_emails")
        .select("id, case_id, subject, from_address, to_address, received_at, body_preview, has_attachments")
        .eq("case_id", id)
        .order("received_at", { ascending: false })
        .limit(50),

      // Discovery sets with item counts
      supabaseAdmin
        .from("discovery_sets")
        .select("*, discovery_items(id)")
        .eq("case_id", id)
        .order("created_at", { ascending: false }),

      // Activity log (50 most recent)
      supabaseAdmin
        .from("activity_log")
        .select("*")
        .eq("case_id", id)
        .order("date", { ascending: false })
        .limit(50),
    ]);

    // Check for case not found
    if (caseRes.error) {
      if (caseRes.error.code === "PGRST116") {
        return NextResponse.json({ error: "Case not found" }, { status: 404 });
      }
      throw caseRes.error;
    }

    const caseData = caseRes.data;
    const estimates = estimatesRes.data || [];
    const negotiations = negotiationsRes.data || [];

    // Compute damages summary
    const highestEstimate = estimates.length
      ? estimates.reduce((max, e) => (parseFloat(e.amount) || 0) > (parseFloat(max.amount) || 0) ? e : max, estimates[0])
      : null;

    const insurerEstimates = estimates.filter(e =>
      e.type?.toLowerCase().includes("insurer") || e.type?.toLowerCase().includes("carrier") || e.type?.toLowerCase().includes("insurance")
    );
    const independentEstimates = estimates.filter(e =>
      !e.type?.toLowerCase().includes("insurer") && !e.type?.toLowerCase().includes("carrier") && !e.type?.toLowerCase().includes("insurance")
    );

    const avgIndependent = independentEstimates.length
      ? independentEstimates.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0) / independentEstimates.length
      : null;

    const lastOffer = negotiations.filter(n => n.type?.toLowerCase().includes("offer")).slice(-1)[0] || null;
    const lastDemand = negotiations.filter(n => n.type?.toLowerCase().includes("demand")).slice(-1)[0] || null;

    // Claim type heuristic
    let claimTypeHeuristic = "unknown";
    if (caseData.claim_type) {
      claimTypeHeuristic = caseData.claim_type.toLowerCase();
    } else if (lastOffer && (parseFloat(lastOffer.amount) || 0) === 0) {
      claimTypeHeuristic = "denial";
    } else if (lastOffer && highestEstimate && (parseFloat(lastOffer.amount) || 0) < (parseFloat(highestEstimate.amount) || 0) * 0.8) {
      claimTypeHeuristic = "underpayment";
    }

    // Group documents by category
    const docs = docsRes.data || [];
    const documentsByCategory = {};
    for (const doc of docs) {
      const cat = doc.category || "Uncategorized";
      if (!documentsByCategory[cat]) documentsByCategory[cat] = [];
      documentsByCategory[cat].push(doc);
    }

    // Generate signed URLs if requested
    if (includeDocUrls) {
      for (const doc of docs) {
        if (doc.storage_path) {
          const { data: urlData } = await supabaseAdmin.storage
            .from("case-documents")
            .createSignedUrl(doc.storage_path, 3600); // 1hr expiry
          doc.download_url = urlData?.signedUrl || null;
        }
      }
    }

    // Discovery sets with item counts
    const discovery = (discoveryRes.data || []).map(s => ({
      ...s,
      item_count: (s.discovery_items || []).length,
      discovery_items: undefined,
    }));

    // Build case object (clean up for demand writer)
    const casePacket = {
      client_name: caseData.client_name,
      client_email: caseData.client_email,
      client_phone: caseData.client_phone,
      insurer: caseData.insurer,
      claim_number: caseData.claim_number,
      policy_number: caseData.policy_number,
      date_of_loss: caseData.date_of_loss,
      date_opened: caseData.date_opened,
      cause_of_loss: caseData.cause_of_loss,
      property_address: caseData.property_address,
      status: caseData.status,
      phase: caseData.phase,
      claim_type: caseData.claim_type,
      jurisdiction: caseData.jurisdiction,
      attorney: caseData.attorney,
      support: caseData.support,
    };

    const claimDetails = claimRes.data || null;

    const damagesSummary = {
      highest_estimate: highestEstimate ? { source: highestEstimate.source, type: highestEstimate.type, amount: highestEstimate.amount } : null,
      insurer_estimate: insurerEstimates.length ? { source: insurerEstimates[0].source, amount: insurerEstimates[0].amount } : null,
      independent_avg: avgIndependent,
      last_offer: lastOffer ? { amount: lastOffer.amount, date: lastOffer.date, notes: lastOffer.notes } : null,
      last_demand: lastDemand ? { amount: lastDemand.amount, date: lastDemand.date, notes: lastDemand.notes } : null,
      claim_type_heuristic: claimTypeHeuristic,
    };

    return NextResponse.json({
      _meta: {
        case_id: id,
        generated_at: new Date().toISOString(),
        doc_categories_filter: docCategories || null,
        include_doc_urls: includeDocUrls,
      },
      case: casePacket,
      claim_details: claimDetails,
      damages_summary: damagesSummary,
      estimates: estimates,
      negotiations: negotiations,
      documents: documentsByCategory,
      notes: (notesRes.data || []).map(n => ({
        id: n.id,
        content: n.content,
        pinned: n.pinned,
        author: n.author,
        created_at: n.created_at,
      })),
      emails: emailsRes.data || [],
      discovery: discovery,
      timeline: (activityRes.data || []).map(a => ({
        id: a.id,
        type: a.type,
        description: a.description,
        date: a.date,
        metadata: a.metadata,
      })),
    });
  } catch (err) {
    console.error("Demand packet error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
