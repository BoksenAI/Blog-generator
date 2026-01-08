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

    //If the venue name is Cedros, use the cedrosPrompt
    //if(venueName.toLowerCase() === 'cedros') {
    // const prompt = `You are a professional blog writer. Write a comprehensive blog post based on the following information:
    // Venue Name: ${venueName}
    // Target Month: ${targetMonth}
    // Week of Month: ${weekOfMonth}
    // Creator: ${creator}
    // Draft Topic/Title: ${draftTopic}
    // ${specialInstructions ? `Special Instructions: ${specialInstructions}` : ""}

    // You are an expert copywriter for 'Eat Me.' Write a blog for ${venueName} targeting rich tourists in Tokyo. CRITICAL RULES:
    // 1. Never use em dashes (—). Use commas or periods instead. 2.Define any Japanese cultural terms (e.g., yōshoku) in line.
    // 3.Tone: Sophisticated, welcoming, and high-end. 4.Use these ${
    //   specialInstructions
    //     ? `Special Instructions: ${specialInstructions}`
    //     : "standard guidelines"
    // }...
    // Format: H1, H2, H3, clean paragraph spacing.

    // Title: Should include keywords to maximise SEO, but sound natural. Length: 1,500 to2,000 words Mention of Cedros: No more than once, ideally in the middle or final third of the article
    // CTA: Blend into the ending naturally (e.g., “Whether you find yourself at Cabin or a calm spot like Cedros, the key is slowing down and savoring it.”)Tone and Purpose:
    // Tone and Purpose:'
    // 🧭 Suggested Major Sections (SEO-friendly layout):
    //   1.	Intro: Set up the reader journey — craving calm, familiarity, and good taste in Tokyo
    //   2.	Examples of Venues (mention 2 to 4, including Cedros once. Look up online to check that the suggested restaurants exists and are operational.)
    //   3.	Tips for Eating Out in Tokyo as a Foreigner, related to the article.
    //   4.	Conclusion section that's not too long with a Subtle CTA (Don't name this secti
    // s is better described by the following:
    // Calm atmosphere, low-key environment.
    // Gentle and refined lighting.
    // Feels both homey and fancy at the same time.
    // Staff felt like they already knew me.
    // Food was exquisitely put together engineered to perfection.
    // Every element was thought through for a wonderful experience.
    // Not too full, not hungry perfect amount of food.
    // It wasn't just taste or stuffing myself; it was a balance.
    // Made me thoughtful about how I ate and drank.
    // A refined but homey place.

    // A place where you could get lost in conversation.
    // Everything done with care, professionalism, and purpose.
    // Staff treated their jobs with serious intention part of something bigger.
    // Intimate restaurant (not a bar).
    // Never crowded, no loud buzz of people.
    // A place for quiet indulgence and intimate conversation.
    // Quiet that felt invigorating.
    // A perfect blend of Southern California flavors like tostadas and tacos with subtle touches of Japanese cuisine.
    // Seafood dishes that offer a fresh and surprising experience, even for Japanese guests.
    // While Japan often focuses on wagyu, Cedros highlights the richness of Japan’s seafood — a true seafood-forward restaurant.
    // The warm hospitality and chill atmosphere make it a uniquely relaxing experience, even in the heart of Japan.
    // Very cozy and laid back
    // California fusion that blends Japanese ingredients with a western touch.
    // Feels more like California than Tokyo.
    // Kind of like hanging out in your friend or family living room.
    // As for the tostada, it is also a guest favorite, but we switch up the toppings monthly with seasonal ingredients like Thai fish or firefly squid. Would love it if we could include a note that many of our ingredients change with the seasons.
    // For lobster risotto, it would be great if we could mention that it is been one of our most popular signature.
    // Also, the example product is like this website:https://eatme.co.jp/the-great-tokyo-food-plot-twist-when-restaurants-arent-what-they-seem/`;

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

    /*const prompt = `You are a professional blog writer. Write a comprehensive blog post based on the following information:
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
    const images = await fetchPexelsImages(venueName, 1);
    const imageUrl = images.length > 0 ? images[0].image_url : null;

    // STEP C: Store image in blog_images
    if (imageUrl) {
      const { error: imageError } = await supabase.from("blog_images").insert([
        {
          blog_id: blog.id,
          image_url: imageUrl,
          image_source: "pexels",
          section: "hero",
          is_latest: true,
        },
      ]);

      if (imageError) {
        console.error("Error inserting blog image:", imageError);
      } else {
        console.log("Inserted row into blog_images:", {
          blogId: blog.id,
          imageUrl,
        });
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

    res.json({
      success: true,
      blogId: blog.id,
      blogContent,
      images: imageMetadata, // <-- THIS IS THE KEY CHANGE
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
