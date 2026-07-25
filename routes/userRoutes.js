const router = require("express").Router();
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const User = require("../models/User");
const Cart = require("../models/Cart");
const authMiddleware = require("../middleware/auth");

const JWT_SECRET = process.env.JWT_SECRET || "kisansetu_secret_key_change_in_production";

const uploadDir = "uploads/profiles";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `profile-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
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

// Signup
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, phone, role, location } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Missing required fields", message: "Name, email, and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Weak password", message: "Password must be at least 6 characters long" });
    }
    if (phone && !/^\d{10}$/.test(phone)) {
      return res.status(400).json({ error: "Invalid phone number", message: "Phone number must be 10 digits" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: "User exists", message: "User with this email already exists" });
    }

    const user = new User({
      name,
      email: email.toLowerCase(),
      password,
      phone,
      role: role || "farmer",
      location
    });

    await user.save();

    const token = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });

    res.status(201).json({ success: true, token, user: user.toJSON() });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: "User exists", message: "User with this email already exists" });
    }
    res.status(500).json({ error: "Signup failed", message: err.message });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Missing credentials", message: "Email and password are required" });
    }

    let user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    if (!user) {
      if (email.toLowerCase() === "amitg@gmail.com" && password === "asdfgh") {
        user = new User({
          name: "Amit Gupta (Sandbox)",
          email: "amitg@gmail.com",
          password: "asdfgh",
          phone: "9876543210",
          role: "farmer",
          location: "Sandbox City",
          isVerified: true
        });
        await user.save();
        user = await User.findOne({ email: "amitg@gmail.com" }).select("+password");
      } else {
        return res.status(401).json({ error: "Invalid credentials", message: "Invalid email or password" });
      }
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials", message: "Invalid email or password" });
    }

    const token = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });

    res.json({
      success: true,
      token,
      user: user.toJSON(),
      deliveryPartnerStatus: {
        hasApplied: user.deliveryPartnerRegistration?.hasApplied || false,
        applicationStatus: user.deliveryPartnerRegistration?.applicationStatus || "not_applied",
        applicationDate: user.deliveryPartnerRegistration?.applicationDate,
        isVerified: user.isVerified,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Login failed", message: err.message });
  }
});

// Get current user profile
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user.toJSON());
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch profile", message: err.message });
  }
});

// Update profile
router.put("/profile", authMiddleware, async (req, res) => {
  try {
    const { name, phone, location } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (phone && !/^\d{10}$/.test(phone)) {
      return res.status(400).json({ error: "Invalid phone number", message: "Phone number must be 10 digits" });
    }

    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (location !== undefined) user.location = location;

    await user.save();
    res.json({ success: true, user: user.toJSON() });
  } catch (err) {
    res.status(500).json({ error: "Failed to update profile", message: err.message });
  }
});

// Upload profile photo
router.post("/profile/photo", authMiddleware, upload.single("photo"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const user = await User.findById(req.userId);
    if (!user) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: "User not found" });
    }

    if (user.profilePhoto) {
      const oldPath = user.profilePhoto.replace(/^\/uploads\//, "uploads/");
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    user.profilePhoto = `/uploads/profiles/${req.file.filename}`;
    await user.save();

    res.json({ success: true, user: user.toJSON() });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: "Upload failed", message: err.message });
  }
});

// Get user cart
router.get("/cart", authMiddleware, async (req, res) => {
  try {
    let cart = await Cart.findOne({ userId: req.userId });
    if (!cart) {
      cart = new Cart({ userId: req.userId, items: [] });
      await cart.save();
    }
    res.json(cart.items || []);
  } catch (err) {
    res.status(500).json({ error: "Failed to get cart", message: err.message });
  }
});

// Save user cart
router.post("/cart", authMiddleware, async (req, res) => {
  try {
    const { items } = req.body;
    let cart = await Cart.findOne({ userId: req.userId });

    if (!cart) {
      cart = new Cart({ userId: req.userId, items: items || [] });
    } else {
      cart.items = items || [];
    }

    await cart.save();
    res.json({ success: true, items: cart.items });
  } catch (err) {
    res.status(500).json({ error: "Failed to save cart", message: err.message });
  }
});

// Forgot / Reset Password
router.post("/forgot-password", async (req, res) => {
  try {
    const { email, phone, newPassword } = req.body;

    if (!email || !phone || !newPassword) {
      return res.status(400).json({ error: "Missing fields", message: "Email, phone, and new password are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Weak password", message: "Password must be at least 6 characters long" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ error: "User not found" });

    if (!user.phone || user.phone !== phone) {
      return res.status(400).json({ error: "Credentials mismatch", message: "Phone number does not match our records" });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: "Password reset successfully" });
  } catch (err) {
    res.status(500).json({ error: "Reset failed", message: err.message });
  }
});

module.exports = router;
