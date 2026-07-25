const router = require("express").Router();
const authMiddleware = require("../middleware/auth");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Crop = require("../models/Crop");
const User = require("../models/User");
const Delivery = require("../models/Delivery");
const Message = require("../models/Message");

const DEFAULT_PICKUP = {
  address: "Seller Location",
  city: "Default City",
  state: "Default State",
  pincode: "000000",
  lat: 20.5937,
  lng: 78.9629
};

// Create single order
router.post("/create", authMiddleware, async (req, res) => {
  try {
    const { itemId, itemType, quantity = 1, price, deliveryAddress, paymentMethod, buyerId: bodyBuyerId } = req.body;
    const finalBuyerId = bodyBuyerId || req.userId;

    if (!itemId || !itemType || !price) {
      return res.status(400).json({ error: "Missing required fields", required: ["itemId", "itemType", "price"] });
    }

    let sellerId, pickupAddress, actualPrice, availableQuantity;

    if (itemType === "crop") {
      const crop = await Crop.findById(itemId);
      sellerId = crop?.sellerId;
      pickupAddress = crop?.location;
      actualPrice = crop?.price;
      availableQuantity = crop?.quantity;
    } else {
      const product = await Product.findById(itemId);
      sellerId = product?.sellerId;
      pickupAddress = product?.location;
      actualPrice = product?.price;
      availableQuantity = product?.stock;
    }

    if (availableQuantity !== undefined && availableQuantity < quantity) {
      return res.status(400).json({ error: "Insufficient quantity available", requested: quantity, available: availableQuantity });
    }
    if (!sellerId) return res.status(400).json({ error: "Seller not found" });

    const finalPickup = pickupAddress || DEFAULT_PICKUP;
    const finalPrice = actualPrice || price;

    const order = await Order.create({
      buyerId: finalBuyerId,
      sellerId,
      orderType: itemType === "crop" ? "crop_purchase" : "product_purchase",
      items: [{
        itemId,
        itemType,
        name: req.body.name || "Item",
        quantity,
        price: finalPrice
      }],
      total: quantity * finalPrice,
      status: "Confirmed",
      paymentMethod: paymentMethod || "COD",
      deliveryInfo: {
        deliveryAddress,
        pickupAddress: finalPickup,
        currentLocation: { lat: finalPickup.lat || 0, lng: finalPickup.lng || 0 }
      },
      orderTimeline: [{ status: "Confirmed", timestamp: new Date() }]
    });

    if (itemType === "crop") {
      await Crop.findByIdAndUpdate(itemId, {
        $inc: { quantity: -quantity, "salesStats.totalSold": quantity, "salesStats.totalRevenue": quantity * finalPrice }
      });
    } else {
      await Product.findByIdAndUpdate(itemId, {
        $inc: { stock: -quantity, "salesStats.totalSold": quantity, "salesStats.totalRevenue": quantity * finalPrice }
      });
    }

    const delivery = new Delivery({
      orderId: order._id,
      status: "Assigned",
      destination: deliveryAddress,
      currentLocation: { lat: finalPickup.lat || 0, lng: finalPickup.lng || 0 }
    });
    await delivery.save();

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create orders from cart
router.post("/create-from-cart", authMiddleware, async (req, res) => {
  try {
    const { items, deliveryAddress, paymentMethod, buyerId: bodyBuyerId } = req.body;
    const finalBuyerId = bodyBuyerId || req.userId;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Invalid cart items" });
    }

    const groupedItems = {};
    for (const item of items) {
      const key = `${item.itemType}_${item.itemId}`;
      if (!groupedItems[key]) {
        groupedItems[key] = { ...item, totalQuantity: 0 };
      }
      groupedItems[key].totalQuantity += item.quantity;
    }

    const orders = [];

    for (const [key, item] of Object.entries(groupedItems)) {
      let sellerId, pickupAddress, actualPrice, availableQuantity;

      if (item.itemType === "crop") {
        const crop = await Crop.findById(item.itemId);
        sellerId = crop?.sellerId;
        pickupAddress = crop?.location;
        actualPrice = crop?.price;
        availableQuantity = crop?.quantity;
      } else {
        const product = await Product.findById(item.itemId);
        sellerId = product?.sellerId;
        pickupAddress = product?.location;
        actualPrice = product?.price;
        availableQuantity = product?.stock;
      }

      if (availableQuantity !== undefined && availableQuantity < item.totalQuantity) continue;
      if (!sellerId) continue;

      const finalPickup = pickupAddress || DEFAULT_PICKUP;
      const finalPrice = actualPrice || item.price;

      const order = await Order.create({
        buyerId: finalBuyerId,
        sellerId,
        orderType: item.itemType === "crop" ? "crop_purchase" : "product_purchase",
        items: [{
          itemId: item.itemId,
          itemType: item.itemType,
          name: item.name,
          quantity: item.totalQuantity,
          price: finalPrice
        }],
        total: item.totalQuantity * finalPrice,
        status: "Confirmed",
        paymentMethod: paymentMethod || "COD",
        deliveryInfo: {
          deliveryAddress,
          pickupAddress: finalPickup,
          currentLocation: { lat: finalPickup.lat || 0, lng: finalPickup.lng || 0 }
        },
        orderTimeline: [{ status: "Confirmed", timestamp: new Date() }]
      });

      const delivery = new Delivery({
        orderId: order._id,
        status: "Assigned",
        destination: deliveryAddress,
        currentLocation: { lat: finalPickup.lat || 0, lng: finalPickup.lng || 0 }
      });
      await delivery.save();

      orders.push(order);
    }

    for (const [key, item] of Object.entries(groupedItems)) {
      const itemPrice = item.price || 0;
      if (item.itemType === "crop") {
        await Crop.findByIdAndUpdate(item.itemId, {
          $inc: { quantity: -item.totalQuantity, "salesStats.totalSold": item.totalQuantity, "salesStats.totalRevenue": item.totalQuantity * itemPrice }
        });
      } else {
        await Product.findByIdAndUpdate(item.itemId, {
          $inc: { stock: -item.totalQuantity, "salesStats.totalSold": item.totalQuantity, "salesStats.totalRevenue": item.totalQuantity * itemPrice }
        });
      }
    }

    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Assign delivery partner
router.put("/:orderId/assign-delivery-partner", authMiddleware, async (req, res) => {
  try {
    const { deliveryPartnerId, partnerLocation } = req.body;
    if (!deliveryPartnerId) return res.status(400).json({ error: "Delivery partner ID is required" });

    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });

    order.deliveryInfo.deliveryPartnerId = deliveryPartnerId;
    if (partnerLocation?.lat && partnerLocation?.lng) {
      order.deliveryInfo.currentLocation = { lat: partnerLocation.lat, lng: partnerLocation.lng };
    }

    order.orderTimeline.push({ status: "Delivery Partner Assigned", timestamp: new Date() });
    await order.save();

    res.json({ success: true, order, message: "Delivery partner assigned successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update delivery location
router.put("/:orderId/update-location", authMiddleware, async (req, res) => {
  try {
    const { currentLocation } = req.body;
    if (!currentLocation?.lat || !currentLocation?.lng) {
      return res.status(400).json({ error: "Current location (lat, lng) is required" });
    }

    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });

    order.deliveryInfo.currentLocation = { lat: currentLocation.lat, lng: currentLocation.lng };
    await order.save();

    res.json({ success: true, order, message: "Location updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Role-based catch-all orders
router.get("/", authMiddleware, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);
    if (!currentUser) return res.status(404).json({ error: "User not found" });

    let query = {};
    if (currentUser.role === "buyer") query = { buyerId: req.userId };
    else if (currentUser.role === "farmer") query = { buyerId: req.userId, orderType: "product_purchase" };
    else if (currentUser.role === "seller") query = { sellerId: req.userId, orderType: "product_purchase" };
    else if (currentUser.role === "delivery_partner") query = { "deliveryInfo.deliveryPartnerId": req.userId };

    const orders = await Order.find(query).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch orders", message: err.message });
  }
});

// Role specific GET endpoints
router.get("/buyer", authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find({ buyerId: req.userId }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/farmer", authMiddleware, async (req, res) => {
  try {
    const sales = await Order.find({ sellerId: req.userId, orderType: "crop_sale" }).sort({ createdAt: -1 });
    const cropPurchases = await Order.find({ buyerId: req.userId, orderType: "crop_purchase" }).sort({ createdAt: -1 });
    const productPurchases = await Order.find({ buyerId: req.userId, orderType: "product_purchase" }).sort({ createdAt: -1 });

    const purchases = [...cropPurchases, ...productPurchases].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ sales, purchases });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/seller", authMiddleware, async (req, res) => {
  try {
    const cropSales = await Order.find({ sellerId: req.userId, orderType: "crop_sale" }).sort({ createdAt: -1 });
    const productSales = await Order.find({ sellerId: req.userId, orderType: "product_purchase" }).sort({ createdAt: -1 });
    res.json([...cropSales, ...productSales]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/delivery", authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find({ "deliveryInfo.deliveryPartnerId": req.userId });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update status
router.put("/:id/status", authMiddleware, async (req, res) => {
  try {
    const { status, location } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status, ...(location && { "deliveryInfo.currentLocation": location }) },
      { new: true }
    );

    await Message.create({
      orderId: order._id,
      senderId: req.userId,
      senderType: "system",
      content: `Order status updated to ${status}`,
      messageType: "status_update"
    });

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Single order by ID
router.get("/:orderId", authMiddleware, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Order messages
router.post("/:orderId/message", authMiddleware, async (req, res) => {
  try {
    const { message, senderType } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: "Message content is required" });

    const finalSenderType = senderType || "buyer";
    const allowed = ["buyer", "seller", "delivery_partner", "system", "farmer"];
    if (!allowed.includes(finalSenderType)) {
      return res.status(400).json({ error: "Invalid sender type" });
    }

    const newMessage = await Message.create({
      orderId: req.params.orderId,
      senderId: req.userId,
      senderType: finalSenderType,
      content: message.trim(),
      messageType: "order_communication"
    });

    res.json({ success: true, message: newMessage });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:orderId/messages", authMiddleware, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const allMessages = await Message.find({ orderId: req.params.orderId })
      .populate("senderId", "name email role")
      .sort({ createdAt: 1 });

    res.json(allMessages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
