// Send email via Maton's Microsoft Graph proxy (uses existing MATON_API_KEY)
export async function sendEmail({ to, subject, htmlBody }) {
  const apiKey = process.env.MATON_API_KEY;
  if (!apiKey) throw new Error("MATON_API_KEY not configured");

  const res = await fetch("https://gateway.maton.ai/outlook/v1.0/me/sendMail", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: "HTML", content: htmlBody },
        toRecipients: [{ emailAddress: { address: to } }],
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Email send failed (${res.status}): ${err}`);
  }

  return true;
}
