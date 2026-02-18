import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://amyttoowrroajffqubpd.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, serviceKey || anonKey);

const MATON_API_KEY = process.env.MATON_API_KEY;

async function sendCodeEmail(toEmail, clientName, code, caseRef) {
  if (!MATON_API_KEY) {
    console.warn("[Portal Auth] No MATON_API_KEY — skipping email, code logged to console only");
    return false;
  }

  const subject = `Your Denham Law verification code: ${code}`;
  const body = {
    contentType: "HTML",
    content: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <div style="background: #000066; color: #fff; padding: 20px 24px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 20px; letter-spacing: 1px;">DENHAM LAW</h1>
          <p style="margin: 4px 0 0; font-size: 12px; opacity: 0.7;">Client Portal</p>
        </div>
        <div style="background: #f8f8f8; padding: 24px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="margin: 0 0 16px; font-size: 15px; color: #333;">Hi ${clientName.split(",")[0].split(" ")[0]},</p>
          <p style="margin: 0 0 16px; font-size: 14px; color: #555;">Your verification code for case <strong>${caseRef}</strong> is:</p>
          <div style="background: #000066; color: #ebb003; font-size: 32px; font-weight: 800; letter-spacing: 8px; text-align: center; padding: 16px; border-radius: 8px; margin: 0 0 16px;">
            ${code}
          </div>
          <p style="margin: 0 0 8px; font-size: 13px; color: #888;">This code expires in 10 minutes.</p>
          <p style="margin: 0; font-size: 13px; color: #888;">If you didn't request this, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
          <p style="margin: 0; font-size: 11px; color: #aaa; text-align: center;">
            Denham Law · 859-900-BART · <a href="https://denham.law" style="color: #000066;">denham.law</a>
          </p>
        </div>
      </div>
    `,
  };

  try {
    const resp = await fetch("https://gateway.maton.ai/outlook/v1.0/me/sendMail", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MATON_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject,
          body,
          toRecipients: [{ emailAddress: { address: toEmail, name: clientName } }],
        },
      }),
    });

    if (resp.ok || resp.status === 202) {
      console.log(`[Portal Auth] Code emailed to ${toEmail} for ${caseRef}`);
      return true;
    } else {
      const errText = await resp.text().catch(() => "");
      console.error(`[Portal Auth] Email failed (${resp.status}): ${errText}`);
      return false;
    }
  } catch (err) {
    console.error("[Portal Auth] Email error:", err.message);
    return false;
  }
}

export async function POST(request) {
  try {
    if (!supabase) return Response.json({ error: "Server configuration error" }, { status: 500 });

    const { ref, lastName } = await request.json();
    if (!ref || !lastName) return Response.json({ error: "Case reference and last name are required" }, { status: 400 });

    // Look up case with client email
    const { data: cases, error } = await supabase
      .from("cases")
      .select("id, client_name, client_email, ref")
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

    // Send code via email if client has email on file
    let emailSent = false;
    if (c.client_email) {
      emailSent = await sendCodeEmail(c.client_email, c.client_name, code, c.ref);
    }

    // Always log to console as fallback
    console.log(`[Portal Auth] Code for ${c.client_name} (${c.ref}): ${code}`);

    // Mask email for response
    const maskedEmail = c.client_email
      ? c.client_email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + "*".repeat(Math.min(b.length, 6)) + c)
      : null;

    return Response.json({
      success: true,
      message: emailSent
        ? `Verification code sent to ${maskedEmail}`
        : "Verification code generated. Please contact the office if you don't receive it.",
      ref: c.ref,
      emailSent,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
