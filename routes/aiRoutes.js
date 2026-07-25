const router = require("express").Router();
const multer = require("multer");
const fetch = require("node-fetch");
const fs = require("fs");

const upload = multer({ dest: "uploads/" });
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Crop Doctor image analysis
router.post("/crop-doctor", upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image provided" });

  try {
    const imagePath = req.file.path;
    if (!GEMINI_API_KEY) {
      if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
      return res.status(530).json({ error: "GEMINI_API_KEY not configured" });
    }

    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString("base64");

    const prompt = `
You are an expert agricultural scientist. Analyze this crop image and return a JSON object:
{
  "disease": "Disease Name or 'Healthy'",
  "severity": "Low|Medium|High",
  "symptoms": "Detailed symptoms description",
  "treatment": "Step-by-step treatment recommendations",
  "prevention": "Prevention tips",
  "expertAdvice": "When to consult an agricultural expert",
  "confidence": "High|Medium|Low"
}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: base64Image } }] }]
        })
      }
    );

    const data = await response.json();
    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);

    if (!data.candidates || data.candidates.length === 0) {
      return res.status(500).json({ error: "Gemini API returned no results" });
    }

    const aiText = data.candidates[0].content.parts[0].text;
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { disease: "Unknown", symptoms: aiText };

    res.json({ success: true, ...result, analysisMethod: "Gemini", timestamp: new Date().toISOString() });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: "Analysis failed", message: err.message });
  }
});

// Voice Assistance for Crop Doctor
router.post("/crop-doctor-voice", async (req, res) => {
  try {
    const { text, cropInfo, symptoms } = req.body;
    if (!text) return res.status(400).json({ error: "No text provided" });
    if (!GEMINI_API_KEY) return res.status(503).json({ error: "AI service unavailable" });

    const prompt = `
Farmer Query: "${text}"
${cropInfo ? `Crop Info: ${cropInfo}` : ""}
${symptoms ? `Symptoms: ${symptoms}` : ""}
Respond in JSON:
{
  "analysis": "Detailed analysis",
  "possibleCauses": ["Cause 1"],
  "immediateActions": ["Action 1"],
  "treatment": { "organic": "Neem oil", "chemical": "Fungicide" },
  "prevention": "Prevention tips",
  "expertAdvice": "Consult expert if needed",
  "generalCare": "General advice"
}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      }
    );

    const data = await response.json();
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { analysis: aiText };

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: "Voice analysis failed", message: err.message });
  }
});

// AI Chatbot
router.post("/chatbot", async (req, res) => {
  try {
    const { message, conversationHistory } = req.body;
    if (!message) return res.status(400).json({ error: "No message provided" });
    if (!GEMINI_API_KEY) return res.status(503).json({ error: "AI service unavailable" });

    const historyText = conversationHistory?.length
      ? `Previous chat:\n${conversationHistory.slice(-3).map(m => `${m.sender}: ${m.text}`).join('\n')}\n\n`
      : "";

    const prompt = `${historyText}Farmer question: "${message}"\nRespond in JSON format:\n{ "response": "Answer", "suggestions": ["Tip 1", "Tip 2"] }`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      }
    );

    const data = await response.json();
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    const chatbotResponse = jsonMatch ? JSON.parse(jsonMatch[0]) : { response: aiText, suggestions: [] };

    res.json({ success: true, ...chatbotResponse, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Chatbot error", message: err.message });
  }
});

// AI Crop Recommendation
router.post("/crop-recommendation", async (req, res) => {
  try {
    const { location, soilType, climate, season, landSize, waterSource, budget, experience, purpose } = req.body;
    if (!GEMINI_API_KEY) return res.status(503).json({ error: "AI service unavailable" });

    const prompt = `Farm details: Location ${location}, Soil ${soilType}, Climate ${climate}, Season ${season}, Land ${landSize} acres, Water ${waterSource}, Budget ${budget}, Experience ${experience}, Purpose ${purpose}.
Return JSON format:
{
  "topCrops": [{ "name": "Crop", "matchScore": 90, "reason": "Why", "duration": "90d", "estimatedCost": "10000", "expectedYield": "20 quintals" }],
  "alternativeCrops": [{ "name": "Alt Crop", "matchScore": 75, "reason": "Why" }],
  "tips": ["Tip 1", "Tip 2"],
  "soilPreparation": "Advice",
  "waterManagement": "Advice",
  "fertilizerRecommendation": "Advice"
}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      }
    );

    const data = await response.json();
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { topCrops: [], tips: [] };

    res.json({ success: true, ...result, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Recommendation failed", message: err.message });
  }
});

module.exports = router;
