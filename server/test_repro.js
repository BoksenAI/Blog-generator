
// Mock environment
const process = { env: { GROQ_API_KEY: "key" } };
const aiProvider = "groq";
const genAI = {};
const prompt = "prompt";

async function test() {
    try {
        if (aiProvider === "groq" && process.env.GROQ_API_KEY) {
            // ...
        } else if (genAI) {
            // Fallback to Gemini
            const model = genAI.getGenerativeModel({ model: "gemini-pro" });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            // Line 226 approx
            blogContent = response.text();
        } else {
            throw new Error(
                "No AI provider configured. Please set GEMINI_API_KEY, GROQ_API_KEY, or HUGGINGFACE_API_KEY"
            );
        }
    } catch (providerError) {
        // ...
    }
}
