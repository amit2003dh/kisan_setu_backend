// Delivery Routes
const router = require("express").Router();
const Delivery = require("../models/Delivery");
const DeliveryPartner = require("../models/DeliveryPartner");
const Order = require("../models/Order");
const mongoose = require("mongoose");
const authMiddleware = require("../middleware/auth");

// Get delivery by ID
router.get("/:deliveryId", authMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error: "Database not connected",
        message: "MongoDB is not connected. Please check your database connection."
      });
    }

    const { deliveryId } = req.params;

    // Get the delivery with populated data
    const Delivery = require("../models/Delivery");
    const delivery = await Delivery.findById(deliveryId)
      .populate('orderId', 'total status items buyerId sellerId')
      .populate('orderId.buyerId', 'name phone email address')
      .populate('orderId.sellerId', 'name phone email address')
      .populate('partnerId', 'name phone email');

    if (!delivery) {
      return res.status(404).json({
        error: "Delivery not found",
        message: "No delivery found with this ID"
      });
    }

    res.json({
      success: true,
      delivery: delivery
    });

  } catch (error) {
    console.error("Get delivery error:", error);
    res.status(500).json({
      error: "Failed to fetch delivery",
      message: error.message || "Failed to retrieve delivery details"
    });
  }
});

// Assign delivery to available partner (automatic assignment)
router.post("/assign/:orderId", async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error: "Database not connected",
        message: "MongoDB is not connected. Please check your database connection."
      });
    }

    const { orderId } = req.params;
    const { manualPartnerId, priority = "distance" } = req.body; // manualPartnerId for manual assignment

    // Get the order details
    const order = await Order.findById(orderId).populate('buyerId sellerId');
    if (!order) {
      return res.status(404).json({
        error: "Order not found",
        message: "No order found with this ID"
      });
    }

    // Check if delivery already exists
    const existingDelivery = await Delivery.findOne({ orderId });
    if (existingDelivery) {
      return res.status(400).json({
        error: "Delivery already assigned",
        message: "This order already has a delivery assigned"
      });
    }

    let selectedPartner;

    if (manualPartnerId) {
      // Manual assignment
      selectedPartner = await DeliveryPartner.findById(manualPartnerId);
      if (!selectedPartner) {
        return res.status(404).json({
          error: "Delivery partner not found",
          message: "No delivery partner found with this ID"
        });
      }
    } else {
      // Automatic assignment - find available partners
      const availablePartners = await DeliveryPartner.find({
        status: "available",
        isOnline: true
      }).populate('userId', 'name email phone');

      if (availablePartners.length === 0) {
        return res.status(404).json({
          error: "No available partners",
          message: "No delivery partners are currently available"
        });
      }

      // Simple distance-based assignment (in real app, use actual geolocation)
      selectedPartner = availablePartners[0];
      console.log(`🚚 Auto-assigned delivery to partner: ${selectedPartner.name}`);
    }

    // Create delivery assignment
    const delivery = new Delivery({
      orderId: orderId,
      partnerId: selectedPartner._id,
      assignedAt: new Date(),
      status: "Assigned",
      currentLocation: {
        lat: selectedPartner.currentLocation?.lat || 0,
        lng: selectedPartner.currentLocation?.lng || 0,
        status: "Assigned",
        lastUpdated: new Date()
      },
      destination: {
        lat: order.deliveryAddress?.lat || 0,
        lng: order.deliveryAddress?.lng || 0,
        address: order.deliveryAddress?.address || "Delivery address",
        city: order.deliveryAddress?.city || "",
        state: order.deliveryAddress?.state || "",
        pincode: order.deliveryAddress?.pincode || ""
      },
      estimatedDeliveryTime: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours from now
    });

    await delivery.save();

    // Update partner status
    selectedPartner.status = "busy";
    await selectedPartner.save();

    // Update order status
    order.status = "Out for Delivery";
    await order.save();

    console.log(`✅ Delivery assigned successfully: ${delivery._id}`);

    res.status(201).json({
      success: true,
      message: "Delivery assigned successfully",
      delivery: await Delivery.findById(delivery._id)
        .populate('orderId', 'total status items')
        .populate('partnerId', 'name phone email')
    });

  } catch (error) {
    console.error("Assign delivery error:", error);
    res.status(500).json({
      error: "Failed to assign delivery",
      message: error.message || "Failed to assign delivery"
    });
  }
});

