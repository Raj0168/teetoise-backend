const Razorpay = require("razorpay");
const crypto = require("crypto");
const { Pool } = require("pg");
const pool = new Pool();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const createOrder = async (req, res) => {
  const { userId } = req.body;

  try {
    // Get the checkout details
    const { rows } = await pool.query(
      "SELECT * FROM user_checkouts WHERE user_id = $1",
      [userId]
    );
    if (rows.length === 0)
      return res.status(404).json({ error: "No active checkout found" });

    const amount = rows[0].total_amount_after_coupon * 100; // Convert to paise

    // Create Razorpay order
    const options = {
      amount: amount,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    res
      .status(200)
      .json({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
      });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create Razorpay order" });
  }
};
