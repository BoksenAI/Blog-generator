export async function generateImageMetadata({
    images,
    blogContext,
    aiProvider,
    apiKey,
    masterPrompt,
}) {
    const imageList = images.map((img, index) => ({
        index,
        image_url: img.image_url,
    }));

    const prompt = `
${masterPrompt}

Blog context:
${blogContext}

Images:
${JSON.stringify(imageList, null, 2)}
`;

    const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.2,
                max_tokens: 1000,
            }),
        }
    );

    const data = await response.json();

    if (!response.ok) {
        console.error("Groq API Error in image metadata:", data);
        // Return empty metadata or throw specifically
        return [];
    }

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error("Unexpected Groq response format:", data);
        return [];
    }

    try {
        return JSON.parse(data.choices[0].message.content);
    } catch (e) {
        console.error("Failed to parse metadata JSON:", data.choices[0].message.content);
        return [];
    }
}