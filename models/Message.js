// Message Model
const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    // For general chat
    chatId: String,
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    
    // For order communications
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    senderType: { type: String, enum: ["buyer", "seller", "delivery_partner", "system", "farmer"] },
    
    // Common fields
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    message: String,
    content: String, // Alternative to 'message' field for consistency
    messageType: { type: String, enum: ["order_communication", "status_update", "general"] },
    seen: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", messageSchema);
