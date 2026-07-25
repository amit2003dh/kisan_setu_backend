require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const connectDB = require("./config/db");

require("./models");
const Order = require("./models/Order");

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:3001",
    "https://kisan-set-frontend-71z4.vercel.app",
    "https://kisan-set-frontend-71z4-git-main-amit2003dhs-projects.vercel.app",
    "https://kisan-setu-admin-git-main-amit2003dhs-projects.vercel.app",
    "https://kisan-setu-admin.vercel.app"
  ],
  credentials: true
}));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

connectDB();

// API Routes
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/crops", require("./routes/cropRoutes"));
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/delivery", require("./routes/deliveryRoutes"));
app.use("/api/delivery-partner", require("./routes/deliveryPartnerRoutes"));
app.use("/api/ai", require("./routes/aiRoutes"));
app.use("/api/gemini", require("./routes/geminiRoutes"));
app.use("/api/payment", require("./routes/paymentRoutes"));
app.use("/api/tracker", require("./routes/trackerRoutes"));
app.use("/api/chat", require("./routes/chatRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/crop-analysis", require("./routes/cropAnalysisSimple"));

// Socket.io Real-time Setup
const io = new Server(server, { cors: { origin: "*" } });
module.exports.io = io;

const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("authenticate", ({ userId, userRole, name }) => {
    socket.userId = userId;
    socket.userRole = userRole;
    socket.name = name;

    onlineUsers.set(userId, { socketId: socket.id, userRole, name, lastSeen: new Date() });
    socket.broadcast.emit("userOnline", { userId, userRole, name });
    socket.join(`user_${userId}`);
  });

  socket.on("joinChat", (chatId) => {
    socket.join(chatId);
  });

  socket.on("sendMessage", async ({ chatId, message, senderId, recipientId }) => {
    try {
      socket.to(chatId).emit("newMessage", { chatId, message: { ...message, timestamp: new Date() } });
      if (recipientId && onlineUsers.has(recipientId)) {
        socket.to(`user_${recipientId}`).emit("newMessageNotification", { chatId, message, senderId });
      }
    } catch (err) {
      console.error("Socket message error:", err);
    }
  });

  socket.on("typing", ({ chatId, userId, isTyping }) => {
    socket.to(chatId).emit("userTyping", { userId, isTyping });
  });

  socket.on("joinDelivery", (deliveryId) => {
    socket.join(deliveryId);
  });

  socket.on("updateLocation", async ({ deliveryId, lat, lng, status }) => {
    try {
      await Order.findByIdAndUpdate(deliveryId, {
        "deliveryPartnerInfo.currentLocation": { lat, lng, status },
        status
      });
      io.to(deliveryId).emit("locationUpdate", { lat, lng, status });
    } catch (err) {
      console.error("Location update error:", err);
    }
  });

  socket.on("disconnect", () => {
    if (socket.userId) {
      const user = onlineUsers.get(socket.userId);
      if (user) {
        onlineUsers.set(socket.userId, { ...user, lastSeen: new Date() });
        socket.broadcast.emit("userOffline", {
          userId: socket.userId,
          userRole: socket.userRole,
          name: socket.name,
          lastSeen: new Date()
        });
      }
      onlineUsers.delete(socket.userId);
    }
  });
});

const isUserOnline = (userId) => onlineUsers.has(userId);

const getOnlineUsersByRole = (role) => {
  const users = [];
  for (const [userId, user] of onlineUsers) {
    if (user.userRole === role) users.push({ userId, ...user });
  }
  return users;
};

module.exports.onlineUsers = onlineUsers;
module.exports.isUserOnline = isUserOnline;
module.exports.getOnlineUsersByRole = getOnlineUsersByRole;

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

