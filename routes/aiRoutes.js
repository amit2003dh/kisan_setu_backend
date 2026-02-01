const router = require("express").Router();
const multer = require("multer");
const fetch = require("node-fetch");
const path = require("path");

const upload = multer({ dest: "uploads/" });

// Check API key availability
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (GEMINI_API_KEY) {
  console.log(" Gemini API key loaded for Crop Doctor");
} else {
  console.warn(" GEMINI_API_KEY not found in environment variables");
}

// TensorFlow model integration (temporarily disabled)
// const tf = require('@tensorflow/tfjs-node');
let cropModel = null;
let classIndices = null;

// Load TensorFlow model on startup (temporarily disabled)
const loadTensorFlowModel = async () => {
  try {
    console.log("🤖 TensorFlow integration temporarily disabled - using Gemini API only");
    // const modelPath = path.join(__dirname, '../ai/crop_disease_model.h5');
    // const classIndexPath = path.join(__dirname, '../ai/class_indices.json');
    
    // Check if model files exist
    // const fs = require('fs');
    // if (fs.existsSync(modelPath) && fs.existsSync(classIndexPath)) {
    //   console.log(" Loading TensorFlow model for offline disease detection...");
    //   cropModel = await tf.loadLayersModel('file://' + modelPath);
    //   classIndices = JSON.parse(fs.readFileSync(classIndexPath, 'utf8'));
    //   console.log(" TensorFlow model loaded successfully");
    // } else {
    //   console.log(" TensorFlow model files not found, using only Gemini API");
    // }
  } catch (error) {
    console.error(" Error loading TensorFlow model:", error.message);
    console.log(" Falling back to Gemini API only");
  }
};

// Initialize model on startup (temporarily disabled)
// loadTensorFlowModel();

// TensorFlow prediction function
const predictWithTensorFlow = async (imagePath) => {
  if (!cropModel || !classIndices) {
    return null;
  }

  try {
    // Read and preprocess image
    const fs = require('fs');
    const imageBuffer = fs.readFileSync(imagePath);
    
    // Convert image to tensor
    const decoded = tf.node.decodeImage(imageBuffer, 3);
    const resized = tf.image.resizeBilinear(decoded, [224, 224]);
    const normalized = resized.div(255.0);
    const batched = normalized.expandDims(0);
    
    // Make prediction
    const prediction = await cropModel.predict(batched).data();
    const maxIndex = prediction.indexOf(Math.max(...prediction));
    
    // Get class name
    const classes = Object.keys(classIndices);
    const disease = classes[maxIndex] || "Unknown";
    
    // Calculate confidence
    const confidence = (Math.max(...prediction) * 100).toFixed(1);
    
    return {
      disease,
      confidence: confidence > 50 ? "High" : confidence > 30 ? "Medium" : "Low",
      severity: confidence > 70 ? "High" : confidence > 40 ? "Medium" : "Low",
      method: "TensorFlow"
    };
  } catch (error) {
    console.error(" TensorFlow prediction error:", error.message);
    return null;
  }
};

