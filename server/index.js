import "dotenv/config";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from "./supabaseClient.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Helper function to insert blog content into Supabase
async function getMasterPromptByVenue(venue) {
  const { data, error } = await supabase
    .from("master_prompts")
    .select("prompt")
    .eq("venue", venue)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(`No master prompt found for venue: ${venue}`);
  }

  return data.prompt;
}

// Initialize AI providers
const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

// Debug endpoint to list available models
app.get("/api/list-models", async (req, res) => {
  try {
    // Try using the REST API directly to list models
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
    );
    const data = await response.json();

    if (data.models) {
      const availableModels = data.models
        .filter(
          (m) =>
            m.supportedGenerationMethods &&
            m.supportedGenerationMethods.includes("generateContent")
        )
        .map((m) => ({
          name: m.name,
          displayName: m.displayName,
          supportedMethods: m.supportedGenerationMethods,
        }));

      res.json({
        success: true,
        availableModels,
        allModels: data.models.map((m) => m.name),
      });
    } else {
      res.json({ success: false, error: data, raw: data });
    }
  } catch (error) {
    console.error("Error listing models:", error);
    res.status(500).json({
      error: "Failed to list models",
      message: error.message,
    });
  }
});

// Blog generation endpoint
app.post("/api/generate-blog", async (req, res) => {
  try {
    const {
      venueName,
      targetMonth,
      weekOfMonth,
      creator,
      draftTopic,
      specialInstructions,
    } = req.body;

    if (!venueName || !targetMonth || !weekOfMonth || !creator || !draftTopic) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Create the prompt for Gemini
    const masterPrompt = await getMasterPromptByVenue("blog_generation");

    const prompt = `
    ${masterPrompt}

    Venue Name: ${venueName}
    Target Month: ${targetMonth}
    Week of Month: ${weekOfMonth}
    Creator: ${creator}
    Draft Topic: ${draftTopic}
    ${specialInstructions ? `Special Instructions: ${specialInstructions}` : ""}
    `;

    let blogContent;
    //const aiProvider = process.env.AI_PROVIDER || 'gemini'; // Options: 'gemini', 'groq', 'huggingface'
    const aiProvider = "groq";
    try {
      if (aiProvider === "groq" && process.env.GROQ_API_KEY) {
        // Use Groq API (fast and free)
        const groqResponse = await fetch(
          "https://api.groq.com/openai/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "llama-3.1-8b-instant", // Common models: 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'llama-3.1-70b-versatile'
              messages: [
                {
                  role: "user",
                  content: prompt,
                },
              ],
              temperature: 0.7,
              max_tokens: 2048, // Reduced from 4096 as some models have lower limits
            }),
          }
        );

        if (!groqResponse.ok) {
          const errorData = await groqResponse
            .json()
            .catch(() => ({ error: "Unknown error" }));
          console.error("Groq API error details:", errorData);
          throw new Error(
            `Groq API error: ${groqResponse.status} - ${JSON.stringify(
              errorData
            )}`
          );
        }

        const groqData = await groqResponse.json();
        blogContent = groqData.choices[0].message.content;
      } else if (genAI) {
        // Fallback to Gemini
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        blogContent = response.text();
      } else {
        throw new Error(
          "No AI provider configured. Please set GEMINI_API_KEY, GROQ_API_KEY, or HUGGINGFACE_API_KEY"
        );
      }
    } catch (providerError) {
      // If primary provider fails, try fallback
      if (aiProvider !== "gemini" && genAI) {
        console.log(
          "Primary provider failed, trying Gemini fallback...",
          providerError.message
        );
        try {
          const model = genAI.getGenerativeModel({ model: "gemini-pro" });
          const result = await model.generateContent(prompt);
          const response = await result.response;
          blogContent = response.text();
        } catch (fallbackError) {
          throw providerError; // Throw original error if fallback also fails
        }
      } else {
        throw providerError;
      }
    }

    res.json({
      success: true,
      blogContent,
      metadata: {
        venueName,
        targetMonth,
        weekOfMonth,
        creator,
        draftTopic,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error generating blog:", error);
    res.status(500).json({
      error: "Failed to generate blog",
      message: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
