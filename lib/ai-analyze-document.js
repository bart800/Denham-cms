// AI-powered document analysis using OpenAI or Anthropic
// Falls back gracefully if no API key is configured

const CATEGORIES = [
  "Estimate", "Policy", "Correspondence", "Medical Records", "Photos",
  "Legal Filing", "Invoice", "Proof of Loss", "Denial Letter", "Inspection Report",
  "Pleading", "Discovery", "Settlement", "Receipts", "Client Docs", "Uncategorized"
];

const SYSTEM_PROMPT = `You are a legal document analyzer for a property damage / personal injury law firm. 
Analyze the document text and return a JSON object with:
{
  "category": one of: ${CATEGORIES.join(", ")},
  "confidence": 0.0-1.0,
  "summary": "2-3 sentence summary",
  "key_dates": [{"date": "...", "context": "..."}],
  "amounts": [{"amount": "$X,XXX.XX", "context": "..."}],
  "parties": ["name1", "name2"],
  "claim_number": "if found or null",
  "policy_number": "if found or null",
  "key_findings": ["finding1", "finding2"]
}
Only return valid JSON, no markdown.`;

export async function aiAnalyzeDocument(text, filename = "") {
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!openaiKey && !anthropicKey) {
    return { error: "no_api_key", message: "AI analysis not configured — set OPENAI_API_KEY or ANTHROPIC_API_KEY" };
  }

  // Truncate text to avoid token limits
  const truncated = text.slice(0, 12000);
  const userPrompt = `Analyze this document${filename ? ` (filename: ${filename})` : ""}:\n\n${truncated}`;

  try {
    if (openaiKey) {
      return await analyzeWithOpenAI(openaiKey, userPrompt);
    } else {
      return await analyzeWithAnthropic(anthropicKey, userPrompt);
    }
  } catch (err) {
    console.error("AI analysis error:", err);
    return { error: "ai_error", message: err.message };
  }
}

async function analyzeWithOpenAI(apiKey, userPrompt) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 1000,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "";
  return parseAIResponse(content);
}

async function analyzeWithAnthropic(apiKey, userPrompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const content = data.content?.[0]?.text || "";
  return parseAIResponse(content);
}

function parseAIResponse(content) {
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return { ...JSON.parse(jsonMatch[0]), ai_powered: true };
    }
    return { error: "parse_error", message: "Could not parse AI response", raw: content };
  } catch (e) {
    return { error: "parse_error", message: e.message, raw: content };
  }
}
