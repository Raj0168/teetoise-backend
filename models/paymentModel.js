const pool = require("../config/db");
const Razorpay = require("razorpay");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const createPayment = async (paymentData) => {
  const {
    user_id,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    amount,
    payment_mode,
    payment_status,
  } = paymentData;
  await pool.query(
    `
    INSERT INTO user_payments (user_id, razorpay_order_id, razorpay_payment_id, razorpay_signature, amount, payment_mode, payment_status, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
  `,
    [
      user_id,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      amount,
      payment_mode,
      payment_status,
    ]
  );
};

// Function to create Razorpay order
const createRazorpayOrder = async (user_id, amount) => {
  try {
    const orderOptions = {
      amount, // Amount in paise
      currency: "INR",
      receipt: `receipt_${user_id.substring(0, 30)}`,
    };

    const razorpayOrder = await razorpay.orders.create(orderOptions);

    // Insert Razorpay order into your database if needed
    const query = `
      INSERT INTO create_razorpay_order (user_id, amount, razorpay_order_id)
      VALUES ($1, $2, $3) RETURNING id
    `;
    const values = [user_id, amount, razorpayOrder.id];
    await pool.query(query, values);

    return razorpayOrder; // Return the full Razorpay order object
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    throw error;
  }
};

module.exports = {
  createPayment,
  createRazorpayOrder,
};
