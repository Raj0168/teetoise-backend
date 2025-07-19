const pool = require("../config/db");

const RefundModel = {
  // Cancel an order item
  cancelOrderItem: async (user_id, order_id, detail_id, cancelReason) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Check if the order exists
      const orderResult = await client.query(
        "SELECT razorpay_order_id, created_at FROM user_orders WHERE order_id = $1 AND user_id = $2",
        [order_id, user_id]
      );

      if (orderResult.rowCount === 0) {
        throw new Error("Order not found");
      }

      const razorpay_order_id = orderResult.rows[0].razorpay_order_id;
      const orderDate = new Date(orderResult.rows[0].created_at);
      const currentDate = new Date();

      // Check if order is older than 14 days
      const daysDifference = Math.ceil(
        (currentDate - orderDate) / (1000 * 60 * 60 * 24)
      );
      if (daysDifference > 14) {
        throw new Error("The exchange/return period has expired.");
      }

      // Check if there is a payment record for the order
      const paymentResult = await client.query(
        "SELECT payment_id, razorpay_payment_id, amount FROM user_payments WHERE razorpay_order_id = $1",
        [razorpay_order_id]
      );

      if (paymentResult.rowCount === 0) {
        throw new Error("No payment record found for the given order");
      }

      const { payment_id, razorpay_payment_id, amount } = paymentResult.rows[0];

      // Check the current status of the order detail item
      const statusResult = await client.query(
        "SELECT product_status, product_price, is_exchanged, is_returned FROM user_order_details WHERE order_id = $1 AND detail_id = $2",
        [order_id, detail_id]
      );

      if (statusResult.rowCount === 0) {
        throw new Error("Order item not found");
      }

      const { product_status, product_price, is_exchanged, is_returned } =
        statusResult.rows[0];

      // Only proceed with cancellation if status is "confirmed"
      if (product_status !== "confirmed") {
        throw new Error("Order item is not eligible for cancellation");
      }

      // Mark the order detail item as canceled
      const cancelResult = await client.query(
        "UPDATE user_order_details SET product_status = 'canceled', is_cancelled = true WHERE order_id = $1 AND detail_id = $2 RETURNING *",
        [order_id, detail_id]
      );

      // Calculate refund amount
      const refundAmount = product_price;
      const initRefundCancelMessage =
        "Your refund has been initiated and will take up to 5 business days.";

      // Insert refund record into user_refunds
      await client.query(
        "INSERT INTO user_refunds (original_order_id, refund_status, refund_amount, payment_id, payment_method, refund_reason, detail_id, user_id, return_message) VALUES ($1, 'initiated', $2, $3, 'razorpay', $4, $5, $6, $7)",
        [
          order_id,
          refundAmount,
          payment_id,
          cancelReason,
          detail_id,
          user_id,
          initRefundCancelMessage,
        ]
      );

      await client.query("COMMIT");
      return cancelResult.rows[0];
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  // Request a return for an item
  requestReturnForItem: async (user_id, order_id, detail_id, returnReason) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Check if the order exists
      const orderResult = await client.query(
        "SELECT razorpay_order_id, created_at FROM user_orders WHERE order_id = $1 AND user_id = $2",
        [order_id, user_id]
      );

      if (orderResult.rowCount === 0) {
        throw new Error("Order not found");
      }

      const razorpay_order_id = orderResult.rows[0].razorpay_order_id;
      const orderDate = new Date(orderResult.rows[0].created_at);
      const currentDate = new Date();

      // Check if the order is older than 14 days
      const daysDifference = Math.ceil(
        (currentDate - orderDate) / (1000 * 60 * 60 * 24)
      );
      if (daysDifference > 14) {
        throw new Error("The return period has expired.");
      }

      // Check the current status of the order detail item
      const statusResult = await client.query(
        "SELECT product_status, product_price, is_exchanged, is_returned FROM user_order_details WHERE order_id = $1 AND detail_id = $2",
        [order_id, detail_id]
      );

      if (statusResult.rowCount === 0) {
        throw new Error("Order item not found");
      }

      const { product_status, product_price } = statusResult.rows[0];

      // Only proceed with return if status is "delivered"
      if (product_status !== "delivered") {
        throw new Error("Order item is not eligible for return");
      }

      // Mark the order detail item as return-requested
      await client.query(
        "UPDATE user_order_details SET product_status = 'return-requested', is_returned = true WHERE order_id = $1 AND detail_id = $2 RETURNING *",
        [order_id, detail_id]
      );

      // Insert return request into user_return_orders
      const returnResult = await client.query(
        "INSERT INTO user_return_orders (original_order_id, user_id, return_reason, return_status, detail_id) VALUES ($1, $2, $3, 'requested', $4) RETURNING *",
        [order_id, user_id, returnReason, detail_id]
      );

      // Check if there is a payment record for the order
      const paymentResult = await client.query(
        "SELECT payment_id, razorpay_payment_id, amount FROM user_payments WHERE razorpay_order_id = $1",
        [razorpay_order_id]
      );

      if (paymentResult.rowCount === 0) {
        throw new Error("No payment record found for the given order");
      }

      const { payment_id } = paymentResult.rows[0];

      // Calculate refund amount (product price)
      const refundAmount = product_price;
      const initRefundReturnMessage =
        "Your return has been initiated. The refund will be processed once the return is confirmed.";

      console.log(
        order_id,
        refundAmount,
        payment_id,
        returnReason,
        detail_id,
        user_id,
        initRefundReturnMessage
      );
      // Insert refund record into user_refunds
      await client.query(
        "INSERT INTO user_refunds (original_order_id, refund_status, refund_amount, payment_id, payment_method, refund_reason, detail_id, user_id, return_message) VALUES ($1, 'initiated', $2, $3, 'razorpay', $4, $5, $6, $7)",
        [
          order_id,
          refundAmount,
          payment_id,
          returnReason,
          detail_id,
          user_id,
          initRefundReturnMessage,
        ]
      );

      await client.query("COMMIT");
      return returnResult.rows[0];
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  // Request an exchange for an item
  requestExchangeForItem: async (
    user_id,
    order_id,
    detail_id,
    exchangeReason,
    size
  ) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Check if the order exists and get the associated razorpay_order_id
      const orderResult = await client.query(
        "SELECT razorpay_order_id, created_at FROM user_orders WHERE order_id = $1 AND user_id = $2",
        [order_id, user_id]
      );

      if (orderResult.rowCount === 0) {
        throw new Error("Order not found");
      }

      const razorpay_order_id = orderResult.rows[0].razorpay_order_id;
      const orderDate = new Date(orderResult.rows[0].created_at);
      const currentDate = new Date();

      // Check if order is older than 14 days
      const daysDifference = Math.ceil(
        (currentDate - orderDate) / (1000 * 60 * 60 * 24)
      );
      if (daysDifference > 14) {
        throw new Error("The exchange period has expired.");
      }

      // Check the current status of the order detail item
      const statusResult = await client.query(
        "SELECT product_status FROM user_order_details WHERE order_id = $1 AND detail_id = $2",
        [order_id, detail_id]
      );

      if (statusResult.rowCount === 0) {
        throw new Error("Order item not found");
      }

      const { product_status } = statusResult.rows[0];

      if (product_status !== "delivered") {
        throw new Error("Order item is not eligible for exchange");
      }

      // Update the product status to "exchange-requested" and mark as exchanged
      await client.query(
        "UPDATE user_order_details SET product_status = 'exchange-requested', is_exchanged = true WHERE order_id = $1 AND detail_id = $2",
        [order_id, detail_id]
      );

      // Insert exchange request into user_exchange_orders
      const exchangeResult = await client.query(
        "INSERT INTO user_exchange_orders (original_order_id, user_id, exchange_reason, exchange_status, size) VALUES ($1, $2, $3, 'requested', $4) RETURNING *",
        [order_id, user_id, exchangeReason, size]
      );

      // Insert refund record for this exchange
      const paymentResult = await client.query(
        "SELECT payment_id, amount FROM user_payments WHERE razorpay_order_id = $1",
        [razorpay_order_id]
      );
      const { payment_id, amount } = paymentResult.rows[0];

      await client.query(
        "INSERT INTO user_refunds (original_order_id, refund_status, refund_amount, payment_id, payment_method, refund_reason) VALUES ($1, 'initiated', $2, $3, 'razorpay', $4)",
        [order_id, amount, payment_id, exchangeReason]
      );

      await client.query("COMMIT");
      return exchangeResult.rows[0];
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },
};

module.exports = RefundModel;
