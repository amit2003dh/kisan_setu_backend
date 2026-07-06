const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema({
  address: { type: String, required: true },
  city: String,
  state: String,
  pincode: String,
  lat: { type: Number, required: true },
  lng: { type: Number, required: true }
});

const orderSchema = new mongoose.Schema(
  {
    // 👤 Buyer & Seller
    buyerId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },

    sellerId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },

    // 🔄 Order classification
    orderType: {
      type: String,
      enum: ["crop_sale", "crop_purchase", "product_purchase"],
      required: true
    },

    // 📦 Ordered items
    items: [
      {
        itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
        itemType: { type: String, required: true }, // crop | seed | pesticide | fertilizer | equipment
        name: { type: String, required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true }
      }
    ],

    // 💰 Pricing
    total: { type: Number, required: true },

    // 📌 Order status
    status: {
      type: String,
      enum: [
        "Pending",
        "Confirmed",
        "Picked Up",
        "In Transit",
        "Delivered",
        "Cancelled"
      ],
      default: "Pending"
    },

    // 💳 Payment
    paymentMethod: { 
      type: String, 
      enum: ["ONLINE", "COD"], 
      required: true 
    },

    paymentId: String,

    // 🚚 Delivery & tracking
    deliveryInfo: {
      deliveryPartnerId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User" 
      },

      // 📍 Pickup location (from product / crop)
      pickupAddress: {
        type: addressSchema,
        required: true
      },

      // 🏠 Customer delivery address
      deliveryAddress: {
        type: addressSchema,
        required: true
      },

      // 📡 Live tracking
      currentLocation: {
        lat: Number,
        lng: Number
      }
    }, 

    // 🕒 Timeline (for tracking UI)
    orderTimeline: [
      {
        status: String,
        timestamp: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
