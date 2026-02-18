import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://amyttoowrroajffqubpd.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey) : null;

export async function POST(request) {
  try {
    if (!supabase) return Response.json({ error: "Server configuration error" }, { status: 500 });

    const { ref, lastName } = await request.json();
    if (!ref || !lastName) return Response.json({ error: "Case reference and last name are required" }, { status: 400 });

    // Look up case
    const { data: cases, error } = await supabase
      .from("cases")
      .select("id, client_name, ref")
      .ilike("ref", ref.trim())
      .ilike("client_name", `%${lastName.trim()}%`);

    if (error) return Response.json({ error: error.message }, { status: 500 });
    if (!cases || cases.length === 0) {
      return Response.json({ error: "No case found. Please check your reference number and last name." }, { status: 404 });
    }

    const c = cases[0];
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

    // Upsert session - delete old pending sessions for this case first
    await supabase.from("portal_sessions").delete().eq("case_id", c.id).is("token", null);

    const { error: insertErr } = await supabase.from("portal_sessions").insert({
      case_id: c.id,
      client_name: c.client_name,
      code,
      code_expires_at: codeExpiresAt,
    });

    if (insertErr) return Response.json({ error: insertErr.message }, { status: 500 });

    // Log code to console (will be emailed/texted later)
    console.log(`[Portal Auth] Code for ${c.client_name} (${c.ref}): ${code}`);

    return Response.json({ success: true, message: "Verification code sent. Check your email or phone.", ref: c.ref });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
