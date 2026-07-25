const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Crop = require("../models/Crop");
const ProductTracker = require("../models/ProductTracker");
const authMiddleware = require("../middleware/auth");
const adminMiddleware = require("../middleware/admin");

const uploadDir = "uploads/crops";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `crop-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isValid = /jpeg|jpg|png|gif|webp/.test(path.extname(file.originalname).toLowerCase());
    cb(isValid ? null : new Error("Only image files are allowed"), isValid);
  }
});

// Add Crop
router.post("/add", authMiddleware, upload.single("image"), async (req, res) => {
  try {
    const cropData = { ...req.body, sellerId: req.userId, type: "crop" };
    let imagesArray = [];

    if (req.file) imagesArray.push(`/uploads/crops/${req.file.filename}`);
    if (req.body.images) {
      try {
        const parsed = JSON.parse(req.body.images);
        if (Array.isArray(parsed)) imagesArray = [...imagesArray, ...parsed];
      } catch (e) {
        console.error("Error parsing images array:", e);
      }
    }
    cropData.images = imagesArray;

    if (req.body.primaryImageIndex) cropData.primaryImageIndex = parseInt(req.body.primaryImageIndex) || 0;
    if (cropData.quantity) cropData.quantity = parseFloat(cropData.quantity);
    if (cropData.price) cropData.price = parseFloat(cropData.price);

    ["location", "contactInfo"].forEach(key => {
      if (cropData[key]) {
        try { cropData[key] = JSON.parse(cropData[key]); } catch (e) {}
      }
    });

    const crop = new Crop(cropData);
    await crop.save();
    res.json(crop);
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: "Failed to add crop", message: err.message });
  }
});

// Get all crops (optional sellerId filter)
router.get("/", async (req, res) => {
  try {
    const { sellerId } = req.query;
    const query = sellerId ? { sellerId } : {};
    const crops = await Crop.find(query).sort({ createdAt: -1 });
    res.json(crops);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch crops", message: err.message });
  }
});

// Get crops for current user
router.get("/my-crops", authMiddleware, async (req, res) => {
  try {
    const crops = await Crop.find({ sellerId: req.userId }).sort({ createdAt: -1 });
    res.json(crops);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch your crops", message: err.message });
  }
});

// Update crop
router.put("/:id", authMiddleware, upload.single("image"), async (req, res) => {
  try {
    const crop = await Crop.findOne({ _id: req.params.id, sellerId: req.userId });
    if (!crop) return res.status(404).json({ error: "Crop not found or unauthorized" });

    const updateData = { ...req.body };

    if (req.body.images) {
      try { updateData.images = JSON.parse(req.body.images); } catch (e) {}
    }
    if (req.body.primaryImageIndex !== undefined) {
      updateData.primaryImageIndex = Number(req.body.primaryImageIndex);
    }
    if (req.file) {
      const current = crop.images || [];
      updateData.images = [...current, `/uploads/crops/${req.file.filename}`];
    }

    if (updateData.quantity !== undefined) updateData.quantity = parseFloat(updateData.quantity);
    if (updateData.price !== undefined) updateData.price = parseFloat(updateData.price);

    ["location", "contactInfo"].forEach(key => {
      if (updateData[key]) {
        try { updateData[key] = JSON.parse(updateData[key]); } catch (e) {}
      }
    });

    if (updateData.quantity === 0) {
      updateData.status = "Out of Stock";
    } else if (updateData.quantity > 0 && crop.status === "Out of Stock") {
      updateData.status = "Available";
    }

    const updatedCrop = await Crop.findByIdAndUpdate(req.params.id, updateData, { new: true });

    await ProductTracker.findOneAndUpdate(
      { productId: req.params.id, productType: "Crop", sellerId: req.userId },
      {
        $push: {
          trackingEvents: {
            eventType: "updated",
            description: "Crop information updated",
            metadata: { oldQuantity: crop.quantity, newQuantity: updateData.quantity, oldPrice: crop.price, newPrice: updateData.price }
          }
        },
        lastUpdated: new Date()
      },
      { upsert: true }
    );

    res.json(updatedCrop);
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: "Failed to update crop", message: err.message });
  }
});

// Update crop status
router.put("/:id/status", authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const crop = await Crop.findOne({ _id: req.params.id, sellerId: req.userId });
    if (!crop) return res.status(404).json({ error: "Crop not found or unauthorized" });

    if (crop.quantity === 0 && status !== "Out of Stock") {
      return res.status(400).json({ error: "Cannot change status", message: "Quantity is zero" });
    }

    const updatedCrop = await Crop.findByIdAndUpdate(req.params.id, { status }, { new: true });

    await ProductTracker.findOneAndUpdate(
      { productId: req.params.id, productType: "Crop", sellerId: req.userId },
      {
        $push: {
          trackingEvents: {
            eventType: "updated",
            description: `Crop status changed to ${status}`,
            metadata: { oldStatus: crop.status, newStatus: status }
          }
        },
        lastUpdated: new Date()
      },
      { upsert: true }
    );

    res.json(updatedCrop);
  } catch (err) {
    res.status(500).json({ error: "Failed to update crop status", message: err.message });
  }
});

// Delete crop
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const crop = await Crop.findOne({ _id: req.params.id, sellerId: req.userId });
    if (!crop) return res.status(404).json({ error: "Crop not found or unauthorized" });

    if (crop.image && fs.existsSync(crop.image.replace("/uploads/", "uploads/"))) {
      fs.unlinkSync(crop.image.replace("/uploads/", "uploads/"));
    }

    await Crop.findByIdAndDelete(req.params.id);

    await ProductTracker.findOneAndUpdate(
      { productId: req.params.id, productType: "Crop", sellerId: req.userId },
      {
        $push: {
          trackingEvents: {
            eventType: "updated",
            description: "Crop deleted",
            metadata: { cropName: crop.name }
          }
        },
        currentStatus: "deleted",
        lastUpdated: new Date()
      },
      { upsert: true }
    );

    res.json({ success: true, message: "Crop deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete crop", message: err.message });
  }
});

// Decrease crop quantity on order
router.put("/:id/decrease-quantity", authMiddleware, async (req, res) => {
  try {
    const { quantity } = req.body;
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: "Invalid quantity" });
    }

    const crop = await Crop.findById(req.params.id);
    if (!crop) return res.status(404).json({ error: "Crop not found" });

    if (crop.quantity < quantity) {
      return res.status(400).json({ error: "Insufficient quantity", message: `Only ${crop.quantity} kg available` });
    }

    const newQuantity = crop.quantity - quantity;
    const newStatus = newQuantity === 0 ? "Out of Stock" : crop.status;

    const updatedCrop = await Crop.findByIdAndUpdate(
      req.params.id,
      { quantity: newQuantity, status: newStatus },
      { new: true }
    );

    await ProductTracker.findOneAndUpdate(
      { productId: req.params.id, productType: "Crop", sellerId: crop.sellerId },
      {
        $inc: { totalOrders: 1, totalRevenue: quantity * crop.price },
        $push: {
          trackingEvents: {
            eventType: "ordered",
            description: `${quantity} kg ordered`,
            metadata: { quantity, price: crop.price, revenue: quantity * crop.price, remainingQuantity: newQuantity }
          }
        },
        currentStatus: newStatus,
        lastUpdated: new Date()
      },
      { upsert: true }
    );

    res.json(updatedCrop);
  } catch (err) {
    res.status(500).json({ error: "Failed to decrease quantity", message: err.message });
  }
});

// Admin verify crop
router.put("/:id/verify", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { verified } = req.body;
    const crop = await Crop.findById(req.params.id);
    if (!crop) return res.status(404).json({ error: "Crop not found" });

    crop.verified = Boolean(verified);
    await crop.save();

    res.json({ success: true, message: `Crop ${verified ? "verified" : "unverified"} successfully`, crop });
  } catch (err) {
    res.status(500).json({ error: "Failed to update verification status", message: err.message });
  }
});

module.exports = router;
