const pool = require("../config/db");

const {
  getUserOrders,
  getAllUserOrders,
  cancelOrder,
  requestReturn,
  requestExchange,
  getUserOrderByOrderId,
  getOrderDetailsV2,
  getOrderDetailsForProduct,
  getRefundByDetailAndUser,
} = require("../models/orderModel");

exports.getRefunds = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT refund_id, original_order_id, refund_status, refund_amount, payment_id, payment_method, refund_date, refund_reason, user_id
       FROM user_refunds ORDER BY refund_date DESC`
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getRefundDetails = async (req, res) => {
  const { refund_id } = req.params;

  try {
    // Query to get refund details
    const refundResult = await pool.query(
      `SELECT * FROM user_refunds WHERE refund_id = $1`,
      [refund_id]
    );

    if (refundResult.rows.length === 0) {
      return res.status(404).json({ error: "Refund not found" });
    }

    const refund = refundResult.rows[0];

    // Query to get user details
    const userResult = await pool.query(
      `SELECT email, user_name, mobile_number FROM users WHERE id = $1`,
      [refund.user_id]
    );

    const user = userResult.rows[0];

    // Query to get product details
    const productResult = await pool.query(
      `SELECT * FROM user_order_details WHERE detail_id = $1`,
      [refund.detail_id]
    );

    const payment_details = await pool.query(
      `SELECT * FROM user_payments WHERE payment_id = $1`,
      [refund.payment_id]
    );

    const paymentDetails = payment_details.rows[0];
    const products = productResult.rows;

    res.status(200).json({
      refund,
      user,
      products,
      paymentDetails,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.updateRefundStatus = async (req, res) => {
  const { refund_id } = req.params;

  try {
    // Check if the refund exists
    const refundResult = await pool.query(
      `SELECT * FROM user_refunds WHERE refund_id = $1`,
      [refund_id]
    );

    if (refundResult.rows.length === 0) {
      return res.status(404).json({ error: "Refund not found" });
    }

    // Update the refund status and return message
    await pool.query(
      `UPDATE user_refunds 
       SET refund_status = 'processed', 
           return_message = 'Your amount has been reverted to the original source. For any issues, feel free to contact us.' 
       WHERE refund_id = $1`,
      [refund_id]
    );

    res.status(200).json({ message: "Refund status updated to 'refunded'" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.acceptReturnRequest = async (req, res) => {
  const { refund_id } = req.params;

  try {
    // Check if the refund exists
    const refundResult = await pool.query(
      `SELECT * FROM user_refunds WHERE refund_id = $1`,
      [refund_id]
    );

    if (refundResult.rows.length === 0) {
      return res.status(404).json({ error: "Refund not found" });
    }

    // Update the refund status and return message
    await pool.query(
      `UPDATE user_refunds 
       SET refund_status = 'accepted', 
           return_message = 'Your return has been accepted after, hold tight, we will review the product and refund the amount. For any queries, feel free to reach out to us..' 
       WHERE refund_id = $1`,
      [refund_id]
    );

    res.status(200).json({ message: "Refund status updated to 'refunded'" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.declineRefund = async (req, res) => {
  const { refund_id } = req.params;
  const { decline_message } = req.body; // Take decline message from payload

  try {
    // Check if refund exists
    const refundResult = await pool.query(
      `SELECT * FROM user_refunds WHERE refund_id = $1`,
      [refund_id]
    );

    if (refundResult.rows.length === 0) {
      return res.status(404).json({ error: "Refund not found" });
    }

    // Update refund status to 'declined' and set custom message
    await pool.query(
      `UPDATE user_refunds 
       SET refund_status = 'failed', 
           return_message = $1 
       WHERE refund_id = $2`,
      [decline_message || "Your refund has been declined.", refund_id]
    );

    res.status(200).json({ message: "Refund has been declined." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getUserOrders = async (req, res) => {
  const user_id = req.user.id;
  try {
    const orders = await getUserOrders(user_id);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOrdersByUser = async (req, res) => {
  const user_id = req.user.id;
  try {
    const orders = await getOrderDetailsV2(user_id);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get All User Orders (Admin)
exports.getAllUserOrders = async (req, res) => {
  try {
    const orders = await getAllUserOrders();
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get User Order by Order ID
exports.getUserOrderByOrderId = async (req, res) => {
  const user_id = req.user.id;
  const { order_id } = req.params;
  try {
    const order = await getUserOrderByOrderId(order_id, user_id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOrderedProductDetails = async (req, res) => {
  const user_id = req.user.id;
  const { order_id, detail_id } = req.params;
  try {
    const order = await getOrderDetailsForProduct(user_id, order_id, detail_id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Cancel Order
exports.cancelOrder = async (req, res) => {
  const { order_id } = req.params;
  const user_id = req.user.id;
  const refundData = req.body; // Include refund details
  try {
    const canceledOrder = await cancelOrder(order_id, user_id, refundData);
    res.json(canceledOrder);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Request Return
exports.requestReturn = async (req, res) => {
  const returnData = req.body;
  const refundData = req.body.refund;
  console.log(req.body);

  try {
    const returnOrder = await requestReturn(returnData, refundData);
    res.json(returnOrder);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Request Exchange
exports.requestExchange = async (req, res) => {
  const exchangeData = req.body;
  const refundData = req.body.refund; // Include refund details
  try {
    const exchangeOrder = await requestExchange(exchangeData, refundData);
    res.json(exchangeOrder);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.cancelOrderItem = async (order_id, detail_id, refundData) => {
  const user_id = req.user.id;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Update the product-specific status to 'canceled'
    const result = await client.query(
      `
      UPDATE user_order_details
      SET status = 'canceled'
      WHERE order_id = $1 AND detail_id = $2
      RETURNING *
      `,
      [order_id, detail_id]
    );

    if (result.rowCount === 0) {
      throw new Error("Order item not eligible for cancellation");
    }

    // Insert refund details into the refunds table
    await client.query(
      `
      INSERT INTO user_refunds (original_order_id, refund_status, refund_amount, payment_id, payment_method, refund_reason)
      VALUES ($1, 'initiated', $2, $3, $4, $5)
      `,
      [
        order_id,
        refundData.amount,
        refundData.payment_id,
        refundData.payment_method,
        refundData.refund_reason,
      ]
    );

    await client.query("COMMIT");
    return result.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

exports.getProductRefundDetails = async (req, res) => {
  const user_id = req.user.id;
  const { detail_id } = req.params;

  try {
    const refundDetails = await getRefundByDetailAndUser(detail_id, user_id);

    if (!refundDetails) {
      return res.status(404).json({ error: "No refund details found" });
    }

    res.json(refundDetails);
  } catch (error) {
    console.error("Error fetching refund details:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.updateOrderAndProductStatus = async (req, res) => {
  const { order_id, order_status, product_status } = req.body;

  try {
    await pool.query(
      `UPDATE user_orders_status SET order_status = $1 WHERE order_id = $2`,
      [order_status, order_id]
    );

    // Update the product status in user_order_details table only if is_cancelled, is_exchanged, is_returned are false
    await pool.query(
      `
      UPDATE user_order_details
      SET product_status = $1
      WHERE order_id = $2
        AND is_cancelled = false
        AND is_exchanged = false
        AND is_returned = false
      `,
      [product_status, order_id]
    );

    res.status(200).json({
      message:
        "Order status updated successfully, and product status updated where applicable.",
    });
  } catch (error) {
    console.error("Error updating statuses:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.addTrackingInfo = async (req, res) => {
  const { order_id, product_tracking_id, product_tracking_link } = req.body;

  try {
    // Update the tracking details and product status in user_order_details where flags are false
    await pool.query(
      `
      UPDATE user_order_details
      SET product_tracking_id = $1, product_tracking_link = $2,
          product_status = CASE
                            WHEN is_cancelled = false
                            AND is_exchanged = false
                            AND is_returned = false THEN 'shipped'
                            ELSE product_status
                          END
      WHERE order_id = $3
      `,
      [product_tracking_id, product_tracking_link, order_id]
    );

    // Automatically set order status to 'shipped' in user_orders_status
    await pool.query(
      `UPDATE user_orders_status SET order_status = 'shipped' WHERE order_id = $1`,
      [order_id]
    );

    res.status(200).json({
      message:
        "Tracking information added, and order and product marked as shipped.",
    });
  } catch (error) {
    console.error("Error adding tracking information:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.markAsDeliveredAndRemoveTracking = async (req, res) => {
  const { order_id } = req.body;

  try {
    // Mark the order as delivered
    await pool.query(
      `UPDATE user_orders_status SET order_status = 'delivered' WHERE order_id = $1`,
      [order_id]
    );

    // Update product status to 'shipped' only if flags are all false
    await pool.query(
      `
      UPDATE user_order_details
      SET product_status = CASE
                            WHEN is_cancelled = false
                            AND is_exchanged = false
                            AND is_returned = false THEN 'delivered'
                            ELSE product_status
                          END,
          product_tracking_id = NULL,
          product_tracking_link = NULL
      WHERE order_id = $1
      `,
      [order_id]
    );

    res.status(200).json({
      message: "Order marked as delivered and tracking information removed.",
    });
  } catch (error) {
    console.error("Error marking order as delivered:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getAllReturnRequests = async (req, res) => {
  try {
    // Fetch all return requests from the user_return_orders table
    const returnRequests = await pool.query(`
      SELECT * FROM user_return_orders ORDER BY created_at DESC
    `);

    res.status(200).json(returnRequests.rows);
  } catch (err) {
    console.error("Error fetching return requests:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.approveReturnRequest = async (req, res) => {
  const { return_id } = req.params;

  try {
    // Check if the return request exists
    const returnResult = await pool.query(
      `SELECT * FROM user_return_orders WHERE return_id = $1`,
      [return_id]
    );

    if (returnResult.rows.length === 0) {
      return res.status(404).json({ error: "Return request not found" });
    }

    // Update the return request status to 'approved'
    await pool.query(
      `UPDATE user_return_orders 
       SET return_status = 'approved' 
       WHERE return_id = $1`,
      [return_id]
    );

    res.status(200).json({ message: "Return request approved" });
  } catch (err) {
    console.error("Error approving return request:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.processReturnRequest = async (req, res) => {
  const { return_id } = req.params;

  try {
    // Check if the return request exists
    const returnResult = await pool.query(
      `SELECT * FROM user_return_orders WHERE return_id = $1`,
      [return_id]
    );

    if (returnResult.rows.length === 0) {
      return res.status(404).json({ error: "Return request not found" });
    }

    // Update the return request status to 'processed'
    await pool.query(
      `UPDATE user_return_orders 
       SET return_status = 'processed' 
       WHERE return_id = $1`,
      [return_id]
    );

    res.status(200).json({ message: "Return request processed" });
  } catch (err) {
    console.error("Error processing return request:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.rejectReturnRequest = async (req, res) => {
  const { return_id } = req.params;

  try {
    // Check if the return request exists
    const returnResult = await pool.query(
      `SELECT * FROM user_return_orders WHERE return_id = $1`,
      [return_id]
    );

    if (returnResult.rows.length === 0) {
      return res.status(404).json({ error: "Return request not found" });
    }

    // Update the return request status to 'rejected'
    await pool.query(
      `UPDATE user_return_orders 
       SET return_status = 'rejected' 
       WHERE return_id = $1`,
      [return_id]
    );

    res.status(200).json({ message: "Return request rejected" });
  } catch (err) {
    console.error("Error rejecting return request:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getReturnDetailsByOrderId = async (req, res) => {
  const { order_id } = req.params;

  try {
    // Fetch return details by order_id
    const returnResult = await pool.query(
      `SELECT * FROM user_return_orders WHERE original_order_id = $1`,
      [order_id]
    );

    if (returnResult.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "No return requests found for this order" });
    }

    res.status(200).json(returnResult.rows);
  } catch (err) {
    console.error("Error fetching return details by order_id:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getOrderProductReturnDetails = async (req, res) => {
  const { detail_id, return_id } = req.params;

  try {
    // Get return details from user_return_orders using return_id
    const returnResult = await pool.query(
      `SELECT * FROM user_return_orders WHERE return_id = $1`,
      [return_id]
    );

    if (returnResult.rows.length === 0) {
      return res.status(404).json({ error: "Return not found" });
    }

    const returnDetails = returnResult.rows[0];
    const { original_order_id } = returnDetails;

    // Get product details from user_order_details using detail_id
    const productResult = await pool.query(
      `SELECT * FROM user_order_details WHERE detail_id = $1`,
      [detail_id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    const productDetails = productResult.rows[0];

    // Get delivery and order details from user_orders using order_id
    const orderResult = await pool.query(
      `SELECT * FROM user_orders WHERE order_id = $1`,
      [original_order_id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const orderDetails = orderResult.rows[0];

    // Combine all details
    const combinedDetails = {
      returnDetails,
      productDetails,
      orderDetails: {
        receipant_name: orderDetails.receipant_name,
        receipant_contact: orderDetails.receipant_contact,
        delivery_address: orderDetails.delivery_address,
        delivery_pin_code: orderDetails.delivery_pin_code,
        razorpay_order_id: orderDetails.razorpay_order_id,
        amount: orderDetails.amount,
        created_at: orderDetails.created_at,
      },
    };

    // Send combined details in response
    res.status(200).json(combinedDetails);
  } catch (err) {
    console.error("Error fetching order, product, and return details:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getReturnDetailsByDetailId = async (req, res) => {
  const { detail_id } = req.params;

  try {
    // Get the return_id from user_return_orders using detail_id
    const returnIdResult = await pool.query(
      `SELECT return_id FROM user_return_orders WHERE detail_id = $1`,
      [detail_id]
    );

    if (returnIdResult.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Return not found for this product" });
    }

    const { return_id } = returnIdResult.rows[0];

    // Get return details from user_return_orders using return_id
    const returnResult = await pool.query(
      `SELECT * FROM user_return_orders WHERE return_id = $1`,
      [return_id]
    );

    if (returnResult.rows.length === 0) {
      return res.status(404).json({ error: "Return details not found" });
    }

    const returnDetails = returnResult.rows[0];
    const { original_order_id } = returnDetails;

    // Get product details from user_order_details using detail_id
    const productResult = await pool.query(
      `SELECT * FROM user_order_details WHERE detail_id = $1`,
      [detail_id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: "Product details not found" });
    }

    const productDetails = productResult.rows[0];

    // Get order details from user_orders using original_order_id
    const orderResult = await pool.query(
      `SELECT * FROM user_orders WHERE order_id = $1`,
      [original_order_id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: "Order details not found" });
    }

    const orderDetails = orderResult.rows[0];

    // Combine all details
    const combinedDetails = {
      returnDetails,
      productDetails,
      orderDetails: {
        receipant_name: orderDetails.receipant_name,
        receipant_contact: orderDetails.receipant_contact,
        delivery_address: orderDetails.delivery_address,
        delivery_pin_code: orderDetails.delivery_pin_code,
        razorpay_order_id: orderDetails.razorpay_order_id,
        amount: orderDetails.amount,
        created_at: orderDetails.created_at,
      },
    };

    // Send the combined details as response
    res.status(200).json(combinedDetails);
  } catch (err) {
    console.error("Error fetching product return details:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
