const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/kisansetu";
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log("MongoDB connected successfully");

    mongoose.connection.on("error", (err) => console.error("MongoDB error:", err.message));
    mongoose.connection.on("disconnected", () => console.warn("MongoDB disconnected"));
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
  }
};

module.exports = connectDB;

