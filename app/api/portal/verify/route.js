import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://amyttoowrroajffqubpd.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey) : null;

export async function POST(request) {
  try {
    if (!supabase) return Response.json({ error: "Server configuration error" }, { status: 500 });

    const { ref, code, rememberMe } = await request.json();
    if (!ref || !code) return Response.json({ error: "Reference and code are required" }, { status: 400 });

    // Find case by ref
    const { data: cases } = await supabase.from("cases").select("id").ilike("ref", ref.trim());
    if (!cases || cases.length === 0) return Response.json({ error: "Invalid reference" }, { status: 404 });

    const caseId = cases[0].id;

    // Find matching session
    const { data: sessions } = await supabase
      .from("portal_sessions")
      .select("*")
      .eq("case_id", caseId)
      .eq("code", code.trim())
      .is("token", null)
      .gt("code_expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1);

    if (!sessions || sessions.length === 0) {
      return Response.json({ error: "Invalid or expired code. Please request a new one." }, { status: 401 });
    }

    // Generate token, update session — 30 days if remember me, 24 hours otherwise
    const token = crypto.randomBytes(32).toString("hex");
    const durationMs = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const tokenExpiresAt = new Date(Date.now() + durationMs).toISOString();

    await supabase.from("portal_sessions").update({
      token,
      token_expires_at: tokenExpiresAt,
      code: null,
      code_expires_at: null,
    }).eq("id", sessions[0].id);

    return Response.json({ success: true, token });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
