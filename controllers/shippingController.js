const axios = require("axios");
const {
  getOrderDetailsById,
  getUserInfoById,
  getValidOrderItems,
} = require("../models/shippingModel");

// Fetch order details for view
const viewOrderDetails = async (req, res) => {
  const { order_id } = req.params;

  try {
    const order = await getOrderDetailsById(order_id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const userInfo = await getUserInfoById(order.user_id);

    const orderDetails = {
      ...order,
      customer_email: userInfo.email,
      backup_contact: userInfo.mobile_number,
    };

    return res.json(orderDetails);
  } catch (error) {
    console.error("Error fetching order details:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Place an order with ShipCorrect
const placeOrder = async (req, res) => {
  const { order_id, customer_email, landmark, state, city, secondary_contact } =
    req.body;

  try {
    const order = await getValidOrderItems(order_id);
    if (!order) {
      return res
        .status(404)
        .json({ error: "Order not found or no valid items to ship" });
    }

    const totalWeight = order.order_items.reduce((total, item) => {
      return total + item.product_quantity * 0.5;
    }, 0);

    const shipCorrectData = {
      api_key: process.env.SHIPCORRECT_API_KEY,
      customer_name: order.receipant_name,
      customer_email,
      customer_address1: order.delivery_address,
      customer_address2: "", // Optional
      customer_address_landmark: landmark || "",
      customer_address_state: state || "",
      customer_address_city: city || "",
      customer_address_pincode: order.delivery_pin_code,
      customer_contact_number1: order.receipant_contact,
      customer_contact_number2: secondary_contact || "",
      product_id: order.order_items.map((item) => item.product_id).join(", "),
      product_name: order.order_items
        .map((item) => item.product_name)
        .join(", "),
      sku: order.order_items.map((item) => item.product_sku).join(", "),
      mrp: order.order_items.map((item) => item.product_price).join(", "),
      product_size: order.order_items
        .map((item) => item.product_size)
        .join(", "),
      product_weight: totalWeight.toFixed(2) + "kg",
      pay_mode: "PREPAID",
      quantity: order.order_items.length,
      total_amount: order.amount,
      client_order_no: order.public_order_id,
    };

    const response = await axios.post(
      "https://shipcorrect.com/api/createForwardOrder.php",
      shipCorrectData,
      {
        headers: {
          username: process.env.SHIPCORRECT_USERNAME,
          password: process.env.SHIPCORRECT_PASSWORD,
        },
      }
    );

    if (response.data.success) {
      return res.json({
        message: "Order placed successfully",
        data: response.data,
      });
    } else {
      return res.status(400).json({ error: "Failed to place the order" });
    }
  } catch (error) {
    console.error("Error placing order:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  viewOrderDetails,
  placeOrder,
};
