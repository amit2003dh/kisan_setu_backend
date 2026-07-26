// Authentication Middleware
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]; // Bearer <token>

    if (!token) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "No token provided. Please login."
      });
    }

    const secretKey = (process.env.JWT_SECRET ? process.env.JWT_SECRET.replace(/"/g, "") : "") || "amitkisan";
    let decoded;
    try {
      decoded = jwt.verify(token, secretKey);
    } catch (e1) {
      try {
        decoded = jwt.verify(token, "kisansetu_secret_key_change_in_production");
      } catch (e2) {
        throw e1;
      }
    }

    req.userId = decoded.userId;
    try {
      const user = await User.findById(decoded.userId);
      req.user = user;
    } catch (uErr) {
      console.warn("User lookup warning in auth:", uErr.message);
    }

    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        error: "Invalid token",
        message: "Token is invalid. Please login again."
      });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Token expired",
        message: "Token has expired. Please login again."
      });
    }
    res.status(401).json({
      error: "Authentication error",
      message: "Please login again."
    });
  }
};

module.exports = authMiddleware;

