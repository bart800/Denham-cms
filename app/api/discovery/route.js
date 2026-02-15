export async function POST(req) {
  try {
    const { prompt } = await req.json();
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await resp.json();
    const text = data.content?.map(b => b.text || "").join("\n") || "Error generating response.";
    return Response.json({ text });
  } catch (e) {
    return Response.json({ text: "Error: " + e.message }, { status: 500 });
  }
}
