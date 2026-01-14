
export async function generateImageMetadata({
    images,
    blogContext,
    aiProvider,
    apiKey,
    masterPrompt,
}) {
    // Construct the user message content array
    // Start with the text prompt
    const content = [
        {
            type: "text",
            text: `${masterPrompt}\n\nBlog context:\n${blogContext}\n\nInstructions: Analyze the provided images and generate metadata (file_name, title_tag, alt_text) for each. \n- PRIORITIZE VISUAL DETAILS: Describe exactly what you see in the image.\n- Do NOT assume the style or cuisine solely based on the 'Venue Name' (e.g. 'Tokyo' does not automatically mean 'Japanese style' if the image shows modern industrial decor).\n- Return ONLY a JSON array with objects containing 'id' (from input) and the generated fields.`,
        },
    ];

    images.forEach((img, index) => {
        content.push({
            type: "text",
            text: `\nImage ID: ${img.id} (Section: ${img.section}):\n`,
        });

        if (img.is_base64 && img.image_url) {
            content.push({
                type: "image_url",
                image_url: {
                    url: img.image_url, // This is the data:image/png;base64,... string
                },
            });
        } else {
            content.push({
                type: "text",
                text: `[Image URL/Placeholder: ${img.image_url}] (Analyze based on filename context)`,
            });
        }
    });

    const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "meta-llama/llama-4-scout-17b-16e-instruct", // Correct full ID from Groq API list
                messages: [{ role: "user", content: content }],
                temperature: 0.2,
                max_tokens: 2048,
                response_format: { type: "json_object" }, // Enforce JSON
            }),
        }
    );

    const data = await response.json();

    if (!response.ok) {
        console.error("Groq API Error in image metadata:", data);
        return [];
    }

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error("Unexpected Groq response format:", data);
        return [];
    }

    try {
        const parsed = JSON.parse(data.choices[0].message.content);
        // Handle if it returns { "images": [...] } or just [...]
        return Array.isArray(parsed) ? parsed : (parsed.images || []);
    } catch (e) {
        console.error("Failed to parse metadata JSON:", data.choices[0].message.content);
        return [];
    }
}
