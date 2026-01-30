const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.0-flash";

export async function runGeminiFactCheck(prompt) {
  if (!GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000); // 15s timeout

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `
You are a factual verification assistant.
Only return verified facts.
Do not write marketing language.
Do not write a blog.
Do not add opinions.

Task:
${prompt}
                `.trim(),
              },
            ],
          },
        ],
      }),
    },
  );

  clearTimeout(timeout);

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini error: ${errText}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}
