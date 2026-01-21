import "dotenv/config";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Anthropic } from "@anthropic-ai/sdk";
import { fetchPexelsImages } from "./services/pexelsService.js";
import { supabase } from "./supabaseClient.js";
import { generateImageMetadata } from "./services/imageMetadataService.js";
import { authMiddleware, requireAuth } from "./middleware/auth.js";
import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(authMiddleware);

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

// Helper function to extract first JSON object from text
function extractFirstJsonObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const slice = text.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

// Helper function to fetch venue specific prompt from Supabase
async function getVenueSpecificPrompt(venue) {
  const { data, error } = await supabase
    .from("venue-prompt")
    .select("prompt, website") // Fetch website as well
    .eq("id", venue.toLowerCase()) // Assuming 'id' is the venue name based on screenshot
    .maybeSingle();

  console.log("Looking for venue ID:", venue.toLowerCase());

  if (error) {
    console.warn(`Error fetching specific prompt for venue ${venue}:`, error);
    return null;
  }
  console.log("id", venue.toLowerCase());
  return data ? { prompt: data.prompt, website: data.website } : null;
}

// Initialize AI providers
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// Helper to ensure storage bucket exists
async function ensureBucketExists() {
  try {
    const output = await supabase.storage.getBucket('blog-images');
    if (output.error && output.error.message.includes('not found')) {
      console.log("Bucket 'blog-images' not found. Creating...");
      const { data, error } = await supabase.storage.createBucket('blog-images', {
        public: true,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
      });
      if (error) {
        console.error("Failed to create bucket:", error);
      } else {
        console.log("Created 'blog-images' bucket successfully.");
      }
    } else {
      console.log("Bucket 'blog-images' exists.");
    }
  } catch (e) {
    console.error("Error checking bucket:", e);
  }
}

