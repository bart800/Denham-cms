import { supabaseAdmin, supabase as supabaseAnon } from "../../../../lib/supabase";
import { NextResponse } from "next/server";

const db = supabaseAdmin || supabaseAnon;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get("unread") === "true";
  const limit = parseInt(searchParams.get("limit") || "50");

  let query = db
    .from("notifications")
    .select("*, cases(ref, client_name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (unreadOnly) query = query.eq("is_read", false);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Also generate real-time SOL warnings
  const { data: solCases } = await db
    .from("cases")
    .select("id, ref, client_name, statute_of_limitations, status")
    .not("statute_of_limitations", "is", null)
    .not("status", "in", '("Settled","Closed")')
    .order("statute_of_limitations", { ascending: true });

  const now = new Date();
  const solAlerts = (solCases || [])
    .map(c => {
      const sol = new Date(c.statute_of_limitations + "T00:00:00");
      const days = Math.ceil((sol - now) / 86400000);
      if (days > 90 || days < -30) return null;
      return {
        id: `sol-${c.id}`,
        case_id: c.id,
        type: "sol_warning",
        severity: days < 30 ? "critical" : "warning",
        title: `SOL: ${days} days — ${c.ref}`,
        description: `${c.client_name} — statute expires ${c.statute_of_limitations}`,
        is_read: false,
        created_at: now.toISOString(),
        cases: { ref: c.ref, client_name: c.client_name },
        is_live: true,
      };
    })
    .filter(Boolean);

  // Merge: live SOL alerts + stored notifications
  const all = [...solAlerts, ...(data || [])];

  const unreadCount = all.filter(n => !n.is_read).length;

  return NextResponse.json({ notifications: all, unreadCount });
}

// Mark as read
export async function PATCH(request) {
  try {
    const { ids, markAll } = await request.json();

    if (markAll) {
      await db.from("notifications").update({ is_read: true, read_at: new Date().toISOString() }).eq("is_read", false);
    } else if (ids?.length) {
      // Filter out live SOL alerts (they start with "sol-")
      const dbIds = ids.filter(id => !id.startsWith("sol-"));
      if (dbIds.length) {
        await db.from("notifications").update({ is_read: true, read_at: new Date().toISOString() }).in("id", dbIds);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Create notification
export async function POST(request) {
  try {
    const body = await request.json();
    const { data, error } = await db.from("notifications").insert({
      case_id: body.case_id || null,
      type: body.type || "info",
      severity: body.severity || "info",
      title: body.title,
      description: body.description,
      metadata: body.metadata || {},
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
