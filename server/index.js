import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Blog generation endpoint
app.post('/api/generate-blog', async (req, res) => {
  try {
    const { venueName, targetMonth, weekOfMonth, creator, draftTopic, specialInstructions } = req.body;

    if (!venueName || !targetMonth || !weekOfMonth || !creator || !draftTopic) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create the prompt for Gemini
    const prompt = `You are a professional blog writer. Write a comprehensive blog post based on the following information:

Venue Name: ${venueName}
Target Month: ${targetMonth}
Week of Month: ${weekOfMonth}
Creator: ${creator}
Draft Topic/Title: ${draftTopic}
${specialInstructions ? `Special Instructions: ${specialInstructions}` : ''}

You are an expert copywriter for 'Eat Me.' Write a blog for ${venueName} targeting rich tourists in Tokyo. CRITICAL RULES:
1. Never use em dashes (—). Use commas or periods instead. 2.Define any Japanese cultural terms (e.g., yōshoku) in line.
3.Tone: Sophisticated, welcoming, and high-end. 4.Use these ${specialInstructions ? `Special Instructions: ${specialInstructions}` : 'standard guidelines'}...
Format: H1, H2, H3, clean paragraph spacing.`;

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const blogContent = response.text();

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
      }
    });
  } catch (error) {
    console.error('Error generating blog:', error);
    res.status(500).json({ 
      error: 'Failed to generate blog', 
      message: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

