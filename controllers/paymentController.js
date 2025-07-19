const crypto = require("crypto");
const {
  createPayment,
  createRazorpayOrder,
} = require("../models/paymentModel");
const {
  clearCheckoutData,
  getUserCheckoutDetails,
} = require("../models/userCheckoutModel");
const { getUserInfoById } = require("../models/user");
const {
  createOrder,
  createOrderDetails,
  createOrderStatus,
} = require("../models/orderModel");

const initiatePayment = async (req, res) => {
  try {
    const user_id = req.user.id;

    // Fetch user info and checkout details
    const userDetails = await getUserInfoById(user_id);
    const checkoutDetails = await getUserCheckoutDetails(user_id);

    if (!userDetails || !checkoutDetails) {
      return res.status(404).json({
        success: false,
        message: "User or checkout details not found.",
      });
    }

    // Create Razorpay order
    const amountInPaise =
      parseFloat(checkoutDetails?.checkout?.totalAmountAfterCoupon) * 100;

    const razorpayOrder = await createRazorpayOrder(user_id, amountInPaise);

    if (!razorpayOrder) {
      return res.status(500).json({
        success: false,
        message: "Failed to create Razorpay order.",
      });
    }

    // Send the response to frontend with Razorpay order details
    res.status(200).json({
      success: true,
      order_id: razorpayOrder.id,
      amount: parseFloat(checkoutDetails?.checkout?.totalAmountAfterCoupon),
      userDetails,
    });
  } catch (error) {
    console.error("Error initiating payment:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const verifyPaymentSignature = (order_id, payment_id, signature) => {
  const generatedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${order_id}|${payment_id}`)
    .digest("hex");
  return generatedSignature === signature;
};

const pool = require("../config/db");

const verifyPayment = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      delivery_address,
      delivery_pin_code,
      receipant_name,
      receipant_contact,
    } = req.body;

    const user_id = req.user.id;

    // Start a transaction
    await client.query("BEGIN");

    // Verify payment signature
    const isSignatureValid = verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isSignatureValid) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Payment verification failed.",
      });
    }

    // Fetch user and checkout details
    const userDetails = await getUserInfoById(user_id);
    const checkoutDetailsResponse = await getUserCheckoutDetails(user_id);
    const checkoutDetails = checkoutDetailsResponse?.checkout;

    if (!userDetails || !checkoutDetails) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "User or checkout details not found.",
      });
    }

    // Save payment details
    await createPayment({
      user_id,
      amount: checkoutDetails?.totalAmountAfterCoupon,
      payment_mode: "razorpay",
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      payment_status: "success",
    });

    // Create order
    const { order_id, public_order_id } = await createOrder({
      razorpay_order_id,
      user_id,
      amount: checkoutDetails.totalAmountAfterCoupon,
      coupon_discount: checkoutDetails.couponDiscount,
      delivery_address,
      delivery_pin_code,
      receipant_name,
      receipant_contact,
    });

    // Store order details (products from checkout details)
    const orderDetails = await createOrderDetails({
      order_id,
      public_order_id,
      product_status: "confirmed",
      items: checkoutDetails.items,
    });

    // Create order status entry
    for (const detail of orderDetails) {
      await createOrderStatus({
        order_id,
        public_order_id,
        user_id,
        order_status: "confirmed",
        order_type: "purchase",
        estimate_delivery: calculateEstimatedDeliveryDate(),
        detail_id: detail.detail_id,
      });
    }

    // Clear checkout data
    await clearCheckoutData(user_id);

    // Commit the transaction if everything is successful
    await client.query("COMMIT");

    // Respond with success
    res.status(200).json({
      order_id: public_order_id,
      success: true,
      message: "Payment verified and order created successfully.",
    });
  } catch (error) {
    // Rollback the transaction in case of any error
    await client.query("ROLLBACK");
    console.error("Error verifying payment:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    // Release the database client
    client.release();
  }
};

const calculateEstimatedDeliveryDate = () => {
  const today = new Date();
  const deliveryEstimate = new Date();
  deliveryEstimate.setDate(today.getDate() + 7);
  return deliveryEstimate.toISOString().split("T")[0];
};

module.exports = {
  verifyPayment,
  initiatePayment,
};