// Check bucket on startup
ensureBucketExists();

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
app.post(
  "/api/generate-blog",
  upload.fields([{ name: "heroImage", maxCount: 1 }, { name: "galleryImages", maxCount: 10 }]),
  async (req, res) => {
    try {
      const {
        venueName,
        targetMonth,
        weekOfMonth,
        creator,
        draftTopic,
        specialInstructions,
      } = req.body;

      // Helper to convert buffer to base64
      const fileToBase64 = (file) => {
        const b64 = file.buffer.toString("base64");
        const mime = file.mimetype;
        return `data:${mime};base64,${b64}`;
      };

      let heroImageName = "";
      let galleryImageNames = [];
      let uploadedImagesData = []; // To store { url (base64 for vision), filename, section }

      const uploadToSupabase = async (file) => {
        const timestamp = Date.now();
        // Sanitize filename
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
        const path = `uploads/${timestamp}_${safeName}`;

        const { data, error } = await supabase.storage
          .from("blog-images")
          .upload(path, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
          });

        if (error) {
          console.error("Supabase Storage Upload Error:", error);
          throw error;
        }

        // Get Public URL
        const { data: publicData } = supabase.storage
          .from("blog-images")
          .getPublicUrl(path);

        return publicData.publicUrl;
      };

      if (req.files["heroImage"] && req.files["heroImage"][0]) {
        const file = req.files["heroImage"][0];
        heroImageName = file.originalname;

        // Upload to Storage
        const publicUrl = await uploadToSupabase(file);
        const b64 = fileToBase64(file); // Still need base64 for Vision analysis immediately

        uploadedImagesData.push({
          image_url: b64, // Keep base64 for IMMEDIATE vision analysis (metadata generation)
          public_url: publicUrl, // STORE this in DB for persistence
          file_name: heroImageName,
          section: "hero",
          is_user_upload: true
        });
      }

      if (req.files["galleryImages"]) {
        // Use Promise.all for parallel uploads
        await Promise.all(req.files["galleryImages"].map(async (file, index) => {
          const b64 = fileToBase64(file);
          const publicUrl = await uploadToSupabase(file);

          galleryImageNames.push(file.originalname);
          uploadedImagesData.push({
            image_url: b64,
            public_url: publicUrl,
            file_name: file.originalname,
            section: `gallery_${index}`,
            is_user_upload: true
          });
        }));
      }

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
      let venueData = await getVenueSpecificPrompt(venueName);
      let masterPrompt = venueData?.prompt;
      let venueWebsite = venueData?.website;

      /*if (masterPrompt) {
        console.log("First letter of prompt:", masterPrompt.charAt(66));
      }*/
      // 2. If no specific prompt, fall back to the default master prompt
      if (!masterPrompt) {
        console.log(`No specific prompt found for ${venueName}, using default.`);
        masterPrompt = await getMasterPromptByVenue("blog_generation");
      }
      //Master Prompt+user inputs↓
      const prompt = `
  ${masterPrompt} 
  Venue Name: ${venueName}
  Target Month: ${targetMonth}
  Week of Month: ${weekOfMonth}
  Creator: ${creator}
  Draft Topic: ${draftTopic}
  ${venueWebsite
          ? `Venue Website: ${venueWebsite}
  MANDATORY REQUIREMENT: 
  1. You MUST include a Markdown hyperlink to the venue website at the end of the blog. Format: [${venueName}](${venueWebsite}).
  2. FOCUS ONLY on ${venueName}. Do NOT list or mention other venues. Do NOT create a 'Resources' section with other links.`
          : ""
        }
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
        } else if (anthropic) {
          // Fallback to Claude (Anthropic)
          const msg = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 4096,
            messages: [{ role: "user", content: prompt }],
          });
          blogContent = msg.content[0].text;
        } else {
          throw new Error(
            "No AI provider configured. Please set GROQ_API_KEY or ANTHROPIC_API_KEY"
          );
        }
      } catch (providerError) {
        // If primary provider fails, try fallback
        if (aiProvider !== "claude" && anthropic) {
          console.log(
            "Primary provider failed, trying Claude fallback...",
            providerError.message
          );
          try {
            const msg = await anthropic.messages.create({
              model: "claude-3-5-sonnet-20241022",
              max_tokens: 4096,
              messages: [{ role: "user", content: prompt }],
            });
            blogContent = msg.content[0].text;
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
          user_id: req.user ? req.user.id : null,
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
          user_id: blog.user_id,
          image_url: img.image_url,
          image_source: "pexels",
          image_url: img.image_url,
          image_source: "pexels",
          // If user provided a hero image, Pexels images should NOT be hero.
          // They will be "pexels_gallery_N".
          section: heroImageName ? `pexels_gallery_${index}` : (index === 0 ? "hero" : `gallery_${index}`),
          is_latest: true,
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

      // STEP C-2: Store User Provided HERO Image
      if (heroImageName) {
        // Find the upload data
        const heroData = uploadedImagesData.find(u => u.section === "hero");

        const heroRow = {
          blog_id: blog.id,
          user_id: blog.user_id,
          image_url: heroData ? heroData.public_url : heroImageName, // Use Public URL
          image_source: "user_upload", // Changed from 'user_placeholder' to 'user_upload'
          section: "hero",
          file_name: heroImageName,
          is_latest: true,
        };

        const { error: insertHeroError } = await supabase
          .from("blog_images")
          .insert(heroRow);

        if (insertHeroError) console.error("Error inserting user hero image:", insertHeroError);
        else console.log("Inserted user hero image");
      }

      // STEP C-3: Store User Provided GALLERY Images
      if (galleryImageNames && galleryImageNames.length > 0) {
        const userGalleryRows = [];

        galleryImageNames.forEach((name, index) => {
          const gData = uploadedImagesData.find(u => u.section === `gallery_${index}`);
          userGalleryRows.push({
            blog_id: blog.id,
            user_id: blog.user_id,
            image_url: gData ? gData.public_url : name, // Use Public URL
            image_source: "user_upload",
            section: `gallery_${index}`,
            file_name: name,
            is_latest: true,
          });
        });

        const { error: insertGalleryError } = await supabase
          .from("blog_images")
          .insert(userGalleryRows);

        if (insertGalleryError) {
          console.error("Error inserting user gallery images:", insertGalleryError);
        } else {
          console.log("Inserted user gallery images:", userGalleryRows.length);
        }
      }

      // 1. Fetch latest images for this blog (Pexels and user_placeholder)
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
      // Merge uploaded base64 data into blogImages for Vision analysis
      // AND fetch Pexels images to convert to base64 so Vision can see them too
      const imagesForAI = await Promise.all(blogImages.map(async (img) => {
        // 1. Check if we already have a user upload for this section
        const uploadData = uploadedImagesData.find(u => u.section === img.section);
        if (uploadData) {
          return {
            ...img,
            image_url: uploadData.image_url,
            is_base64: true
          };
        }

        // 2. If it's a Pexels image (starts with http), fetch it to get Base64
        if (img.image_url && img.image_url.startsWith("http")) {
          try {
            console.log(`Fetching Pexels image for Vision analysis: ${img.image_url}`);
            const imgResp = await fetch(img.image_url);
            if (imgResp.ok) {
              const arrayBuffer = await imgResp.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
              const b64 = buffer.toString("base64");
              // Guess mime type or default to jpeg (Pexels usually serves jpegs)
              return {
                ...img,
                image_url: `data:image/jpeg;base64,${b64}`,
                is_base64: true //transits image into 64 binary encoding system
              };
            }
          } catch (err) {
            console.error("Failed to fetch Pexels image for vision:", err);
          }
        }

        // Fallback: just return original (will be treated as text-only analysis)
        return {
          ...img,
          is_base64: false
        };
      }));

      const imageMetadata = await generateImageMetadata({
        images: imagesForAI,
        blogContext: blogContent,
        aiProvider: process.env.GROQ_API_KEY ? "groq" : "claude",
        apiKey: process.env.GROQ_API_KEY || process.env.ANTHROPIC_API_KEY,
        anthropicClient: anthropic,
        masterPrompt: imageMetadataPrompt,
      });


      // 4. Save metadata back to Supabase
      for (const meta of imageMetadata) {
        // We match by original image_url (which for user uploads was the filename)
        // OR by section if available in metadata (safest if we pass it through)

        // Note: generateImageMetadata returns items with 'image_url' property from input.
        // For uploads, we passed base64 as image_url in imagesForAI, 
        // BUT the service (which I will update) should preserve the *original* identity 
        // or we need to map back.

        // Actually, easiest is to trust the index/array order if service preserves it.
        // But let's look at how we update.
        // The previous code matched by `eq("image_url", meta.image_url)`.

        // If I pass base64 as image_url, meta.image_url will be base64. 
        // That won't match the DB content (filename).

        // Fix: In imagesForAI above, I kept `img` properties but OVERWROTE `image_url`.
        // I should keep the original identifier separate.

        // Revised Strategy in Service:
        // Service receives { ...img, base64_content: ... }
        // Service returns { ...img (original), ...metadata }

        // So here in the loop:
        await supabase
          .from("blog_images")
          .update({
            file_name: meta.file_name,
            title_tag: meta.title_tag,
            alt_text: meta.alt_text,
            metadata_generated_at: new Date().toISOString(),
          })
          // Start with safe ID matching if available (we have `id` in blogImages)
          .eq("id", meta.id);
      }

      const { data: finalImages, error: finalImagesError } = await supabase
        .from("blog_images")
        .select(
          "image_url, file_name, title_tag, alt_text, section, is_latest, created_at"
        )
        .eq("blog_id", blog.id)
        .eq("is_latest", true)
        .order("created_at", { ascending: true });

      if (finalImagesError) throw finalImagesError;

      // Merge base64 back into response so frontend can display them!
      const imagesWithPreview = finalImages.map(img => {
        const uploadData = uploadedImagesData.find(u => u.section === img.section);
        if (uploadData) {
          return { ...img, image_url: uploadData.image_url }; // Return base64 for display
        }
        return img;
      });

      res.status(200).json({
        message: "Blog generated successfully",
        blogContent,
        blogId: blog.id,
        images: imagesWithPreview,
      });
      return; // Ensure we stop here
    } catch (error) {
      console.error("Error generating blog:", error);
      res.status(500).json({ error: error.message });
    }
  }
);



// Endpoint to add a new user image to an existing blog
app.post(
  "/api/add-image",
  upload.single("image"),
  async (req, res) => {
    try {
      const { blogId } = req.body;
      const file = req.file;

      if (!blogId || !file) {
        return res.status(400).json({ error: "Missing blogId or image file" });
      }

      // 1. Upload to Supabase Storage
      const timestamp = Date.now();
      const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
      const path = `uploads/${timestamp}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("blog-images")
        .upload(path, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      const { data: publicData } = supabase.storage
        .from("blog-images")
        .getPublicUrl(path);

      const publicUrl = publicData.publicUrl;

      // 2. Generate Metadata
      const { data: blogData, error: blogError } = await supabase
        .from("blogs")
        .select("blog_content, user_id")
        .eq("id", blogId)
        .single();

      if (blogError || !blogData) {
        throw new Error("Blog not found");
      }

      const b64 = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;

      const imageInputForAI = [{
        id: "new_image",
        image_url: b64,
        is_base64: true,
        section: "user_added",
        file_name: file.originalname
      }];

      // Context prompt
      const masterPrompt = await getMasterPromptByVenue("blog_generation");

      const imageMetadata = await generateImageMetadata({
        images: imageInputForAI,
        blogContext: blogData.blog_content, // Use correct field
        aiProvider: process.env.GROQ_API_KEY ? "groq" : "claude",
        apiKey: process.env.GROQ_API_KEY || process.env.ANTHROPIC_API_KEY,
        anthropicClient: anthropic,
        masterPrompt: masterPrompt,
      });

      const meta = imageMetadata[0] || {};

      // 3. Insert into DB
      const newImageRow = {
        blog_id: blogId,
        user_id: blogData.user_id,
        image_url: publicUrl,
        image_source: "user_upload",
        section: "user_added",
        file_name: meta.file_name || file.originalname,
        title_tag: meta.title_tag || "",
        alt_text: meta.alt_text || "",
        is_latest: true,
      };

      const { data: insertedImage, error: insertError } = await supabase
        .from("blog_images")
        .insert(newImageRow)
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      res.json({
        success: true,
        image: insertedImage
      });

    } catch (error) {
      console.error("Error adding image:", error);
      res.status(500).json({ error: error.message });
    }
  }
);


