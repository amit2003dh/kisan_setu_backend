// Delivery Partner Model
const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema({
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  address: String,
  city: String,
  state: String
});

const deliveryPartnerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  partnerId: { type: String, required: true, unique: true }, // Unique partner ID like DP001
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  vehicle: {
    type: { type: String, enum: ["bike", "van", "truck"], required: true },
    number: { type: String, required: true },
    capacity: { type: Number, required: true } // in kg
  },
  currentLocation: {
    lat: { type: Number, default: 0 },
    lng: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
  },
  status: { 
    type: String, 
    enum: ["available", "busy", "offline"], 
    default: "offline" 
  },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  deliveryStats: {
    totalDeliveries: { type: Number, default: 0 },
    successfulDeliveries: { type: Number, default: 0 },
    cancelledDeliveries: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 }
  },
  workingHours: {
    start: { type: String, default: "09:00" },
    end: { type: String, default: "18:00" },
    workingDays: [{ type: String, enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] }]
  },
  serviceArea: {
    cities: [String],
    maxDistance: { type: Number, default: 50 } // in km
  },
  documents: {
    drivingLicense: String,
    vehicleInsurance: String,
    policeVerification: String,
    aadharCard: String
  },
  bankDetails: {
    accountNumber: String,
    ifscCode: String,
    accountHolderName: String
  },
  // ✅ Verification status
  
}, {
  timestamps: true
});

module.exports = mongoose.model("DeliveryPartner", deliveryPartnerSchema);
