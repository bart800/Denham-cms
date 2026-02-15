export async function POST(req) {
  try {
    const { prompt } = await req.json();
    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json({ text: "Error: ANTHROPIC_API_KEY not set in Vercel environment variables." }, { status: 500 });
    }
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await resp.json();
    if (data.error) {
      return Response.json({ text: "API Error: " + (data.error.message || JSON.stringify(data.error)) }, { status: 400 });
    }
    const text = data.content?.map(b => b.text || "").join("\n") || "No response generated.";
    return Response.json({ text });
  } catch (e) {
    return Response.json({ text: "Error: " + e.message }, { status: 500 });
  }
}