app.post("/api/refresh-image", async (req, res) => {
  try {
    const { blogId, section, customQuery } = req.body;

    if (!blogId || !section) {
      return res.status(400).json({ error: "Missing blogId or section" });
    }

    // A) Get blog context to build a good Pexels query
    const { data: blog, error: blogFetchError } = await supabase
      .from("blogs")
      .select("venue_name, draft_topic, special_instructions, user_id")
      .eq("id", blogId)
      .single();

    if (blogFetchError || !blog) {
      console.error("Error fetching blog:", blogFetchError);
      return res.status(404).json({ error: "Blog not found" });
    }

    // B) Get all previously-used image URLs for this blog (to avoid duplicates)
    const { data: allImages, error: allImagesError } = await supabase
      .from("blog_images")
      .select("image_url")
      .eq("blog_id", blogId);

    if (allImagesError) {
      console.error("Error fetching existing images:", allImagesError);
      return res.status(500).json({ error: "Failed to fetch existing images" });
    }

    const usedUrls = new Set(
      (allImages || []).map((r) => r.image_url).filter(Boolean)
    );

    // C) Mark current latest image(s) for THIS section as not latest
    const { error: markOldError } = await supabase
      .from("blog_images")
      .update({ is_latest: false })
      .eq("blog_id", blogId)
      .eq("section", section)
      .eq("is_latest", true);

    if (markOldError) {
      console.error("Error marking old images:", markOldError);
      return res.status(500).json({ error: "Failed to mark old images" });
    }

    // D) Fetch candidate images from Pexels (fetch more than 1, then pick a new one)
    // Use customQuery if provided, otherwise build one from blog context
    const pexelsQuery = customQuery
      ? customQuery
      : buildPexelsQuery({
        venueName: blog.venue_name,
        draftTopic: blog.draft_topic,
        specialInstructions: blog.special_instructions,
      });

    const candidates = await fetchPexelsImages(pexelsQuery, 8); // fetch several to reduce duplicates
    const picked = (candidates || []).find(
      (img) => img?.image_url && !usedUrls.has(img.image_url)
    );

    // fallback: if everything is used, pick the first candidate (rare)
    const newImageUrl = picked?.image_url || candidates?.[0]?.image_url || null;

    if (!newImageUrl) {
      return res.status(500).json({ error: "No new image found from Pexels" });
    }

    // E) Insert the new image row
    const { data: inserted, error: insertError } = await supabase
      .from("blog_images")
      .insert({
        blog_id: blogId,
        user_id: blog.user_id,
        image_url: newImageUrl,
        image_source: "pexels",
        section: section,
        is_latest: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting refreshed image:", insertError);
      return res.status(500).json({ error: "Failed to insert new image" });
    }

    // F) Generate metadata for ONLY this new image
    // IMPORTANT: use the same master prompt key you already use in /api/generate-blog for metadata
    // F) Generate metadata using shared service with vision support
    const masterPrompt = await getMasterPromptByVenue("blog_generation");

    const imageInputForAI = [{
      id: "refreshed_image",
      image_url: inserted.image_url,
      is_base64: false,
      is_remote_url: true, // Signal that this is a public URL for vision
      section: inserted.section,
      file_name: `pexels_${Date.now()}.jpg`
    }];

    const imageMetadata = await generateImageMetadata({
      images: imageInputForAI,
      blogContext: blog.venue_name + " " + blog.draft_topic,
      aiProvider: process.env.GROQ_API_KEY ? "groq" : "claude",
      apiKey: process.env.GROQ_API_KEY || process.env.ANTHROPIC_API_KEY,
      anthropicClient: anthropic,
      masterPrompt: masterPrompt,
    });

    const meta = imageMetadata[0] || {};

    // G) Update the inserted image row with metadata
    const { error: updateError } = await supabase
      .from("blog_images")
      .update({
        file_name: meta.file_name || null,
        title_tag: meta.title_tag || null,
        alt_text: meta.alt_text || null,
        metadata_generated_at: new Date().toISOString(),
      })
      .eq("id", inserted.id);

    if (updateError) {
      console.error("Error updating image metadata:", updateError);
      return res.status(500).json({ error: "Failed to update image metadata" });
    }

    // H) Return updated latest images for UI
    const { data: latestImages, error: latestError } = await supabase
      .from("blog_images")
      .select(
        "id, image_url, image_source, section, file_name, title_tag, alt_text, is_latest, created_at, metadata_generated_at"
      )
      .eq("blog_id", blogId)
      .eq("is_latest", true)
      .order("created_at", { ascending: true });

    if (latestError) {
      console.error("Error fetching latest images:", latestError);
      return res.status(500).json({ error: "Failed to fetch latest images" });
    }

    return res.json({ success: true, images: latestImages || [] });
  } catch (err) {
    console.error("Refresh image error:", err);
    return res
      .status(500)
      .json({ error: "Refresh image failed", message: err.message });
  }
});

app.get("/api/my-blogs", requireAuth, async (req, res) => {
  try {
    const { data: blogs, error } = await supabase
      .from("blogs")
      .select("id, venue_name, draft_topic, status, created_at, target_month")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ blogs });
  } catch (err) {
    console.error("Fetch history error:", err);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

// Update a blog
app.put("/api/blogs/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { venue_name, draft_topic, blog_content } = req.body;

    // Verify ownership
    const { data: blog, error: fetchError } = await supabase
      .from("blogs")
      .select("user_id")
      .eq("id", id)
      .single();

    if (fetchError || !blog) {
      return res.status(404).json({ error: "Blog not found" });
    }

    if (blog.user_id !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const { error: updateError } = await supabase
      .from("blogs")
      .update({ venue_name, draft_topic, blog_content })
      .eq("id", id);

    if (updateError) throw updateError;

    res.json({ success: true, message: "Blog updated" });
  } catch (err) {
    console.error("Update blog error:", err);
    res.status(500).json({ error: "Failed to update blog" });
  }
});

// Delete a blog
app.delete("/api/blogs/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership first
    const { data: blog, error: fetchError } = await supabase
      .from("blogs")
      .select("user_id")
      .eq("id", id)
      .single();

    if (fetchError || !blog) {
      return res.status(404).json({ error: "Blog not found" });
    }

    if (blog.user_id !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const { error: deleteError } = await supabase
      .from("blogs")
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;

    res.json({ success: true, message: "Blog deleted" });
  } catch (err) {
    console.error("Delete blog error:", err);
    res.status(500).json({ error: "Failed to delete blog" });
  }
});

