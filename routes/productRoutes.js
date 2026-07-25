const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Product = require("../models/Product");
const authMiddleware = require("../middleware/auth");
const adminMiddleware = require("../middleware/admin");

const uploadDir = "uploads/products";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `product-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isValid = /jpeg|jpg|png|webp/.test(file.mimetype);
    cb(isValid ? null : new Error("Only image files allowed"), isValid);
  }
});

// Add Product
router.post("/add", authMiddleware, upload.single("image"), async (req, res) => {
  try {
    const stockNum = Number(req.body.stock) || 0;
    const productData = {
      sellerId: req.userId,
      name: req.body.name,
      type: req.body.type,
      price: Number(req.body.price),
      stock: stockNum,
      suitableCrops: req.body.crop ? [req.body.crop] : [],
      description: req.body.description,
      status: stockNum > 0 ? "Available" : "Out of Stock",
      verified: false,
      location: req.body.location ? JSON.parse(req.body.location) : undefined,
      contactInfo: req.body.contactInfo ? JSON.parse(req.body.contactInfo) : undefined
    };

    if (req.file) {
      productData.images = [`/uploads/products/${req.file.filename}`];
    }

    const product = new Product(productData);
    await product.save();
    res.json(product);
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message });
  }
});

// Get all products
router.get("/", async (req, res) => {
  try {
    const query = req.query.sellerId ? { sellerId: req.query.sellerId } : { status: "Available" };
    const products = await Product.find(query).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get seller's own products
router.get("/my-products", authMiddleware, async (req, res) => {
  try {
    const products = await Product.find({ sellerId: req.userId }).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single product
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update product (JSON)
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, sellerId: req.userId });
    if (!product) return res.status(404).json({ error: "Product not found" });

    const updateData = { ...req.body };
    if (updateData.primaryImageIndex !== undefined) {
      updateData.primaryImageIndex = Number(updateData.primaryImageIndex);
    }
    if (updateData.stock !== undefined) {
      updateData.status = updateData.stock > 0 ? "Available" : "Out of Stock";
    }

    const updated = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update product with image (FormData)
router.put("/:id/with-image", authMiddleware, upload.single("image"), async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, sellerId: req.userId });
    if (!product) return res.status(404).json({ error: "Product not found" });

    const updateData = { ...req.body };

    if (updateData.price) updateData.price = Number(updateData.price);
    if (updateData.stock) updateData.stock = Number(updateData.stock);
    if (updateData.minimumOrder) updateData.minimumOrder = Number(updateData.minimumOrder);

    if (updateData.stock !== undefined) {
      updateData.status = updateData.stock > 0 ? "Available" : "Out of Stock";
    }

    if (req.file) {
      const currentImages = product.images || [];
      updateData.images = [...currentImages, `/uploads/products/${req.file.filename}`];
    } else if (req.body.images) {
      try { updateData.images = JSON.parse(req.body.images); } catch (e) {}
    }

    if (req.body.primaryImageIndex !== undefined) {
      updateData.primaryImageIndex = Number(req.body.primaryImageIndex);
    }

    ["location", "contactInfo", "suitableCrops"].forEach(key => {
      if (req.body[key] && typeof req.body[key] === "string") {
        try { updateData[key] = JSON.parse(req.body[key]); } catch (e) {}
      }
    });

    const updated = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.json(updated);
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message });
  }
});

// Update product status
router.put("/:id/status", authMiddleware, async (req, res) => {
  try {
    const { status, verified } = req.body;
    const product = await Product.findOne({ _id: req.params.id, sellerId: req.userId });
    if (!product) return res.status(404).json({ error: "Product not found" });

    if (verified !== undefined) {
      product.verified = Boolean(verified);
      await product.save();
      return res.json(product);
    }

    if (status !== undefined) {
      if (product.stock === 0 && status !== "Out of Stock") {
        return res.status(400).json({ error: "Cannot change status when stock is zero" });
      }
      const updatedProduct = await Product.findByIdAndUpdate(req.params.id, { status }, { new: true });
      return res.json(updatedProduct);
    }

    res.status(400).json({ error: "No valid status provided" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin verify product
router.put("/:id/verify", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { verified } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    product.verified = Boolean(verified);
    await product.save();

    res.json({ success: true, message: `Product ${verified ? "verified" : "unverified"} successfully`, product });
  } catch (err) {
    res.status(500).json({ error: "Failed to update verification status", message: err.message });
  }
});

// Delete product
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, sellerId: req.userId });
    if (!product) return res.status(404).json({ error: "Product not found" });

    if (product.image) {
      const imgPath = product.image.replace("/uploads/", "uploads/");
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }

    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Decrease stock on order
router.put("/:id/decrease-stock", async (req, res) => {
  try {
    const { quantity } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    if (product.stock < quantity) {
      return res.status(400).json({ error: "Insufficient stock" });
    }

    product.stock -= quantity;
    product.status = product.stock === 0 ? "Out of Stock" : "Available";
    await product.save();

    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