router.post("/crop-doctor", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: "No image provided",
      message: "Please upload an image file"
    });
  }

  try {
    const fs = require("fs");
    const imagePath = req.file.path;
    let analysisResult = null;
    let analysisMethod = "Unknown";

    // First try TensorFlow model (offline, faster)
    console.log("🤖 Trying TensorFlow model for disease detection...");
    const tfResult = await predictWithTensorFlow(imagePath);
    
    if (tfResult) {
      console.log("✅ TensorFlow prediction successful:", tfResult);
      analysisResult = {
        disease: tfResult.disease,
        severity: tfResult.severity,
        symptoms: `Detected ${tfResult.disease} using AI analysis. Please observe your crop for specific symptoms like leaf spots, discoloration, or wilting.`,
        treatment: `For ${tfResult.disease}, consider using appropriate organic or chemical treatments. Consult with local agricultural experts for specific recommendations.`,
        prevention: "Regular crop monitoring, proper irrigation, and maintaining soil health can help prevent diseases.",
        expertAdvice: "If symptoms persist or worsen, consult with an agricultural expert immediately.",
        confidence: tfResult.confidence
      };
      analysisMethod = "TensorFlow";
    } else if (GEMINI_API_KEY) {
      // Fallback to Gemini API if TensorFlow fails
      console.log("🌐 Falling back to Gemini API...");
      
      // Convert image to base64
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      
      // Create prompt for Gemini AI
      const prompt = `
You are an expert agriculture scientist and crop disease specialist. Analyze this crop image and provide a comprehensive report.

Please analyze the image and provide:
1. Disease Name (if any disease is detected)
2. Severity Level (Low, Medium, High)
3. Symptoms Description
4. Detailed Treatment Recommendations
5. Prevention Tips
6. When to Consult an Expert

Format your response as a JSON object:
{
  "disease": "Disease Name or 'Healthy'",
  "severity": "Low|Medium|High",
  "symptoms": "Detailed symptoms description",
  "treatment": "Step-by-step treatment recommendations",
  "prevention": "Prevention tips",
  "expertAdvice": "When to consult an agricultural expert",
  "confidence": "High|Medium|Low"
}

If the crop appears healthy, respond with "Healthy" as the disease and provide general crop care advice.

Important: Be specific and practical in your recommendations. Use simple language that farmers can understand.
`;

      // Call Gemini Vision API
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt
                  },
                  {
                    inline_data: {
                      mime_type: "image/jpeg",
                      data: base64Image
                    }
                  }
                ]
              }
            ]
          })
        }
      );

      const data = await response.json();

      if (!data.candidates || data.candidates.length === 0) {
        throw new Error("Gemini API returned no results");
      }

      const aiResponse = data.candidates[0].content.parts[0].text;
      
      // Try to parse JSON response
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysisResult = JSON.parse(jsonMatch[0]);
        } else {
          // Fallback if no JSON found
          analysisResult = {
            disease: "Unknown",
            severity: "Medium",
            symptoms: aiResponse,
            treatment: "Please consult with an agricultural expert for specific treatment recommendations.",
            prevention: "Regular crop monitoring and proper irrigation can help prevent diseases.",
            expertAdvice: "Consult with local agricultural expert if symptoms persist.",
            confidence: "Medium"
          };
        }
      } catch (parseError) {
        console.error("Error parsing AI response:", parseError);
        analysisResult = {
          disease: "Analysis Error",
          severity: "Medium",
          symptoms: "Could not analyze the image properly.",
          treatment: "Please try uploading a clearer image or consult with an agricultural expert.",
          prevention: "Ensure good image quality and proper lighting for better analysis.",
          expertAdvice: "If the issue persists, please contact an agricultural expert.",
          confidence: "Low"
        };
      }
      
      analysisMethod = "Gemini";
    } else {
      // No AI methods available
      throw new Error("No AI methods available");
    }

    // Clean up uploaded file
    fs.unlinkSync(imagePath);

    res.json({
      success: true,
      ...analysisResult,
      analysisMethod,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Crop doctor error:", error);
    
    // Clean up uploaded file on error
    const fs = require("fs");
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      error: "Analysis failed",
      message: error.message || "Failed to analyze image. Please try again.",
      disease: "Analysis failed",
      solution: "Please try uploading the image again or contact support.",
      analysisMethod: "Error"
    });
  }
});

