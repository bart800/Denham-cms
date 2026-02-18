import { supabaseAdmin, supabase } from "../../../../../lib/supabase";

const BUCKET = "documents";

/**
 * GET /api/cases/[id]/demand-packet
 *
 * Returns a comprehensive data package for demand letter generation.
 * Used by the Demand Writer app to import case data from the CMS.
 *
 * Query params:
 *   include_doc_urls=true  — generate signed download URLs for documents (slower)
 *   doc_categories=Estimates,Correspondence  — filter document categories (comma-separated)
 */
export async function GET(request, { params }) {
  const client = supabaseAdmin || supabase;
  if (!client) return Response.json({ error: "No Supabase client" }, { status: 500 });

  const { id } = await params;
  if (!id) return Response.json({ error: "Case ID required" }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const includeDocUrls = searchParams.get("include_doc_urls") === "true";
  const docCategoryFilter = searchParams.get("doc_categories")?.split(",").map(s => s.trim()).filter(Boolean);

  try {
    // Fetch case with related data in parallel
    const [
      caseResult,
      claimResult,
      litigationResult,
      estimatesResult,
      negotiationsResult,
      notesResult,
      docsResult,
      activityResult,
      discoveryResult,
      emailsResult,
    ] = await Promise.all([
      client.from("cases").select("*, team_members!cases_attorney_id_fkey(name, email, title), support:team_members!cases_support_id_fkey(name, email, title)").eq("id", id).single(),
      client.from("claim_details").select("*").eq("case_id", id).maybeSingle(),
      client.from("litigation_details").select("*").eq("case_id", id).maybeSingle(),
      client.from("estimates").select("*").eq("case_id", id).order("date", { ascending: false }),
      client.from("negotiations").select("*").eq("case_id", id).order("date", { ascending: true }),
      client.from("case_notes").select("*, author:team_members!case_notes_author_id_fkey(name)").eq("case_id", id).order("created_at", { ascending: false }),
      buildDocQuery(client, id, docCategoryFilter),
      client.from("activity_log").select("*").eq("case_id", id).order("created_at", { ascending: false }).limit(100),
      client.from("discovery_sets").select("*, discovery_items(*)").eq("case_id", id).order("served_date", { ascending: false }),
      client.from("case_emails").select("id, subject, from_address, to_address, direction, received_at, body_text").eq("case_id", id).order("received_at", { ascending: false }).limit(50),
    ]);

    if (caseResult.error) {
      return Response.json({ error: "Case not found" }, { status: 404 });
    }

    const c = caseResult.data;
    const claim = claimResult.data;
    const litigation = litigationResult.data;
    const estimates = estimatesResult.data || [];
    const negotiations = negotiationsResult.data || [];
    const notes = notesResult.data || [];
    const docs = docsResult.data || [];
    const activity = activityResult.data || [];
    const discovery = discoveryResult.data || [];
    const emails = emailsResult.data || [];

    // Generate signed URLs for documents if requested
    let docsWithUrls = docs;
    if (includeDocUrls && docs.length > 0) {
      docsWithUrls = await Promise.all(
        docs.map(async (doc) => {
          if (!doc.storage_path) return { ...doc, download_url: null };
          const { data: urlData } = await client.storage
            .from(BUCKET)
            .createSignedUrl(doc.storage_path, 3600);
          return { ...doc, download_url: urlData?.signedUrl || null };
        })
      );
    }

    // Compute damage summary
    const highestEstimate = estimates.reduce((max, e) => Math.max(max, Number(e.amount) || 0), 0);
    const insurerEstimate = estimates.find(e => (e.source || "").toLowerCase().includes("insur") || (e.type || "").toLowerCase().includes("insur"));
    const independentEstimates = estimates.filter(e => !(e.source || "").toLowerCase().includes("insur"));
    const lastOffer = [...negotiations].reverse().find(n => n.type === "offer");
    const lastDemand = [...negotiations].reverse().find(n => n.type === "demand");

    // Determine claim type heuristic
    let claimType = null;
    if (c.status?.toLowerCase().includes("denial") || claim?.claim_type?.toLowerCase().includes("denial")) {
      claimType = "denial";
    } else if (lastOffer && highestEstimate > 0 && Number(lastOffer.amount) < highestEstimate * 0.7) {
      claimType = "underpayment";
    } else if (!lastOffer && negotiations.length === 0) {
      claimType = "delay";
    }

    // Group documents by category
    const docsByCategory = {};
    for (const doc of docsWithUrls) {
      const cat = doc.category || "Uncategorized";
      if (!docsByCategory[cat]) docsByCategory[cat] = [];
      docsByCategory[cat].push({
        id: doc.id,
        filename: doc.filename,
        extension: doc.extension,
        category: cat,
        size_bytes: doc.size_bytes,
        mime_type: doc.mime_type,
        modified_at: doc.modified_at,
        download_url: doc.download_url || null,
        ai_summary: doc.ai_summary || null,
        ai_extracted_text: doc.ai_extracted_text || null,
        doc_type: doc.doc_type || null,
      });
    }

    // Build the packet
    const packet = {
      _meta: {
        version: "1.0",
        generated_at: new Date().toISOString(),
        source: "denham-cms",
        case_id: id,
      },

      case: {
        id: c.id,
        ref: c.ref,
        client_name: c.client_name,
        client_phone: c.client_phone,
        client_email: c.client_email,
        type: c.type,
        status: c.status,
        jurisdiction: c.jurisdiction,
        date_of_loss: c.date_of_loss,
        date_opened: c.date_opened,
        statute_of_limitations: c.statute_of_limitations,
        insurer: c.insurer,
        claim_number: c.claim_number,
        policy_number: c.policy_number,
        property_address: c.property_address,
        cause_of_loss: c.cause_of_loss,
        adjuster_name: c.adjuster_name,
        adjuster_phone: c.adjuster_phone,
        adjuster_email: c.adjuster_email,
        total_recovery: c.total_recovery,
        attorney_fees: c.attorney_fees,
        attorney: c.team_members ? { name: c.team_members.name, email: c.team_members.email, title: c.team_members.title } : null,
        support: c.support ? { name: c.support.name, email: c.support.email, title: c.support.title } : null,
      },

      claim_details: claim ? {
        property_damage: claim.property_damage,
        medical_expenses: claim.medical_expenses,
        lost_wages: claim.lost_wages,
        other_damages: claim.other_damages,
        non_economic_damages: claim.non_economic_damages,
      } : null,

      litigation: litigation || null,

      damages_summary: {
        highest_estimate: highestEstimate || null,
        insurer_estimate: insurerEstimate ? Number(insurerEstimate.amount) : null,
        independent_estimates_avg: independentEstimates.length > 0
          ? independentEstimates.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) / independentEstimates.length
          : null,
        last_demand: lastDemand ? { amount: Number(lastDemand.amount), date: lastDemand.date } : null,
        last_offer: lastOffer ? { amount: Number(lastOffer.amount), date: lastOffer.date } : null,
        claim_type: claimType,
      },

      estimates: estimates.map(e => ({
        id: e.id,
        type: e.type,
        source: e.source,
        amount: Number(e.amount),
        date: e.date,
        notes: e.notes,
      })),

      negotiations: negotiations.map(n => ({
        id: n.id,
        type: n.type,
        amount: Number(n.amount),
        date: n.date,
        notes: n.notes,
      })),

      documents: {
        total: docsWithUrls.length,
        by_category: docsByCategory,
      },

      notes: notes.map(n => ({
        id: n.id,
        content: n.content,
        pinned: n.pinned,
        author: n.author?.name || null,
        created_at: n.created_at,
      })),

      emails: emails.map(e => ({
        id: e.id,
        subject: e.subject,
        from: e.from_address,
        to: e.to_address,
        direction: e.direction,
        received_at: e.received_at,
        body_preview: e.body_text ? e.body_text.slice(0, 500) : null,
      })),

      discovery: discovery.map(d => ({
        id: d.id,
        type: d.type,
        direction: d.direction,
        title: d.title,
        status: d.status,
        served_date: d.served_date,
        due_date: d.due_date,
        items_count: d.discovery_items?.length || 0,
      })),

      timeline: activity.slice(0, 50).map(a => ({
        type: a.type,
        description: a.description,
        created_at: a.created_at,
      })),
    };

    return Response.json(packet);
  } catch (err) {
    console.error("[demand-packet] error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

async function buildDocQuery(client, caseId, categoryFilter) {
  let q = client
    .from("documents")
    .select("id, storage_path, filename, extension, category, size_bytes, mime_type, modified_at, ai_summary, ai_extracted_text, doc_type")
    .eq("case_id", caseId)
    .order("category")
    .order("filename");

  if (categoryFilter && categoryFilter.length > 0) {
    q = q.in("category", categoryFilter);
  }

  // Cap at 500 docs to keep response manageable
  q = q.limit(500);

  return q;
}