// Get available delivery partners for assignment
router.get("/available-partners", async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error: "Database not connected",
        message: "MongoDB is not connected. Please check your database connection."
      });
    }

    const availablePartners = await DeliveryPartner.find({
      status: "available",
      isOnline: true
    }).populate('userId', 'name email phone');

    res.json({
      success: true,
      partners: availablePartners,
      count: availablePartners.length
    });

  } catch (error) {
    console.error("Get available partners error:", error);
    res.status(500).json({
      error: "Failed to fetch available partners",
      message: error.message || "Failed to retrieve available partners"
    });
  }
});

// Get pending orders that need delivery assignment
router.get("/pending-orders", async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error: "Database not connected",
        message: "MongoDB is not connected. Please check your database connection."
      });
    }

    const pendingOrders = await Order.find({
      status: { $in: ["Confirmed", "Processing"] }
    }).populate('buyerId sellerId', 'name email phone');

    // Filter out orders that already have deliveries
    const ordersWithDeliveries = await Delivery.find({
      orderId: { $in: pendingOrders.map(order => order._id) }
    }).distinct('orderId');

    const pendingOrdersWithoutDelivery = pendingOrders.filter(
      order => !ordersWithDeliveries.includes(order._id)
    );

    res.json({
      success: true,
      orders: pendingOrdersWithoutDelivery,
      count: pendingOrdersWithoutDelivery.length
    });

  } catch (error) {
    console.error("Get pending orders error:", error);
    res.status(500).json({
      error: "Failed to fetch pending orders",
      message: error.message || "Failed to retrieve pending orders"
    });
  }
});

router.put("/location/:id", async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error: "Database not connected",
        message: "MongoDB is not connected. Please check your database connection."
      });
    }

    const { lat, lng, status } = req.body.location || req.body;
    
    // Update delivery location and emit socket event
    const delivery = await Delivery.findByIdAndUpdate(
      req.params.id,
      {
        currentLocation: { lat, lng, status: status || "In Transit" },
        status: status || "In Transit"
      },
      { new: true }
    );

    // Emit real-time update to tracking clients
    const { io } = require('../server');
    if (io) {
      io.to(req.params.id).emit("locationUpdate", {
        lat,
        lng,
        status: status || "In Transit"
      });
    }

    res.send({ success: true, delivery });
  } catch (error) {
    console.error("Update delivery location error:", error);
    res.status(500).json({
      error: "Failed to update location",
      message: error.message || "Failed to update delivery location"
    });
  }
});

