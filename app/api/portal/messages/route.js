import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://amyttoowrroajffqubpd.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey) : null;

// Helper: validate portal token and return session
async function validateToken(request) {
  const token = request.headers.get("x-portal-token");
  if (!token) return null;
  const { data } = await supabase
    .from("portal_sessions")
    .select("case_id, client_name")
    .eq("token", token)
    .gt("token_expires_at", new Date().toISOString())
    .limit(1);
  return data?.[0] || null;
}

export async function GET(request) {
  try {
    if (!supabase) return Response.json({ error: "Server configuration error" }, { status: 500 });

    const session = await validateToken(request);
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // Mark unread firm messages as read
    await supabase.from("portal_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("case_id", session.case_id)
      .eq("sender_type", "firm")
      .is("read_at", null);

    const { data, error } = await supabase
      .from("portal_messages")
      .select("id, sender_type, message, created_at, read_at")
      .eq("case_id", session.case_id)
      .order("created_at", { ascending: true });

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ messages: data || [] });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    if (!supabase) return Response.json({ error: "Server configuration error" }, { status: 500 });

    const session = await validateToken(request);
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { message } = await request.json();
    if (!message?.trim()) return Response.json({ error: "Message is required" }, { status: 400 });

    const { data, error } = await supabase.from("portal_messages").insert({
      case_id: session.case_id,
      sender_type: "client",
      message: message.trim(),
    }).select("id, sender_type, message, created_at, read_at").single();

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ message: data });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
