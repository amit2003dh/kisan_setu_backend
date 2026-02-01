require("dotenv").config();
const express = require("express");
const multer = require("multer");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const fsPromises = fs.promises;
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const port = process.env.PORT || 5000;

// Configure multer
const upload = multer({ dest: "upload/" });
app.use(express.json({ limit: "10mb" }));

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
app.use(express.static("public"));

// Routes
// Analyze crop
app.post("/api/crop-analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file uploaded" });
    }

    const imagePath = req.file.path;
    const imageData = await fsPromises.readFile(imagePath, {
      encoding: "base64",
    });

    // Use the Gemini model to analyze the crop image
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
    
    try {
      const result = await model.generateContent([
        `Analyze this crop image for diseases and provide detailed information in JSON format. 
        
        Return a JSON response with the following structure:
        {
          "disease": "disease name or 'Healthy Plant'",
          "confidence": 0.85,
          "severity": "Mild/Moderate/Severe/Healthy",
          "recommendations": ["treatment1", "treatment2", "treatment3", "treatment4", "treatment5"],
          "healthy": false,
          "alternative_diseases": [{"name": "alternative1", "confidence": 0.10}, {"name": "alternative2", "confidence": 0.05}],
          "cropType": "detected crop type",
          "affectedArea": "estimated percentage",
          "spreadRisk": "Low/Medium/High/None",
          "treatmentCost": "estimated cost in INR per acre",
          "preventionTips": ["tip1", "tip2", "tip3", "tip4"]
        }
        
        Please analyze the image and provide realistic agricultural advice. If the plant appears healthy, indicate that. Respond only with valid JSON.`,
        {
          inlineData: {
            mimeType: req.file.mimetype,
            data: imageData,
          },
        },
      ]);

      const cropInfo = result.response.text();
      console.log('Raw AI Response:', cropInfo);

      // Parse the JSON response
      let analysisResult;
      try {
        // Try to parse JSON directly
        analysisResult = JSON.parse(cropInfo);
        console.log('Parsed JSON successfully:', analysisResult);
      } catch (e) {
        console.log('Direct JSON parse failed, trying to extract JSON from text');
        // If direct parsing fails, try to extract JSON from text
        const jsonMatch = cropInfo.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysisResult = JSON.parse(jsonMatch[0]);
          console.log('Extracted JSON successfully:', analysisResult);
        } else {
          console.log('Could not extract JSON, providing fallback response');
          throw new Error('Could not parse AI response');
        }
      }

    } catch (error) {
      console.error('Gemini API Error:', error);
      
      // Check if it's an API key error
      if (error.message.includes('API_KEY') || error.message.includes('403')) {
        return res.status(500).json({ 
          error: "Gemini API key is not configured or is invalid. Please check your GEMINI_API_KEY environment variable." 
        });
      }
      
      // Check if it's a quota error
      if (error.message.includes('quota') || error.message.includes('429')) {
        return res.status(429).json({ 
          error: "API quota exceeded. Please try again later." 
        });
      }
      
      // Generic error
      return res.status(500).json({ 
        error: "Failed to analyze image with AI service. Please try again." 
      });
    }

    // Validate and ensure required fields
    const validatedResult = {
      disease: analysisResult.disease || "Unknown Disease",
      confidence: Math.min(0.98, Math.max(0.5, analysisResult.confidence || 0.75)),
      severity: analysisResult.severity || "Moderate",
      recommendations: analysisResult.recommendations || [
        "Consult with local agricultural expert",
        "Monitor the plant closely",
        "Consider soil testing",
        "Review irrigation practices",
        "Document symptoms for future reference"
      ],
      healthy: analysisResult.healthy !== undefined ? analysisResult.healthy : (analysisResult.disease === "Healthy Plant"),
      alternative_diseases: analysisResult.alternative_diseases || [],
      cropType: analysisResult.cropType || "Unknown",
      affectedArea: analysisResult.affectedArea || "Unknown",
      spreadRisk: analysisResult.spreadRisk || "Medium",
      treatmentCost: analysisResult.treatmentCost || "Varies",
      preventionTips: analysisResult.preventionTips || [
        "Maintain proper plant spacing",
        "Monitor regularly for early detection",
        "Use disease-resistant varieties when possible",
        "Practice crop rotation"
      ]
    };

    // Clean up: delete the uploaded file
    await fsPromises.unlink(imagePath);

    // Respond with the analysis result and the image data
    res.json({
      result: validatedResult,
      image: `data:${req.file.mimetype};base64,${imageData}`,
    });
  } catch (error) {
    console.error("Error analyzing image:", error);
    res
      .status(500)
      .json({ error: "An error occurred while analyzing the image" });
  }
});

// Download PDF report
app.post("/api/download-crop-report", express.json(), async (req, res) => {
  const { result, image } = req.body;
  try {
    // Ensure the reports directory exists
    const reportsDir = path.join(__dirname, "reports");
    await fsPromises.mkdir(reportsDir, { recursive: true });
    
    // Generate PDF
    const filename = `crop_analysis_report_${Date.now()}.pdf`;
    const filePath = path.join(reportsDir, filename);
    const writeStream = fs.createWriteStream(filePath);
    const doc = new PDFDocument();
    doc.pipe(writeStream);
    
    // Add content to the PDF
    doc.fontSize(24).text("Crop Analysis Report", {
      align: "center",
    });
    doc.moveDown();
    doc.fontSize(14).text(`Date: ${new Date().toLocaleDateString()}`);
    doc.moveDown();
    doc.fontSize(16).text(`Disease: ${result.disease}`, { align: "left" });
    doc.moveDown();
    doc.fontSize(14).text(`Severity: ${result.severity}`, { align: "left" });
    doc.moveDown();
    doc.fontSize(14).text(`Confidence: ${(result.confidence * 100).toFixed(1)}%`, { align: "left" });
    doc.moveDown();
    doc.fontSize(14).text(`Crop Type: ${result.cropType}`, { align: "left" });
    doc.moveDown();
    doc.fontSize(14).text(`Affected Area: ${result.affectedArea}`, { align: "left" });
    doc.moveDown();
    doc.fontSize(14).text(`Spread Risk: ${result.spreadRisk}`, { align: "left" });
    doc.moveDown();
    doc.fontSize(14).text(`Treatment Cost: ${result.treatmentCost}`, { align: "left" });
    doc.moveDown();
    
    doc.fontSize(16).text("Treatment Recommendations:", { align: "left" });
    doc.moveDown();
    result.recommendations.forEach((rec, index) => {
      doc.fontSize(12).text(`${index + 1}. ${rec}`, { align: "left" });
      doc.moveDown(0.5);
    });
    
    doc.moveDown();
    doc.fontSize(16).text("Prevention Tips:", { align: "left" });
    doc.moveDown();
    result.preventionTips.forEach((tip, index) => {
      doc.fontSize(12).text(`${index + 1}. ${tip}`, { align: "left" });
      doc.moveDown(0.5);
    });
    
    // Insert image to the PDF
    if (image) {
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      doc.moveDown();
      doc.image(buffer, {
        fit: [500, 300],
        align: "center",
        valign: "center",
      });
    }
    
    doc.end();
    
    // Wait for the PDF to be created
    await new Promise((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });
    
    res.download(filePath, (err) => {
      if (err) {
        res.status(500).json({ error: "Error downloading the PDF report" });
      }
      fsPromises.unlink(filePath);
    });
  } catch (error) {
    console.error("Error generating PDF report:", error);
    res
      .status(500)
      .json({ error: "An error occurred while generating the PDF report" });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Crop analysis server listening on port ${port}`);
});
