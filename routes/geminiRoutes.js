const router = require("express").Router();
const fetch = require("node-fetch");

// Check API key availability once
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (GEMINI_API_KEY) {
  console.log("✅ Gemini API key loaded");
} else {
  console.warn("⚠️ GEMINI_API_KEY not found in environment variables");
}

router.post("/voice-intent", async (req, res) => {
  try {
    console.log("🎤 Voice intent request received:", req.body);
    
    // API key check
    if (!GEMINI_API_KEY) {
      console.error("❌ Gemini API key not configured");
      return res.status(503).json({
        success: false,
        error: "Gemini API not configured",
        message: "Please set GEMINI_API_KEY in environment variables",
        fallback: true
      });
    }

    const { text, prompt } = req.body;

    console.log("📝 Processing voice text:", text);

    // Input validation
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      console.error("❌ Invalid input received");
      return res.status(400).json({
        success: false,
        error: "Invalid input",
        message: "Text is required and must be a non-empty string"
      });
    }

    // Use enhanced prompt if provided, otherwise use default
    const finalPrompt = prompt || `
You are an expert agriculture assistant for KisanSetu platform, specifically designed to help Indian farmers with practical farming advice.

A farmer said:
"${text.trim()}"

Your task:
- Provide SPECIFIC, ACTIONABLE advice for farmers
- Respond in the SAME language as the query (Hindi or English)
- Keep responses concise but detailed (2-3 sentences maximum)
- Be professional yet friendly like a farming expert
- Always give practical, implementable solutions
- Include specific next steps when possible

Farmer-Specific Response Guidelines:
- For crop health: Ask for crop name, symptoms, and photos. Suggest specific treatments.
- For market prices: Ask for crop name and location. Give current market trends.
- For orders: Direct to dashboard with specific steps.
- For pesticides: Ask for crop and pest type. Recommend safe, approved options.
- For fertilizers: Ask for soil type and crop. Suggest NPK ratios.
- For weather: Ask for location. Give 7-day forecast and farming advice.
- For irrigation: Ask for crop and soil moisture. Give water-saving tips.
- For seeds: Ask for crop and season. Recommend high-yield varieties.

IMPORTANT: Always provide specific, actionable advice that farmers can implement immediately. Avoid vague responses. If you need more information, ask specific questions.
`;

    console.log("🌐 Making Gemini API call...");
const MODEL_NAME = "gemini-3-flash-preview";
    // Gemini REST v1beta call (WORKING)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
    {
      role: "user",
      parts: [{ text: finalPrompt }]
    }
  ],
  generationConfig: {
    maxOutputTokens: 250, 
    temperature: 0.7
  }
        })
      }
    );

    console.log("📡 Gemini API response status:", response.status);

    const data = await response.json();

    // Log the full error response for debugging
    if (response.status !== 200) {
      console.error("❌ Gemini API Error Response:", data);
    }

    // Handle Gemini-side errors
    if (!data.candidates || data.candidates.length === 0) {
      console.warn("🔧 Developer: AI unavailable - returning error to user");

      return res.status(503).json({
        success: false,
        error: "AI not responding",
        message: "Voice assistant is temporarily unavailable. Please try again later.",
        fallback: false
      });
    }

    // Get the actual Gemini AI response
    const intentText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!intentText) {
      console.error("❌ No response text from Gemini");

      return res.status(503).json({
        success: false,
        error: "Gemini AI not responding",
        message: "AI service is temporarily unavailable. Please try again later.",
        fallback: false
      });
    }

    console.log("✅ Gemini AI Response:", intentText);

    res.json({
      success: true,
      intent: intentText,
      originalText: text.trim()
    });

  } catch (error) {
    console.error("❌ Gemini REST API Error:", error);

    res.status(503).json({
      success: false,
      error: "Gemini API Error",
      message: "AI service is temporarily unavailable. Please try again later.",
      fallback: false
    });
  }
});

module.exports = router;