// Publish a blog
app.post("/api/publish-blog", requireAuth, async (req, res) => {
  const { blogId } = req.body;
  if (!blogId) return res.status(400).json({ error: "Missing blogId" });

  try {
    // 1. Verify ownership
    const { data: blog, error: fetchError } = await supabase
      .from("blogs")
      .select("user_id")
      .eq("id", blogId)
      .single();

    if (fetchError || !blog) return res.status(404).json({ error: "Blog not found" });
    if (blog.user_id !== req.user.id) return res.status(403).json({ error: "Unauthorized" });

    // 2. Update status
    const { error: updateError } = await supabase
      .from("blogs")
      .update({ status: "published" })
      .eq("id", blogId);

    if (updateError) throw updateError;

    res.json({ success: true });
  } catch (err) {
    console.error("Publish error:", err);
    res.status(500).json({ error: "Failed to publish" });
  }
});

// Unpublish a blog (revert to draft)
app.post("/api/unpublish-blog", requireAuth, async (req, res) => {
  const { blogId } = req.body;
  if (!blogId) return res.status(400).json({ error: "Missing blogId" });

  try {
    const { data: blog, error: fetchError } = await supabase
      .from("blogs")
      .select("user_id")
      .eq("id", blogId)
      .single();

    if (fetchError || !blog) return res.status(404).json({ error: "Blog not found" });
    if (blog.user_id !== req.user.id) return res.status(403).json({ error: "Unauthorized" });

    const { error: updateError } = await supabase
      .from("blogs")
      .update({ status: "draft" })
      .eq("id", blogId);

    if (updateError) throw updateError;

    res.json({ success: true });
  } catch (err) {
    console.error("Unpublish error:", err);
    res.status(500).json({ error: "Failed to unpublish" });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File too large. Max size is 5MB." });
    }
    return res.status(400).json({ error: err.message });
  }
  console.error("Unhandled error:", err);
  res.status(500).json({ error: err.message || "Internal Server Error" });
});

ensureBucketExists().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error("Failed to check/create bucket:", err);
  // Still start server but warn
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT} (Bucket check failed)`);
  });
});