// Voice assistance for crop doctor
router.post("/crop-doctor-voice", async (req, res) => {
  try {
    const { text, cropInfo, symptoms } = req.body;

    if (!text) {
      return res.status(400).json({
        error: "No text provided",
        message: "Please provide your crop issue description"
      });
    }

    if (!GEMINI_API_KEY) {
      return res.status(503).json({
        error: "AI service not available",
        message: "Voice assistance is currently unavailable. Please try again later."
      });
    }

    // Create enhanced prompt for crop doctor voice assistance
    const prompt = `
You are an expert agriculture scientist and crop disease specialist. A farmer is asking for help with their crop.

Farmer's Query: "${text}"
${cropInfo ? `Crop Information: ${cropInfo}` : ""}
${symptoms ? `Symptoms: ${symptoms}` : ""}

Please provide a comprehensive and helpful response in the same language as the query (Hindi or English). Include:

1. Possible diseases or issues based on the description
2. Immediate actions the farmer should take
3. Treatment recommendations (organic and chemical options)
4. Prevention measures
5. When to consult an expert
6. General crop care advice

Format your response as a JSON object:
{
  "analysis": "Detailed analysis of the issue",
  "possibleCauses": ["Cause 1", "Cause 2"],
  "immediateActions": ["Action 1", "Action 2"],
  "treatment": {
    "organic": "Organic treatment recommendations",
    "chemical": "Chemical treatment options"
  },
  "prevention": "Prevention measures",
  "expertAdvice": "When to consult an expert",
  "generalCare": "General crop care tips"
}

Be practical and specific in your recommendations. Use simple language that farmers can understand and implement.
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!data.candidates || data.candidates.length === 0) {
      return res.status(500).json({
        error: "AI analysis failed",
        message: "Could not process your request. Please try again."
      });
    }

    const aiResponse = data.candidates[0].content.parts[0].text;
    
    // Try to parse JSON response
    let analysisResult;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback if no JSON found
        analysisResult = {
          analysis: aiResponse,
          possibleCauses: ["Could not determine specific causes"],
          immediateActions: ["Monitor your crop closely", "Take photos if symptoms worsen"],
          treatment: {
            organic: "Use neem oil spray as a preventive measure",
            chemical: "Consult with local agricultural expert for chemical options"
          },
          prevention: "Regular monitoring and proper irrigation",
          expertAdvice: "Consult expert if symptoms persist or worsen",
          generalCare: "Maintain proper irrigation and nutrient balance"
        };
      }
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      analysisResult = {
        analysis: "Could not process the request properly",
        possibleCauses: ["Insufficient information"],
        immediateActions: ["Provide more details about the issue"],
        treatment: {
          organic: "Use organic pesticides as a first line of defense",
          chemical: "Consult with agricultural expert for chemical treatments"
        },
        prevention: "Regular crop monitoring",
        expertAdvice: "Please consult with local agricultural expert",
        generalCare: "Maintain proper crop care practices"
      };
    }

    res.json({
      success: true,
      ...analysisResult,
      aiResponse: aiResponse
    });

  } catch (error) {
    console.error("Crop doctor voice error:", error);
    res.status(500).json({
      error: "Voice analysis failed",
      message: error.message || "Failed to process your request. Please try again."
    });
  }
});

// AI Chatbot for general farming assistance
router.post("/chatbot", async (req, res) => {
  try {
    const { message, conversationHistory } = req.body;

    if (!message) {
      return res.status(400).json({
        error: "No message provided",
        message: "Please provide your question"
      });
    }

    if (!GEMINI_API_KEY) {
      return res.status(503).json({
        error: "AI service not available",
        message: "Chatbot is currently unavailable. Please try again later."
      });
    }

    // Create context-aware prompt for farming assistant
    const conversationContext = conversationHistory && conversationHistory.length > 0
      ? `Previous conversation:\n${conversationHistory.slice(-3).map(msg => `${msg.sender}: ${msg.text}`).join('\n')}\n\n`
      : "";

    const prompt = `
You are an expert AI farming assistant with deep knowledge of agriculture, crop management, pest control, irrigation, soil science, and sustainable farming practices. You communicate in a friendly, helpful, and practical manner.

${conversationContext}Current farmer question: "${message}"

Please provide a comprehensive and helpful response that includes:
1. Direct answer to the question
2. Practical advice that farmers can implement
3. Specific recommendations when applicable
4. Safety considerations
5. Follow-up questions if more information is needed

Be conversational and empathetic. Use simple language that farmers can easily understand. Include relevant emojis to make the conversation friendly.

If you need more information to give a better answer, ask clarifying questions.

Format your response as a JSON object:
{
  "response": "Your detailed response here",
  "suggestions": ["Suggestion 1", "Suggestion 2", "Suggestion 3"]
}

Important: Be practical, specific, and actionable in your advice.
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!data.candidates || data.candidates.length === 0) {
      return res.status(500).json({
        error: "AI response failed",
        message: "Could not process your request. Please try again."
      });
    }

    const aiResponse = data.candidates[0].content.parts[0].text;
    
    // Try to parse JSON response
    let chatbotResponse;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        chatbotResponse = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback if no JSON found
        chatbotResponse = {
          response: aiResponse,
          suggestions: [
            "Ask about specific crop diseases",
            "Get irrigation advice",
            "Learn about soil preparation",
            "Ask about pest control methods"
          ]
        };
      }
    } catch (parseError) {
      console.error("Error parsing chatbot response:", parseError);
      chatbotResponse = {
        response: aiResponse,
        suggestions: [
          "Try asking about crop management",
          "Get pest control advice",
          "Learn about irrigation techniques",
          "Ask about soil health"
        ]
      };
    }

    res.json({
      success: true,
      ...chatbotResponse,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Chatbot error:", error);
    res.status(500).json({
      error: "Chatbot error",
      message: error.message || "Failed to process your request. Please try again."
    });
  }
});

