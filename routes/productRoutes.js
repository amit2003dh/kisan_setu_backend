const router = require("express").Router();
const Product = require("../models/Product");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const authMiddleware = require("../middleware/auth");
const adminMiddleware = require("../middleware/admin");

/* -------------------- MULTER CONFIG -------------------- */

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/products";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `product-${unique}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    if (allowed.test(file.mimetype)) cb(null, true);
    else cb(new Error("Only image files allowed"));
  }
});

/* -------------------- ADD PRODUCT -------------------- */

router.post("/add", authMiddleware, upload.single("image"), async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "DB not connected" });
    }

    const productData = {
      sellerId: req.userId,
      name: req.body.name,
      type: req.body.type,
      price: Number(req.body.price),
      stock: Number(req.body.stock),
      suitableCrops: req.body.crop ? [req.body.crop] : [], // Store suitable crops as array
      description: req.body.description,
      status: Number(req.body.stock) > 0 ? "Available" : "Out of Stock",
      verified: false, // Always not verified

      location: req.body.location ? JSON.parse(req.body.location) : undefined,
      contactInfo: req.body.contactInfo
        ? JSON.parse(req.body.contactInfo)
        : undefined
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

/* -------------------- GET PRODUCTS -------------------- */
/* Buyer → verified products | Seller → own products */

router.get("/", async (req, res) => {
  try {
    console.log("🔍 GET PRODUCTS - Fetching products");
    console.log("🔍 Query params:", req.query);
    
    const query = req.query.sellerId
      ? { sellerId: req.query.sellerId }
      : { status: "Available" };

    console.log("🔍 Database query:", query);
    
    const products = await Product.find(query).sort({ createdAt: -1 });
    
    console.log("✅ Products found:", products.length);
    console.log("📦 Product list:", products.map(p => ({ 
      id: p._id, 
      name: p.name, 
      type: p.type, 
      price: p.price,
      status: p.status 
    })));
    
    res.json(products);
  } catch (error) {
    console.error("❌ Get products error:", error);
    res.status(500).json({ error: error.message });
  }
});

/* -------------------- GET SINGLE PRODUCT -------------------- */

router.get("/my-products", authMiddleware, async (req, res) => {
  try {
    const products = await Product.find({ sellerId: req.userId })
      .sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    console.error("❌ Get my products error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    console.log("🔍 GET SINGLE PRODUCT - ID:", req.params.id);
    
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      console.log("❌ Product not found:", req.params.id);
      return res.status(404).json({ error: "Product not found" });
    }
    
    console.log("✅ Product found:", product);
    res.json(product);
  } catch (error) {
    console.error("❌ Get single product error:", error);
    res.status(500).json({ error: error.message });
  }
});

/* -------------------- UPDATE PRODUCT -------------------- */

// Route for updates without image (JSON)
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    console.log("🔍 Updating product (JSON):", req.params.id);
    console.log("🔍 Request body:", req.body);
    
    const product = await Product.findOne({
      _id: req.params.id,
      sellerId: req.userId
    });

    if (!product) {
      console.log("❌ Product not found");
      return res.status(404).json({ error: "Product not found" });
    }

    console.log("🔍 Found product:", product);

    // Handle JSON data
    console.log("🔍 Processing JSON data");
    let updateData = req.body;
    
    // Log images and primaryImageIndex specifically
    console.log("🔍 Images in request:", updateData.images);
    console.log("🔍 PrimaryImageIndex in request:", updateData.primaryImageIndex);
    console.log("🔍 Type of PrimaryImageIndex:", typeof updateData.primaryImageIndex);
    console.log("🔍 Current product images:", product.images);
    console.log("🔍 Current product primaryImageIndex:", product.primaryImageIndex);
    
    // Ensure primaryImageIndex is a number
    if (updateData.primaryImageIndex !== undefined) {
      updateData.primaryImageIndex = Number(updateData.primaryImageIndex);
      console.log("🔍 Converted PrimaryImageIndex to number:", updateData.primaryImageIndex);
    }
    
    // Auto-update status based on stock
    if (updateData.stock !== undefined) {
      updateData.status = updateData.stock > 0 ? "Available" : "Out of Stock";
    }

    console.log("🔍 Final update object:", updateData);

    const updated = await Product.findByIdAndUpdate(req.params.id, updateData, {
      new: true
    });

    console.log("✅ Product updated successfully:", updated);
    res.json(updated);
  } catch (error) {
    console.error("❌ Update product error:", error);
    console.error("❌ Error stack:", error.stack);
    res.status(500).json({ error: error.message });
  }
});

