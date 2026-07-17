// User Routes
const router = require("express").Router();
const User = require("../models/User");
const Cart = require("../models/Cart");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const authMiddleware = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const JWT_SECRET = process.env.JWT_SECRET || "kisansetu_secret_key_change_in_production";

// Configure multer for profile photo upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/profiles";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    cb(null, "profile-" + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Only image files are allowed (jpeg, jpg, png, gif, webp)"));
  }
});

// Signup
router.post("/signup", async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error: "Database not connected",
        message: "MongoDB is not connected. Please check your database connection."
      });
    }

    const { name, email, password, phone, role, location } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "Name, email, and password are required"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: "Weak password",
        message: "Password must be at least 6 characters long"
      });
    }

    // Validate phone number (10 digits)
    if (phone && !/^\d{10}$/.test(phone)) {
      return res.status(400).json({
        error: "Invalid phone number",
        message: "Phone number must be exactly 10 digits"
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        error: "User exists",
        message: "User with this email already exists"
      });
    }

    // Create user
    const user = new User({
      name,
      email: email.toLowerCase(),
      password,
      phone,
      role: role || "farmer",
      location
    });

    await user.save();

    // Generate token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      success: true,
      token,
      user: user.toJSON()
    });
  } catch (error) {
    console.error("Signup error:", error);
    if (error.code === 11000) {
      return res.status(400).json({
        error: "User exists",
        message: "User with this email already exists"
      });
    }
    res.status(500).json({
      error: "Signup failed",
      message: error.message || "Failed to create user"
    });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error: "Database not connected",
        message: "MongoDB is not connected. Please check your database connection."
      });
    }

    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        error: "Missing credentials",
        message: "Email and password are required"
      });
    }

    // Find user
    let user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      if (email.toLowerCase() === "amitg@gmail.com" && password === "asdfgh") {
        // Auto-create sandbox user if not exists
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
        // Fetch again to select virtuals/password
        user = await User.findOne({ email: "amitg@gmail.com" }).select('+password');
      } else {
        return res.status(401).json({
          error: "Invalid credentials",
          message: "Invalid email or password"
        });
      }
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        error: "Invalid credentials",
        message: "Invalid email or password"
      });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

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
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      error: "Login failed",
      message: error.message || "Failed to login"
    });
  }
});

// Get current user (protected route)
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        error: "User not found",
        message: "User does not exist"
      });
    }
    res.json(user.toJSON());
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({
      error: "Failed to get user",
      message: error.message
    });
  }
});

// Update user profile (protected route)
router.put("/profile", authMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error: "Database not connected",
        message: "MongoDB is not connected. Please check your database connection."
      });
    }

    const { name, phone, location } = req.body;
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        error: "User not found",
        message: "User does not exist"
      });
    }

    // Validate phone number (10 digits)
    if (phone && !/^\d{10}$/.test(phone)) {
      return res.status(400).json({
        error: "Invalid phone number",
        message: "Phone number must be exactly 10 digits"
      });
    }

    // Update fields
    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (location !== undefined) user.location = location;

    await user.save();

    res.json({
      success: true,
      user: user.toJSON()
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      error: "Failed to update profile",
      message: error.message || "Failed to update profile"
    });
  }
});

// Upload profile photo (protected route)
router.post("/profile/photo", authMiddleware, upload.single("photo"), async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      // Delete uploaded file if error occurred
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(503).json({
        error: "Database not connected",
        message: "MongoDB is not connected. Please check your database connection."
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: "No file uploaded",
        message: "Please select an image file"
      });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      // Delete uploaded file if error occurred
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({
        error: "User not found",
        message: "User does not exist"
      });
    }

    // Delete old profile photo if exists
    if (user.profilePhoto) {
      const oldPhotoPath = user.profilePhoto.replace(/^\/uploads\//, "uploads/");
      if (fs.existsSync(oldPhotoPath)) {
        fs.unlinkSync(oldPhotoPath);
      }
    }

    // Update profile photo path
    user.profilePhoto = `/uploads/profiles/${req.file.filename}`;
    await user.save();

    res.json({
      success: true,
      user: user.toJSON()
    });
  } catch (error) {
    console.error("Upload photo error:", error);
    // Delete uploaded file if error occurred
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      error: "Failed to upload photo",
      message: error.message || "Failed to upload photo"
    });
  }
});

// Get user cart (protected route)
router.get("/cart", authMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error: "Database not connected",
        message: "MongoDB is not connected. Please check your database connection."
      });
    }

    let cart = await Cart.findOne({ userId: req.userId });
    
    if (!cart) {
      // Create empty cart if doesn't exist
      cart = new Cart({ userId: req.userId, items: [] });
      await cart.save();
    }

    res.json(cart.items || []);
  } catch (error) {
    console.error("Get cart error:", error);
    res.status(500).json({
      error: "Failed to get cart",
      message: error.message || "Failed to retrieve cart"
    });
  }
});

// Save user cart (protected route)
router.post("/cart", authMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error: "Database not connected",
        message: "MongoDB is not connected. Please check your database connection."
      });
    }

    const { items } = req.body;

    let cart = await Cart.findOne({ userId: req.userId });
    
    if (!cart) {
      cart = new Cart({ userId: req.userId, items: items || [] });
    } else {
      cart.items = items || [];
    }

    await cart.save();

    res.json({
      success: true,
      items: cart.items
    });
  } catch (error) {
    console.error("Save cart error:", error);
    res.status(500).json({
      error: "Failed to save cart",
      message: error.message || "Failed to save cart"
    });
  }
});

// Forgot password / Reset password
router.post("/forgot-password", async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error: "Database not connected",
        message: "MongoDB is not connected. Please check your database connection."
      });
    }

    const { email, phone, newPassword } = req.body;

    if (!email || !phone || !newPassword) {
      return res.status(400).json({
        error: "Missing fields",
        message: "Email, phone number, and new password are required"
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: "Weak password",
        message: "Password must be at least 6 characters long"
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({
        error: "User not found",
        message: "No account registered with this email"
      });
    }

    // Check if phone matches
    if (!user.phone) {
      return res.status(400).json({
        error: "No phone registered",
        message: "This account does not have a registered phone number. Please contact support."
      });
    }

    if (user.phone !== phone) {
      return res.status(400).json({
        error: "Credentials mismatch",
        message: "Phone number does not match our records for this email."
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: "Password reset successfully. You can now login with your new password."
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      error: "Reset failed",
      message: error.message || "Failed to reset password"
    });
  }
});

module.exports = router;

