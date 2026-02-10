const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-3-flash-preview";

async function fetchWithRetry(url, options, maxRetries = 3) {
  let delay = 1000; // Start with 1 second delay

  for (let i = 0; i <= maxRetries; i++) {
    try {
      const response = await fetch(url, options);

      // If we hit a rate limit (429), wait and retry
      if (response.status === 429) {
        if (i === maxRetries)
          throw new Error("Rate limit exhausted after retries.");

        console.warn(
          `Rate limited. Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`,
        );
        await new Promise((res) => setTimeout(res, delay));
        delay *= 2; // Exponential backoff (1s, 2s, 4s...)
        continue;
      }

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini error: ${errText}`);
      }

      return await response.json();
    } catch (err) {
      if (i === maxRetries) throw err;
      // Also retry on network timeouts/errors
      await new Promise((res) => setTimeout(res, delay));
      delay *= 2;
    }
  }
}

export async function runGeminiFactCheck(prompt) {
  if (!GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `
You are a fact-checking and research assistant.

Your task:
- Research the venue using generally available public knowledge.
- Verify factual details such as name, address, neighborhood, cuisine, and reputation.
- If information is widely known, include it.
- If something truly cannot be verified, explicitly mark it as "Unknown".

Return concise, factual bullet points only.
Do NOT add opinions or marketing language.

Venue context:
${prompt}
`,
          },
        ],
      },
    ],
  };

  const data = await fetchWithRetry(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}
