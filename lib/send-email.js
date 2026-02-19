// Send email via Microsoft Graph API using client credentials or refresh token
export async function sendEmail({ to, subject, htmlBody }) {
  const clientId = process.env.MS_GRAPH_CLIENT_ID;
  const tenantId = process.env.MS_GRAPH_TENANT_ID;
  const refreshToken = process.env.MS_GRAPH_REFRESH_TOKEN;
  const clientSecret = process.env.MS_GRAPH_CLIENT_SECRET;

  if (!clientId || !tenantId || !refreshToken) {
    throw new Error("MS Graph credentials not configured");
  }

  // Get access token via refresh token
  const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: "https://graph.microsoft.com/.default",
      ...(clientSecret ? { client_secret: clientSecret } : {}),
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error("Failed to get access token: " + (tokenData.error_description || tokenData.error || "unknown"));
  }

  // Send email via Graph API
  const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
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
    throw new Error(`Graph sendMail failed (${res.status}): ${err}`);
  }

  return true;
}
