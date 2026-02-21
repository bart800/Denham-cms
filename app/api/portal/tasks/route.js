import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://amyttoowrroajffqubpd.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey) : null;

// Client-safe task types — only show these to clients
const CLIENT_SAFE_TYPES = ["deadline", "appointment", "document", "milestone"];
const CLIENT_SAFE_KEYWORDS = [
  "mediation", "deposition", "trial", "hearing", "appointment", "inspection",
  "upload", "provide", "submit", "send", "review", "sign", "meeting",
];

export async function GET(request) {
  try {
    if (!supabase) return Response.json({ error: "Server error" }, { status: 500 });

    const token = request.headers.get("x-portal-token");
    if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: sessions } = await supabase
      .from("portal_sessions")
      .select("case_id")
      .eq("token", token)
      .gt("token_expires_at", new Date().toISOString())
      .limit(1);

    if (!sessions?.length) return Response.json({ error: "Session expired" }, { status: 401 });

    const caseId = sessions[0].case_id;
    const url = new URL(request.url);
    const qCaseId = url.searchParams.get("caseId");
    if (qCaseId && qCaseId !== caseId) return Response.json({ error: "Unauthorized" }, { status: 403 });

    // Fetch tasks for this case
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, description, type, due_date, status, client_visible")
      .eq("case_id", caseId)
      .in("status", ["pending", "in_progress", "upcoming"])
      .order("due_date", { ascending: true })
      .limit(10);

    // Filter to client-safe tasks only
    const safeTasks = (tasks || []).filter(t => {
      if (t.client_visible === true) return true;
      if (t.client_visible === false) return false;
      // Auto-filter: show if type is safe or title contains safe keywords
      if (CLIENT_SAFE_TYPES.includes(t.type)) return true;
      const title = (t.title || "").toLowerCase();
      return CLIENT_SAFE_KEYWORDS.some(kw => title.includes(kw));
    });

    return Response.json({ tasks: safeTasks });
  } catch (e) {
    return Response.json({ error: "Failed to load tasks" }, { status: 500 });
  }
}
