import "dotenv/config";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { fetchPexelsImages } from "./services/pexelsService.js";
import { supabase } from "./supabaseClient.js";
import { generateImageMetadata } from "./services/imageMetadataService.js";

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

// Helper function to fetch venue specific prompt from Supabase
async function getVenueSpecificPrompt(venue) {
  const { data, error } = await supabase
    .from("venue-prompt")
    .select("prompt")
    .eq("id", venue.toLowerCase()) // Assuming 'id' is the venue name based on screenshot
    .maybeSingle();

  console.log("Looking for venue ID:", venue.toLowerCase());

  if (error) {
    console.warn(`Error fetching specific prompt for venue ${venue}:`, error);
    return null;
  }
  console.log("id", venue.toLowerCase());
  return data ? data.prompt : null;
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

function buildPexelsQuery({ venueName, draftTopic, specialInstructions }) {
  // Keep queries short & descriptive — Pexels works best this way
  let query = `${venueName} restaurant interior Tokyo`;

  if (draftTopic) {
    query += ` ${draftTopic}`;
  }

  if (specialInstructions) {
    query += ` ${specialInstructions}`;
  }

  // Safety: limit query length
  return query.slice(0, 120);
}

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
    //Master Prompt↓
    /* `You are a professional blog writer. Write a comprehensive blog post based on the following information:
Venue Name: ${venueName}
Target Month: ${targetMonth}
Week of Month: ${weekOfMonth}
Creator: ${creator}
Draft Topic/Title: ${draftTopic}
${specialInstructions ? `Special Instructions: ${specialInstructions}` : ''}

You are an expert copywriter for 'Eat Me.' Write a blog for ${venueName} targeting rich tourists in Tokyo. CRITICAL RULES:
1. Never use em dashes (—). Use commas or periods instead. 2.Define any Japanese cultural terms (e.g., yōshoku) in line.
3.Tone: Sophisticated, welcoming, and high-end. 4.Use these ${specialInstructions ? `Special Instructions: ${specialInstructions}` : 'standard guidelines'}...
Format: H1, H2, H3, clean paragraph spacing.`;*/

    // 1. Try to get a specific prompt for the venue
    let masterPrompt = await getVenueSpecificPrompt(venueName);
    /*if (masterPrompt) {
      console.log("First letter of prompt:", masterPrompt.charAt(68));
    }*/
    // 2. If no specific prompt, fall back to the default master prompt
    if (!masterPrompt) {
      console.log(`No specific prompt found for ${venueName}, using default.`);
      masterPrompt = await getMasterPromptByVenue("blog_generation");
    }

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
    let blog;
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
        //Checks for the status response from groq and return the model name and error message
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
    // STEP A: Create blog row in Supabase (after blogContent exists)
    const { data: createdBlog, error: blogError } = await supabase
      .from("blogs")
      .insert({
        venue_name: venueName,
        target_month: targetMonth,
        week_of_month: weekOfMonth,
        creator,
        draft_topic: draftTopic,
        special_instructions: specialInstructions || null,
        blog_content: blogContent,
        status: "draft",
      })
      .select()
      .single();

    if (blogError) {
      console.error("Error inserting blog:", blogError);
      return res.status(500).json({ error: "Failed to create blog" });
    }

    blog = createdBlog;
    if (!blog?.id)
      throw new Error("Blog insert succeeded but blog.id is missing");
    // STEP B: Fetch image from Pexels
    const pexelsQuery = buildPexelsQuery({
      venueName,
      draftTopic,
      specialInstructions,
    });

    const images = await fetchPexelsImages(pexelsQuery, 3);

    // STEP C: Store ALL images in blog_images
    if (!images || images.length === 0) {
      console.log(
        "No images returned from Pexels, skipping blog_images insert"
      );
    } else {
      const rowsToInsert = images.map((img, index) => ({
        blog_id: blog.id,
        image_url: img.image_url,
        image_source: "pexels",
        section: index === 0 ? "hero" : `gallery_${index}`, // hero + gallery_1, gallery_2...
        is_latest: true,
      }));

      const { error: insertImagesError } = await supabase
        .from("blog_images")
        .insert(rowsToInsert);

      if (insertImagesError) {
        console.error("Error inserting multiple images:", insertImagesError);
      } else {
        console.log("Inserted images into blog_images:", rowsToInsert.length);
      }
    }
    // 1. Fetch latest images for this blog
    const { data: blogImages, error: imageFetchError } = await supabase
      .from("blog_images")
      .select("*")
      .eq("blog_id", blog.id)
      .eq("is_latest", true);

    if (imageFetchError) {
      throw imageFetchError;
    }

    // 2. Get image metadata master prompt
    const imageMetadataPrompt = await getMasterPromptByVenue("image_metadata");

    // 3. Generate metadata using AI
    const imageMetadata = await generateImageMetadata({
      images: blogImages,
      blogContext: blogContent,
      aiProvider: "groq",
      apiKey: process.env.GROQ_API_KEY,
      masterPrompt: imageMetadataPrompt,
    });

    // 4. Save metadata back to Supabase
    for (const meta of imageMetadata) {
      await supabase
        .from("blog_images")
        .update({
          file_name: meta.file_name,
          title_tag: meta.title_tag,
          alt_text: meta.alt_text,
          metadata_generated_at: new Date().toISOString(),
        })
        .eq("image_url", meta.image_url);
    }

    const { data: finalImages, error: finalImagesError } = await supabase
      .from("blog_images")
      .select(
        "image_url, file_name, title_tag, alt_text, section, is_latest, created_at"
      )
      .eq("blog_id", blog.id)
      .eq("is_latest", true)
      .order("created_at", { ascending: true });

    if (finalImagesError) {
      console.error("Error fetching final images:", finalImagesError);
    }

    res.json({
      success: true,
      blogId: blog.id,
      blogContent,
      images: finalImages || [],
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