router.get("/location/:id", async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error: "Database not connected",
        message: "MongoDB is not connected. Please check your database connection."
      });
    }

    const delivery = await Delivery.findById(req.params.id);
    if (!delivery || !delivery.currentLocation) {
      return res.status(404).json({
        error: "Delivery not found",
        message: "Delivery location not found"
      });
    }

    // Handle both old string format and new object format
    let location;
    if (typeof delivery.currentLocation === 'string') {
      const [lat, lng] = delivery.currentLocation.split(",");
      location = { lat: Number(lat), lng: Number(lng) };
    } else {
      location = delivery.currentLocation;
    }

    res.send(location);
  } catch (error) {
    console.error("Get delivery location error:", error);
    res.status(500).json({
      error: "Failed to fetch location",
      message: error.message || "Failed to retrieve delivery location"
    });
  }
});
router.get("/tracking/:deliveryId", async (req, res) => {
  try {
    const order = await Order.findById(req.params.deliveryId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Get pickup location from order
    let pickupLocation = null;
    if (order.deliveryInfo && order.deliveryInfo.pickupAddress) {
      const pickupAddress = order.deliveryInfo.pickupAddress;
      pickupLocation = {
        lat: pickupAddress.lat || 0,
        lng: pickupAddress.lng || 0,
        address: `${pickupAddress.address}${pickupAddress.city ? `, ${pickupAddress.city}` : ''}${pickupAddress.state ? `, ${pickupAddress.state}` : ''}${pickupAddress.pincode ? ` - ${pickupAddress.pincode}` : ''}`
      };
    }

    res.json({
      currentLocation: order.deliveryPartnerInfo?.currentLocation || order.deliveryInfo?.currentLocation || {
        lat: order.deliveryInfo?.pickupAddress?.lat || 22.7196,
        lng: order.deliveryInfo?.pickupAddress?.lng || 75.8577,
        status: order.status
      },
      pickupLocation: pickupLocation,
      destination: {
        lat: order.deliveryInfo?.deliveryAddress?.lat,
        lng: order.deliveryInfo?.deliveryAddress?.lng,
        address: order.deliveryInfo?.deliveryAddress?.address
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.get("/tracking/:id", async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error: "Database not connected",
        message: "MongoDB is not connected. Please check your database connection."
      });
    }

    let delivery = await Delivery.findById(req.params.id)
      .populate('orderId')
      .populate('partnerId', 'name phone address location');
    
    // If no delivery found, try to find by orderId
    if (!delivery) {
      const Order = require('../models/Order');
      const order = await Order.findById(req.params.id).populate('buyerId', 'name phone address');
      
      if (order) {
        // Create a mock delivery object for tracking
        delivery = {
          _id: order._id,
          orderId: order,
          currentLocation: {
            lat: 0,
            lng: 0,
            status: order.status || "Confirmed"
          },
          status: order.status || "Confirmed",
          destination: null,
          partnerId: null
        };
      }
    }
    
    if (!delivery) {
      return res.status(404).json({
        error: "Delivery not found",
        message: "No delivery or order found with this ID"
      });
    }

    // Parse currentLocation for backward compatibility
    let currentLocation = delivery.currentLocation;
    if (typeof currentLocation === 'string') {
      const [lat, lng] = currentLocation.split(",");
      currentLocation = { 
        lat: Number(lat), 
        lng: Number(lng), 
        status: delivery.status || "In Transit" 
      };
    }

    // Get destination from order delivery address
    let destination = null;
    let pickupLocation = null;
    let customerInfo = null;
    let providerInfo = null;

    if (delivery.orderId) {
      // Customer information
      customerInfo = {
        name: "Customer",
        phone: null,
        address: null
      };

      // Try to get buyer information from populated order
      if (delivery.orderId.buyerId) {
        customerInfo = {
          name: delivery.orderId.buyerId.name,
          phone: delivery.orderId.buyerId.phone,
          address: delivery.orderId.buyerId.address || delivery.orderId.deliveryAddress
        };
      }

      // Use pickup address from order as pickup location
      if (delivery.orderId.deliveryInfo && delivery.orderId.deliveryInfo.pickupAddress) {
        const pickupAddress = delivery.orderId.deliveryInfo.pickupAddress;
        pickupLocation = {
          lat: pickupAddress.lat || 0,
          lng: pickupAddress.lng || 0,
          address: `${pickupAddress.address}${pickupAddress.city ? `, ${pickupAddress.city}` : ''}${pickupAddress.state ? `, ${pickupAddress.state}` : ''}${pickupAddress.pincode ? ` - ${pickupAddress.pincode}` : ''}`
        };
      }

      // Use delivery address from order as destination
      if (delivery.orderId.deliveryInfo && delivery.orderId.deliveryInfo.deliveryAddress) {
        const orderAddress = delivery.orderId.deliveryInfo.deliveryAddress;
        destination = {
          lat: orderAddress.lat || 0,
          lng: orderAddress.lng || 0,
          address: `${orderAddress.address}${orderAddress.city ? `, ${orderAddress.city}` : ''}${orderAddress.state ? `, ${orderAddress.state}` : ''}${orderAddress.pincode ? ` - ${orderAddress.pincode}` : ''}`
        };
      }
    }

    // Provider (delivery partner) information
    if (delivery.partnerId) {
      providerInfo = {
        name: delivery.partnerId.name,
        phone: delivery.partnerId.phone,
        address: delivery.partnerId.address || {
          address: delivery.partnerId.location || "Location not available"
        }
      };
    }

    // If no destination found, use customer address
    if (!destination && customerInfo && customerInfo.address) {
      const customerAddress = customerInfo.address;
      if (typeof customerAddress === 'object') {
        destination = {
          lat: customerAddress.lat || 0,
          lng: customerAddress.lng || 0,
          address: `${customerAddress.address}${customerAddress.city ? `, ${customerAddress.city}` : ''}${customerAddress.state ? `, ${customerAddress.state}` : ''}${customerAddress.pincode ? ` - ${customerAddress.pincode}` : ''}`
        };
      } else {
        destination = {
          lat: 0,
          lng: 0,
          address: customerAddress
        };
      }
    }

    res.json({
      currentLocation,
      pickupLocation,
      destination,
      customerInfo,
      providerInfo,
      deliveryStatus: delivery.status || "Confirmed"
    });
  } catch (error) {
    console.error("Get tracking data error:", error);
    res.status(500).json({
      error: "Failed to fetch tracking data",
      message: error.message || "Failed to retrieve tracking information"
    });
  }
});

module.exports = router;
