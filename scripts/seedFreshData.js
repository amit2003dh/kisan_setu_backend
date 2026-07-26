const mongoose = require("mongoose");
require("dotenv").config({ path: __dirname + "/../.env" });

const Crop = require("../models/Crop");
const Product = require("../models/Product");
const User = require("../models/User");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/kisansetu";

async function seedData() {
  try {
    console.log("🌱 Connecting to MongoDB:", MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB successfully.");

    // 1. Find or create a default seller user
    let seller = await User.findOne({ role: { $in: ["farmer", "seller"] } });
    if (!seller) {
      seller = await User.create({
        name: "Krishi Seva Kendra & Organics",
        email: "seller.krishi@kisansetu.com",
        phone: "+91 98260 12345",
        role: "farmer",
        password: "hashedpassword123",
        isVerified: true
      });
      console.log("👤 Created default seller account:", seller.name);
    } else {
      console.log("👤 Using existing seller account:", seller.name, `(${seller._id})`);
    }

    const sellerId = seller._id;

    // 2. Clear old crops and products
    console.log("🧹 Clearing old Crop and Product data...");
    await Crop.deleteMany({});
    await Product.deleteMany({});
    console.log("✨ Cleaned existing Crop and Product collections.");

    // 3. Fresh human-realistic crop listings
    const freshCrops = [
      {
        sellerId,
        name: "Organic Sharbati Wheat (शरबती गेहूं)",
        quantity: 150, // in Quintals
        price: 2850, // per Quintal
        harvestDate: new Date("2026-03-15"),
        status: "Available",
        isApproved: "approved",
        qualityGrade: "A",
        minimumOrder: 5,
        category: "Grains",
        description: "Farm-fresh organic Sharbati wheat harvested directly from sabalgarh fields. Naturally dried in sunlight, machine-cleaned, free from pesticides, high gluten strength perfect for soft rotis.",
        images: [
          "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=800&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1501430654243-c934cec2e1c0?w=800&auto=format&fit=crop"
        ],
        primaryImageIndex: 0,
        location: {
          address: "Gram Rajoudha, Post Kailaras, Sabalgarh Highway",
          city: "Kailaras",
          state: "Madhya Pradesh",
          pincode: "476224",
          lat: 26.3124,
          lng: 77.6185,
          landmark: "Near Rajoudha Government School"
        },
        contactInfo: {
          phone: "9826012345",
          email: "rajoudha.farm@gmail.com",
          preferredContact: "phone"
        }
      },
      {
        sellerId,
        name: "Pusa 1121 Extra Long Basmati Rice (1121 बासमती धान)",
        quantity: 220,
        price: 3950,
        harvestDate: new Date("2025-11-20"),
        status: "Available",
        isApproved: "approved",
        qualityGrade: "A",
        minimumOrder: 10,
        category: "Grains",
        description: "Premium grade 1121 Basmati Paddy harvested from fertile fields of Karnal. Known for exceptional grain length (8.4mm+ after cooking), rich natural aroma, and zero broken grain blend.",
        images: [
          "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1536304929831-ee1ca9d44906?w=800&auto=format&fit=crop"
        ],
        primaryImageIndex: 0,
        location: {
          address: "VPO Taraori, Near Anaj Mandi, GT Road",
          city: "Karnal",
          state: "Haryana",
          pincode: "132116",
          lat: 29.8052,
          lng: 76.9248,
          landmark: "Taraori Rice Belt Gate"
        },
        contactInfo: {
          phone: "9812034567",
          email: "karnal.basmati@kisansetu.com",
          preferredContact: "phone"
        }
      },
      {
        sellerId,
        name: "Farm-Fresh Red Tomatoes (नाशिक लाल टमाटर)",
        quantity: 90,
        price: 1400,
        harvestDate: new Date("2026-07-20"),
        status: "Available",
        isApproved: "approved",
        qualityGrade: "A",
        minimumOrder: 2,
        category: "Vegetables",
        description: "Freshly plucked bright red firm tomatoes from Nashik polyhouse farms. Excellent pulp density, long shelf life, perfect for wholesale markets and processing.",
        images: [
          "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1582284540020-8acbe03f4924?w=800&auto=format&fit=crop"
        ],
        primaryImageIndex: 0,
        location: {
          address: "Pimpalgaon Baswant, Taluka Niphad",
          city: "Nashik",
          state: "Maharashtra",
          pincode: "422209",
          lat: 20.1706,
          lng: 73.9872,
          landmark: "Niphad Agro Farm Gate"
        },
        contactInfo: {
          phone: "9822045678",
          email: "nashik.tomatoes@gmail.com",
          preferredContact: "phone"
        }
      },
      {
        sellerId,
        name: "High-Yield Yellow Maize / Corn (पीली मक्का)",
        quantity: 300,
        price: 2150,
        harvestDate: new Date("2026-06-10"),
        status: "Available",
        isApproved: "approved",
        qualityGrade: "A",
        minimumOrder: 15,
        category: "Grains",
        description: "Top-quality yellow hybrid maize harvested in Chhindwara. Sun-dried with moisture levels under 12%. Ideal for poultry feed formulation and starch manufacture.",
        images: [
          "https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=800&auto=format&fit=crop"
        ],
        primaryImageIndex: 0,
        location: {
          address: "Gram Chincholi, Sausar Road",
          city: "Chhindwara",
          state: "Madhya Pradesh",
          pincode: "480001",
          lat: 22.0574,
          lng: 78.9382,
          landmark: "Sausar Krishi Upaj Mandi"
        },
        contactInfo: {
          phone: "9755011223",
          email: "chhindwara.maize@gmail.com",
          preferredContact: "phone"
        }
      },
      {
        sellerId,
        name: "Pure Yellow Mustard Seeds / Sarson (पीली सरसों)",
        quantity: 85,
        price: 5450,
        harvestDate: new Date("2026-04-05"),
        status: "Available",
        isApproved: "approved",
        qualityGrade: "A",
        minimumOrder: 3,
        category: "Oilseeds",
        description: "Oil-rich bold yellow mustard seeds from Alwar region. High oil content (> 42%), rich natural pungent pungency aroma, clean sifted seeds with zero foreign material.",
        images: [
          "https://images.unsplash.com/photo-1508747703725-719777637510?w=800&auto=format&fit=crop"
        ],
        primaryImageIndex: 0,
        location: {
          address: "Village Khairthal, Tehsil Kishangarh Bas",
          city: "Alwar",
          state: "Rajasthan",
          pincode: "301404",
          lat: 27.9298,
          lng: 76.6432,
          landmark: "Khairthal Mandi Gate 2"
        },
        contactInfo: {
          phone: "9414088990",
          email: "alwar.mustard@gmail.com",
          preferredContact: "phone"
        }
      },
      {
        sellerId,
        name: "Co 0238 High Sucrose Sugarcane (गन्ना)",
        quantity: 500,
        price: 365,
        harvestDate: new Date("2026-02-18"),
        status: "Available",
        isApproved: "approved",
        qualityGrade: "A",
        minimumOrder: 50,
        category: "Cash Crops",
        description: "Freshly cut high-sucrose Co 0238 variety sugarcane. High juice brix level (> 19), thick juicy canes ready for immediate crushing, sugar mill supply, or jaggery (Gur) making.",
        images: [
          "https://images.unsplash.com/photo-1590682680695-43b964a3ae17?w=800&auto=format&fit=crop"
        ],
        primaryImageIndex: 0,
        location: {
          address: "Village Gagalheri, Deoband Highway",
          city: "Saharanpur",
          state: "Uttar Pradesh",
          pincode: "247001",
          lat: 29.9680,
          lng: 77.5552,
          landmark: "Gagalheri Sugarcane Collection Center"
        },
        contactInfo: {
          phone: "9837055443",
          email: "up.sugarcane@gmail.com",
          preferredContact: "phone"
        }
      },
      {
        sellerId,
        name: "Export Quality Red Onions (नाशिक कांदा)",
        quantity: 260,
        price: 1850,
        harvestDate: new Date("2026-05-30"),
        status: "Available",
        isApproved: "approved",
        qualityGrade: "A",
        minimumOrder: 10,
        category: "Vegetables",
        description: "Well-cured medium to large sized red onions from Lasalgaon belt. Triple skin layer, low moisture rot risk, ideal for long-distance transport and cold storage.",
        images: [
          "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=800&auto=format&fit=crop"
        ],
        primaryImageIndex: 0,
        location: {
          address: "Lasalgaon Agro Cluster, Niphad",
          city: "Nashik",
          state: "Maharashtra",
          pincode: "422306",
          lat: 20.1472,
          lng: 74.2294,
          landmark: "Lasalgaon Main Market Yard"
        },
        contactInfo: {
          phone: "9823077665",
          email: "lasalgaon.onions@gmail.com",
          preferredContact: "phone"
        }
      },
      {
        sellerId,
        name: "White Gold BG-II Cotton Bolls (कपास / रुई)",
        quantity: 120,
        price: 7150,
        harvestDate: new Date("2025-12-10"),
        status: "Available",
        isApproved: "approved",
        qualityGrade: "A",
        minimumOrder: 5,
        category: "Fiber Crops",
        description: "Long-staple clean white BG-II cotton harvest from Abohar cotton belt. Micronaire value 3.8-4.2, high tensile strength, zero trash content.",
        images: [
          "https://images.unsplash.com/photo-1606041008023-472dfb5e530f?w=800&auto=format&fit=crop"
        ],
        primaryImageIndex: 0,
        location: {
          address: "Village Abohar, Malout Road",
          city: "Fazilka",
          state: "Punjab",
          pincode: "152116",
          lat: 30.1451,
          lng: 74.1993,
          landmark: "Abohar Cotton Ginning Yard"
        },
        contactInfo: {
          phone: "9814033221",
          email: "abohar.cotton@gmail.com",
          preferredContact: "phone"
        }
      },
      {
        sellerId,
        name: "Fresh Kufri Jyoti Potatoes (कुफरी ज्योति आलू)",
        quantity: 380,
        price: 1280,
        harvestDate: new Date("2026-03-25"),
        status: "Available",
        isApproved: "approved",
        qualityGrade: "A",
        minimumOrder: 15,
        category: "Vegetables",
        description: "Uniform medium-large size cold storage grade Kufri Jyoti potatoes. Smooth oval tubers, low sugar content, perfect for household cooking and processing.",
        images: [
          "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=800&auto=format&fit=crop"
        ],
        primaryImageIndex: 0,
        location: {
          address: "Farrukhabad Potato Mandi Road",
          city: "Farrukhabad",
          state: "Uttar Pradesh",
          pincode: "209625",
          lat: 27.3826,
          lng: 79.5804,
          landmark: "Farrukhabad Cold Storage Hub"
        },
        contactInfo: {
          phone: "9415066778",
          email: "farrukhabad.potatoes@gmail.com",
          preferredContact: "phone"
        }
      }
    ];

    // 4. Fresh Pesticides, Fertilizers & Agricultural Products
    const freshProducts = [
      {
        sellerId,
        name: "IFFCO NPK 19:19:19 Water Soluble Fertilizer",
        type: "fertilizer",
        category: "Fertilizer",
        brand: "IFFCO",
        price: 240,
        stock: 500,
        minimumOrder: 1,
        qualityGrade: "A",
        status: "Available",
        isApproved: "approved",
        composition: "N: 19%, P: 19%, K: 19% (100% Water Soluble)",
        suitableCrops: ["Wheat", "Rice", "Tomato", "Cotton", "Sugarcane"],
        description: "100% water soluble NPK complex fertilizer designed for drip irrigation and foliar application. Promotes balanced root development, vigorous flowering, and high yield quality.",
        usageInstructions: "Dissolve 5 grams per liter of water. Spray during early vegetative and pre-flowering stages at 10-15 day intervals.",
        images: [
          "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800&auto=format&fit=crop"
        ],
        primaryImageIndex: 0,
        location: {
          address: "Krishi Seva Kendra Main Road",
          city: "Indore",
          state: "Madhya Pradesh",
          pincode: "452001",
          lat: 22.7196,
          lng: 75.8577
        },
        contactInfo: { phone: "9826012345", email: "store.iffco@kisansetu.com" },
        salesStats: { totalSold: 120, totalRevenue: 28800 }
      },
      {
        sellerId,
        name: "Bayer Confidor Insecticide (Imidacloprid 17.8% SL)",
        type: "pesticide",
        category: "Pesticide",
        brand: "Bayer CropScience",
        price: 460,
        stock: 350,
        minimumOrder: 1,
        qualityGrade: "A",
        status: "Available",
        isApproved: "approved",
        composition: "Imidacloprid 17.8% SL Systemic Insecticide",
        suitableCrops: ["Cotton", "Paddy", "Sugarcane", "Chili", "Tomato"],
        description: "World-renowned systemic insecticide for systemic control of sucking pests including aphids, whiteflies, jassids, thrips, and termites.",
        usageInstructions: "Mix 1ml per 3 liters of clean water. Apply at the first appearance of insect infestation.",
        images: [
          "https://images.unsplash.com/photo-1585314062340-f1a5a7c9328d?w=800&auto=format&fit=crop"
        ],
        primaryImageIndex: 0,
        location: {
          address: "Krishi Seva Kendra Main Road",
          city: "Indore",
          state: "Madhya Pradesh",
          pincode: "452001",
          lat: 22.7196,
          lng: 75.8577
        },
        contactInfo: { phone: "9826012345", email: "store.bayer@kisansetu.com" },
        salesStats: { totalSold: 85, totalRevenue: 39100 }
      },
      {
        sellerId,
        name: "Tata Rallis Contaf Plus Fungicide (Hexaconazole 5% EC)",
        type: "pesticide",
        category: "Pesticide",
        brand: "Tata Rallis",
        price: 380,
        stock: 280,
        minimumOrder: 1,
        qualityGrade: "A",
        status: "Available",
        isApproved: "approved",
        composition: "Hexaconazole 5% EC Systemic Fungicide",
        suitableCrops: ["Rice / Paddy", "Groundnut", "Mango", "Grapes"],
        description: "Highly effective broad-spectrum triazole fungicide with protective, curative, and eradicative action against Sheath Blight, Powdery Mildew, and Rust diseases.",
        usageInstructions: "Mix 2ml per liter of water. Spray thoroughly over crop foliage عند onset of fungal symptoms.",
        images: [
          "https://images.unsplash.com/photo-1615811361523-6bd03d7748e7?w=800&auto=format&fit=crop"
        ],
        primaryImageIndex: 0,
        location: {
          address: "Krishi Seva Kendra Main Road",
          city: "Indore",
          state: "Madhya Pradesh",
          pincode: "452001",
          lat: 22.7196,
          lng: 75.8577
        },
        contactInfo: { phone: "9826012345", email: "store.tata@kisansetu.com" },
        salesStats: { totalSold: 64, totalRevenue: 24320 }
      },
      {
        sellerId,
        name: "Neem Coated Urea (46% Nitrogen Fertilizer)",
        type: "fertilizer",
        category: "Fertilizer",
        brand: "NFL / IFFCO",
        price: 266,
        stock: 800,
        minimumOrder: 2,
        qualityGrade: "A",
        status: "Available",
        isApproved: "approved",
        composition: "Nitrogen 46% with Organic Neem Oil Coating",
        suitableCrops: ["Wheat", "Paddy", "Maize", "Sugarcane", "Mustard"],
        description: "Government certified Neem-coated Urea bag (45 kg). Slow release nitrogen formula prevents leaching loss and increases nitrogen absorption efficiency by 15-20%.",
        usageInstructions: "Apply in 2-3 split doses as top dressing during tillering and panicle initiation stages.",
        images: [
          "https://images.unsplash.com/photo-1595974482597-4b8da8879bc5?w=800&auto=format&fit=crop"
        ],
        primaryImageIndex: 0,
        location: {
          address: "Government Co-operative Society Yard",
          city: "Bhopal",
          state: "Madhya Pradesh",
          pincode: "462001",
          lat: 23.2599,
          lng: 77.4126
        },
        contactInfo: { phone: "9826012345", email: "urea.supply@kisansetu.com" },
        salesStats: { totalSold: 320, totalRevenue: 85120 }
      },
      {
        sellerId,
        name: "Syngenta Amistar Top Fungicide (Broad Spectrum)",
        type: "pesticide",
        category: "Pesticide",
        brand: "Syngenta",
        price: 980,
        stock: 180,
        minimumOrder: 1,
        qualityGrade: "A",
        status: "Available",
        isApproved: "approved",
        composition: "Azoxystrobin 18.2% + Difenoconazole 11.4% SC",
        suitableCrops: ["Tomato", "Chili", "Potato", "Paddy", "Maize"],
        description: "Premium dual-action systemic fungicide combining strobilurin and triazole chemistry. Delivers long-lasting greening effect and protection against early blight, blast, and leaf spot.",
        usageInstructions: "Mix 1ml per liter of water. Spray at first sign of foliar spot diseases.",
        images: [
          "https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?w=800&auto=format&fit=crop"
        ],
        primaryImageIndex: 0,
        location: {
          address: "Syngenta Authorised Outlet",
          city: "Karnal",
          state: "Haryana",
          pincode: "132001",
          lat: 29.6857,
          lng: 76.9905
        },
        contactInfo: { phone: "9812034567", email: "syngenta.karnal@kisansetu.com" },
        salesStats: { totalSold: 45, totalRevenue: 44100 }
      },
      {
        sellerId,
        name: "Pusa 1121 Certified Basmati Seeds (Paddy)",
        type: "seed",
        category: "Seed",
        brand: "ICAR / IARI Pusa",
        price: 1150,
        stock: 250,
        minimumOrder: 1,
        qualityGrade: "A",
        status: "Available",
        isApproved: "approved",
        composition: "Foundation Grade Pure Seeds (Germination > 92%)",
        suitableCrops: ["Paddy / Rice Cultivation"],
        description: "ICAR certified Pusa 1121 paddy seeds treated with Thiram for seed-borne disease protection. Ensures high tillering and uniform grain length.",
        usageInstructions: "Soak in clean water for 24 hours with carbendazim treatment before sowing in nursery bed.",
        images: [
          "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800&auto=format&fit=crop"
        ],
        primaryImageIndex: 0,
        location: {
          address: "Seeds Corporation Hub",
          city: "Karnal",
          state: "Haryana",
          pincode: "132001",
          lat: 29.6857,
          lng: 76.9905
        },
        contactInfo: { phone: "9812034567", email: "pusa.seeds@kisansetu.com" },
        salesStats: { totalSold: 110, totalRevenue: 126500 }
      },
      {
        sellerId,
        name: "Kisan 16L Battery Operated Power Sprayer Pump",
        type: "equipment",
        category: "Equipment",
        brand: "Kisan Craft",
        price: 2750,
        stock: 90,
        minimumOrder: 1,
        qualityGrade: "A",
        status: "Available",
        isApproved: "approved",
        composition: "12V 8Ah Lead Acid Battery, Heavy Duty Brass Nozzle",
        suitableCrops: ["All Agricultural Crops, Orchards & Polyhouse"],
        description: "Rechargeable 16-liter knapsack battery sprayer pump. Includes 4 different spraying nozzles, stainless steel telescopic lance, and back-rest cushion pad.",
        usageInstructions: "Charge for 6 hours before initial use. Provides up to 5 hours continuous spraying per single charge.",
        images: [
          "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop"
        ],
        primaryImageIndex: 0,
        location: {
          address: "Agro Machinery Yard",
          city: "Ludhiana",
          state: "Punjab",
          pincode: "141001",
          lat: 30.9010,
          lng: 75.8573
        },
        contactInfo: { phone: "9814033221", email: "machinery.ludhiana@kisansetu.com" },
        salesStats: { totalSold: 35, totalRevenue: 96250 }
      },
      {
        sellerId,
        name: "Organic Earthworm Vermicompost Bio-Fertilizer (50kg)",
        type: "fertilizer",
        category: "Fertilizer",
        brand: "Kisan Organic Care",
        price: 480,
        stock: 400,
        minimumOrder: 2,
        qualityGrade: "A",
        status: "Available",
        isApproved: "approved",
        composition: "100% Eisenia Fetida Processed Organic Humus Manure",
        suitableCrops: ["Organic Vegetables", "Fruit Orchards", "Flowers", "Polyhouse Crops"],
        description: "Enriched organic vermicompost packed with beneficial micro-organisms, humic acid, and plant micronutrients. Restores soil fertility and water retention capacity.",
        usageInstructions: "Apply 500g - 1kg around the root zone of mature plants or 2 Tons per Acre during soil preparation.",
        images: [
          "https://images.unsplash.com/photo-1584473457406-6df42d72591c?w=800&auto=format&fit=crop"
        ],
        primaryImageIndex: 0,
        location: {
          address: "Organic Bio-Farm Station",
          city: "Udaipur",
          state: "Rajasthan",
          pincode: "313001",
          lat: 24.5854,
          lng: 73.7125
        },
        contactInfo: { phone: "9414088990", email: "vermi.organic@kisansetu.com" },
        salesStats: { totalSold: 140, totalRevenue: 67200 }
      }
    ];

    // Insert new data into MongoDB
    console.log("🌾 Inserting 9 fresh realistic crops into MongoDB...");
    const insertedCrops = await Crop.insertMany(freshCrops);
    console.log(`✅ Successfully seeded ${insertedCrops.length} crops!`);

    console.log("💊 Inserting 8 fresh pesticides, fertilizers & equipment into MongoDB...");
    const insertedProducts = await Product.insertMany(freshProducts);
    console.log(`✅ Successfully seeded ${insertedProducts.length} products!`);

    console.log("🎉 Database Seed Completed Successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding database:", err);
    process.exit(1);
  }
}

seedData();
