// KisanSetu Server
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");

// Import all models to ensure they are registered
require("./models");

const app = express();
const server = http.createServer(app);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

app.use(express.json());
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:3000", "http://localhost:3001", "https://kisan-set-frontend-71z4.vercel.app","https://kisan-set-frontend-71z4-git-main-amit2003dhs-projects.vercel.app" ,"https://kisan-setu-admin-git-main-amit2003dhs-projects.vercel.app","https://kisan-setu-admin.vercel.app"], // Allow frontend URLs - Updated for Vercel admin
  credentials: true // Allow cookies/headers
}));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve uploaded files
app.use("/uploads", express.static("uploads"));

// Connect to database (non-blocking)
connectDB().catch((err) => {
  console.error("Database connection failed:", err.message);
});

// Routes
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
app.use("/api/auth/admin", require("./routes/adminRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/crop-analysis", require("./routes/cropAnalysisSimple"));

// Socket.io AFTER middleware
const io = new Server(server, {
  cors: { origin: "*" }
});

// Export io for use in other modules
module.exports.io = io;

// Track online users
const onlineUsers = new Map(); // userId -> socketId

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Handle user authentication and online status
  socket.on("authenticate", (userData) => {
    const { userId, userRole, name } = userData;
    socket.userId = userId;
    socket.userRole = userRole;
    socket.name = name;
    
    // Store user as online
    onlineUsers.set(userId, {
      socketId: socket.id,
      userRole,
      name,
      lastSeen: new Date()
    });

    // Broadcast online status
    socket.broadcast.emit("userOnline", { userId, userRole, name });
    
    // Join user to their personal room for direct messages
    socket.join(`user_${userId}`);
    
    console.log(`User ${name} (${userRole}) is now online`);
  });

  // Handle chat joining
  socket.on("joinChat", (chatId) => {
    socket.join(chatId);
    console.log(`User ${socket.userId} joined chat ${chatId}`);
  });

  // Handle sending messages (works for both online and offline users)
  socket.on("sendMessage", async (data) => {
    const { chatId, message, senderId, recipientId } = data;
    
    // Store message in database via API
    try {
      // This would normally call the chat service
      // For now, we'll broadcast to the chat room
      socket.to(chatId).emit("newMessage", {
        chatId,
        message: {
          ...message,
          timestamp: new Date()
        }
      });

      // If recipient is online, send them a notification
      if (recipientId && onlineUsers.has(recipientId)) {
        socket.to(`user_${recipientId}`).emit("newMessageNotification", {
          chatId,
          message,
          senderId
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  });

  // Handle typing indicators
  socket.on("typing", (data) => {
    const { chatId, userId, isTyping } = data;
    socket.to(chatId).emit("userTyping", { userId, isTyping });
  });

  // Handle delivery location updates
  socket.on("joinDelivery", (deliveryId) => {
    socket.join(deliveryId);
  });

  socket.on("updateLocation", ({ deliveryId, lat, lng, status }) => {
    Order.findByIdAndUpdate(deliveryId, {
      "deliveryPartnerInfo.currentLocation": { lat, lng, status },
      status
    }).then(() => {
      io.to(deliveryId).emit("locationUpdate", { lat, lng, status });
    });
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    if (socket.userId) {
      const user = onlineUsers.get(socket.userId);
      if (user) {
        // Update last seen
        onlineUsers.set(socket.userId, {
          ...user,
          lastSeen: new Date()
        });

        // Broadcast offline status
        socket.broadcast.emit("userOffline", {
          userId: socket.userId,
          userRole: socket.userRole,
          name: socket.name,
          lastSeen: new Date()
        });

        console.log(`User ${socket.name} (${socket.userRole}) is now offline`);
      }
      
      onlineUsers.delete(socket.userId);
    }
    console.log("User disconnected:", socket.id);
  });
});

// Helper function to check if user is online
const isUserOnline = (userId) => {
  return onlineUsers.has(userId);
};

// Helper function to get online users by role
const getOnlineUsersByRole = (role) => {
  const users = [];
  for (const [userId, user] of onlineUsers) {
    if (user.userRole === role) {
      users.push({ userId, ...user });
    }
  }
  return users;
};

// Export helper functions
module.exports.onlineUsers = onlineUsers;
module.exports.isUserOnline = isUserOnline;
module.exports.getOnlineUsersByRole = getOnlineUsersByRole;

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {

  console.log("Server + Socket.io runnin on port " + PORT);
});