// AI Crop Recommendation
router.post("/crop-recommendation", async (req, res) => {
  try {
    const {
      location,
      soilType,
      climate,
      season,
      landSize,
      waterSource,
      budget,
      experience,
      purpose
    } = req.body;

    if (!GEMINI_API_KEY) {
      return res.status(503).json({
        error: "AI service not available",
        message: "Crop recommendations are currently unavailable. Please try again later."
      });
    }

    // Create comprehensive prompt for crop recommendations
    const prompt = `
You are an expert agricultural scientist and crop advisor with deep knowledge of Indian agriculture, soil science, climatology, and modern farming practices.

FARM DETAILS:
- Location: ${location}
- Soil Type: ${soilType}
- Climate: ${climate}
- Season: ${season}
- Land Size: ${landSize ? landSize + ' acres' : 'Not specified'}
- Water Source: ${waterSource || 'Not specified'}
- Budget: ${budget ? '₹' + budget + ' per acre' : 'Not specified'}
- Experience Level: ${experience || 'Not specified'}
- Farming Purpose: ${purpose}

Based on these farm conditions, please provide detailed crop recommendations. Consider factors like:
1. Soil suitability and crop compatibility
2. Climate and seasonal appropriateness
3. Water requirements and availability
4. Market demand and profitability
5. Farmer's experience level
6. Budget constraints
7. Farming purpose (commercial/subsistence)

Format your response as a JSON object:
{
  "topCrops": [
    {
      "name": "Crop Name",
      "matchScore": 95,
      "reason": "Why this crop is highly recommended",
      "duration": "90-120 days",
      "estimatedCost": "15000",
      "expectedYield": "15-20 quintals/acre",
      "waterRequirement": "Medium",
      "marketDemand": "High"
    }
  ],
  "alternativeCrops": [
    {
      "name": "Alternative Crop",
      "matchScore": 80,
      "reason": "Why this is a good alternative"
    }
  ],
  "tips": [
    "Specific farming tip 1",
    "Specific farming tip 2",
    "Specific farming tip 3"
  ],
  "soilPreparation": "Soil preparation recommendations",
  "waterManagement": "Water management advice",
  "fertilizerRecommendation": "Fertilizer suggestions"
}

Important: Be specific, practical, and regionally relevant. Consider local market conditions and traditional farming practices. Provide realistic yield expectations and cost estimates.
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!data.candidates || data.candidates.length === 0) {
      return res.status(500).json({
        error: "AI analysis failed",
        message: "Could not generate recommendations. Please try again."
      });
    }

    const aiResponse = data.candidates[0].content.parts[0].text;
    
    // Try to parse JSON response
    let recommendations;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        recommendations = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback if no JSON found
        recommendations = {
          topCrops: [
            {
              name: "Wheat",
              matchScore: 85,
              reason: "Suitable for your soil type and climate conditions",
              duration: "90-120 days",
              estimatedCost: "12000",
              expectedYield: "20-25 quintals/acre"
            },
            {
              name: "Rice",
              matchScore: 75,
              reason: "Good water availability and suitable climate",
              duration: "120-150 days",
              estimatedCost: "15000",
              expectedYield: "25-30 quintals/acre"
            }
          ],
          alternativeCrops: [
            {
              name: "Pulses",
              matchScore: 70,
              reason: "Good for soil fertility and market demand"
            }
          ],
          tips: [
            "Test soil pH before planting",
            "Consider crop rotation for better yield",
            "Use organic fertilizers for better soil health"
          ]
        };
      }
    } catch (parseError) {
      console.error("Error parsing recommendations:", parseError);
      recommendations = {
        topCrops: [
          {
            name: "Consult Local Expert",
            matchScore: 60,
            reason: "AI analysis failed, please consult with local agricultural expert",
            duration: "Varies",
            estimatedCost: "Varies",
            expectedYield: "Varies"
          }
        ],
        alternativeCrops: [],
        tips: [
          "Contact your local agricultural department",
          "Visit nearby farms for practical knowledge",
          "Consider soil testing for better recommendations"
        ]
      };
    }

    res.json({
      success: true,
      ...recommendations,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Crop recommendation error:", error);
    res.status(500).json({
      error: "Recommendation failed",
      message: error.message || "Failed to generate recommendations. Please try again."
    });
  }
});

module.exports = router;