// Route for updates with image (FormData)
router.put("/:id/with-image", authMiddleware, upload.single("image"), async (req, res) => {
  try {
    console.log("🔍 Updating product (FormData):", req.params.id);
    console.log("🔍 Request body:", req.body);
    console.log("🔍 Request file:", req.file);
    
    const product = await Product.findOne({
      _id: req.params.id,
      sellerId: req.userId
    });

    if (!product) {
      console.log("❌ Product not found");
      return res.status(404).json({ error: "Product not found" });
    }

    console.log("🔍 Found product:", product);

    // Handle FormData
    console.log("🔍 Processing FormData");
    let updateData = { ...req.body };
    
    // Convert price and stock to numbers
    if (updateData.price) updateData.price = Number(updateData.price);
    if (updateData.stock) updateData.stock = Number(updateData.stock);
    if (updateData.minimumOrder) updateData.minimumOrder = Number(updateData.minimumOrder);

    // Auto-update status based on stock
    if (updateData.stock !== undefined) {
      updateData.status = updateData.stock > 0 ? "Available" : "Out of Stock";
    }

    if (req.file) {
      console.log("🔍 Handling file upload");
      // Handle images array - add new image to existing images array
      const currentImages = product.images || [];
      updateData.images = [...currentImages, `/uploads/products/${req.file.filename}`];
      console.log("🔍 Updated images array with new file:", updateData.images);
    } else {
      // Only handle images array from FormData if no new file was uploaded
      if (req.body.images) {
        try {
          updateData.images = JSON.parse(req.body.images);
          console.log("🔍 Parsed images array (no new file):", updateData.images);
        } catch (e) {
          console.error("❌ Error parsing images:", e);
        }
      }
    }

    // Handle primaryImageIndex from FormData
    if (req.body.primaryImageIndex !== undefined) {
      updateData.primaryImageIndex = Number(req.body.primaryImageIndex);
      console.log("🔍 Primary image index:", updateData.primaryImageIndex);
    }

    // Parse JSON fields if they exist
    if (req.body.location && typeof req.body.location === 'string') {
      try {
        updateData.location = JSON.parse(req.body.location);
        console.log("🔍 Parsed location:", updateData.location);
      } catch (e) {
        console.error("❌ Error parsing location:", e);
      }
    }
    
    if (req.body.contactInfo && typeof req.body.contactInfo === 'string') {
      try {
        updateData.contactInfo = JSON.parse(req.body.contactInfo);
        console.log("🔍 Parsed contactInfo:", updateData.contactInfo);
      } catch (e) {
        console.error("❌ Error parsing contactInfo:", e);
      }
    }

    // Handle suitableCrops array
    if (req.body.suitableCrops) {
      try {
        if (typeof req.body.suitableCrops === 'string') {
          updateData.suitableCrops = JSON.parse(req.body.suitableCrops);
        }
      } catch (e) {
        console.error("❌ Error parsing suitableCrops:", e);
      }
    }

    console.log("🔍 Final update object:", updateData);

    const updated = await Product.findByIdAndUpdate(req.params.id, updateData, {
      new: true
    });

    console.log("✅ Product updated successfully:", updated);
    res.json(updated);
  } catch (error) {
    console.error("❌ Update product error:", error);
    console.error("❌ Error stack:", error.stack);
    // Delete uploaded file if error occurred
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});

/* -------------------- VERIFY / UNVERIFY PRODUCT -------------------- */

router.put("/:id/status", authMiddleware, async (req, res) => {
  try {
    const { status, verified } = req.body;
    
    const product = await Product.findOne({
      _id: req.params.id,
      sellerId: req.userId
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Handle verification changes
    if (verified !== undefined) {
      product.verified = Boolean(verified);
      await product.save();
      return res.json(product);
    }

    // Handle status changes (like crops)
    if (status !== undefined) {
      // Check if stock is zero for status changes
      if (product.stock === 0 && status !== "Out of Stock") {
        return res.status(400).json({
          error: "Cannot change status",
          message: "Cannot change status when stock is zero. Please update stock first."
        });
      }
      
      const updatedProduct = await Product.findByIdAndUpdate(
        req.params.id,
        { status },
        { new: true }
      );
      
      return res.json(updatedProduct);
    }

    res.status(400).json({ error: "No valid update data provided" });
  } catch (error) {
    console.error("❌ Status update error:", error);
    res.status(500).json({ error: error.message });
  }
});

/* -------------------- ADMIN VERIFY PRODUCT -------------------- */

router.put("/:id/verify", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { verified } = req.body;
    
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    
    product.verified = Boolean(verified);
    await product.save();
    
    res.json({
      success: true,
      message: `Product ${verified ? 'verified' : 'unverified'} successfully`,
      product
    });
  } catch (error) {
    console.error("Admin verification error:", error);
    res.status(500).json({ error: "Failed to update verification status" });
  }
});

/* -------------------- DELETE PRODUCT -------------------- */

router.delete("/:id", authMiddleware, async (req, res) => {
  const product = await Product.findOne({
    _id: req.params.id,
    sellerId: req.userId
  });

  if (!product) {
    return res.status(404).json({ error: "Product not found" });
  }

  if (product.image) {
    const img = product.image.replace("/uploads/", "uploads/");
    if (fs.existsSync(img)) fs.unlinkSync(img);
  }

  await Product.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

/* -------------------- DECREASE STOCK (ORDER) -------------------- */

router.put("/:id/decrease-stock", async (req, res) => {
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
});

module.exports = router;
