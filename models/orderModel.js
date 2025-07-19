const pool = require("../config/db");
const shortUUID = require("short-uuid");
const translator = shortUUID();

const createOrder = async (orderData) => {
  const {
    razorpay_order_id,
    user_id,
    amount,
    coupon_discount,
    delivery_address,
    delivery_pin_code,
    receipant_name,
    receipant_contact,
  } = orderData;

  // Generate short, unique public order ID
  const public_order_id = translator.new();

  const result = await pool.query(
    `
    INSERT INTO user_orders (razorpay_order_id, user_id, amount, coupon_discount,
    delivery_address, receipant_name, receipant_contact, public_order_id, created_at, delivery_pin_code)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)
    RETURNING order_id, public_order_id;
  `,
    [
      razorpay_order_id,
      user_id,
      amount,
      coupon_discount,
      delivery_address,
      receipant_name,
      receipant_contact,
      public_order_id,
      delivery_pin_code,
    ]
  );

  return {
    order_id: result.rows[0].order_id,
    public_order_id: result.rows[0].public_order_id,
  };
};

const createOrderDetails = async ({
  order_id,
  public_order_id,
  product_status,
  items,
}) => {
  const details = [];

  for (const item of items) {
    const result = await pool.query(
      `
      INSERT INTO user_order_details (order_id, product_id, product_name,
      product_size, product_quantity, product_price, product_title, product_image, public_order_id, product_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING detail_id;
    `,
      [
        order_id,
        item.productId,
        item.productName,
        item.productSize,
        item.productQuantity,
        item.productPrice,
        item.productTitle,
        item.photos,
        public_order_id,
        product_status,
      ]
    );

    details.push(result.rows[0]);
  }

  return details;
};

const createOrderStatus = async (statusData) => {
  const {
    order_id,
    public_order_id,
    user_id,
    order_status,
    order_type,
    estimate_delivery,
    detail_id,
  } = statusData;

  await pool.query(
    `
    INSERT INTO user_orders_status (order_id, detail_id, public_order_id, user_id, order_status, order_type, date, estimate_delivery)
    VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
  `,
    [
      order_id,
      detail_id,
      public_order_id,
      user_id,
      order_status,
      order_type,
      estimate_delivery,
    ]
  );
};

const getUserOrders = async (user_id) => {
  const result = await pool.query(
    `
    SELECT 
      o.public_order_id, o.amount, o.coupon_discount, o.receipant_name, o.receipant_contact,
      o.delivery_address, o.delivery_pin_code, o.created_at,
      s.order_status, s.order_type, s.estimate_delivery, s.delivered_date,
      (SELECT json_agg(
          json_build_object(
            'product_id', d.product_id,
            'product_name', d.product_name,
            'product_size', d.product_size,
            'product_quantity', d.product_quantity,
            'product_price', d.product_price,
            'product_title', d.product_title,
            'product_image', d.product_image,
            'is_cancelled', d.is_cancelled,
            'is_exchanged', d.is_exchanged,
            'is_returned', d.is_returned
          )
        )
        FROM user_order_details d
        WHERE d.order_id = o.order_id
      ) AS order_items
    FROM user_orders o
    LEFT JOIN user_orders_status s ON o.order_id = s.order_id
    WHERE o.user_id = $1
    ORDER BY o.created_at DESC
    `,
    [user_id]
  );
  return result.rows;
};

const getAllUserOrders = async () => {
  const result = await pool.query(
    `
    SELECT 
      o.order_id, o.public_order_id, o.amount, o.coupon_discount, o.receipant_name, o.receipant_contact,
      o.delivery_address, o.delivery_pin_code, o.created_at,
      s.order_status, s.order_type, s.estimate_delivery, s.delivered_date,
      (
        SELECT json_agg(
          json_build_object(
            'product_id', d.product_id,
            'product_name', d.product_name,
            'product_size', d.product_size,
            'product_quantity', d.product_quantity,
            'product_price', d.product_price,
            'product_title', d.product_title,
            'product_image', d.product_image,
            'product_status', d.product_status,
            'is_cancelled', d.is_cancelled,
            'is_exchanged', d.is_exchanged,
            'is_returned', d.is_returned
          )
        )
        FROM user_order_details d
        WHERE d.order_id = o.order_id
      ) AS order_items,
      u.email AS user_email, u.user_name AS user_name, u.mobile_number AS user_mobile_number
    FROM user_orders o
    LEFT JOIN user_orders_status s ON o.order_id = s.order_id
    LEFT JOIN users u ON o.user_id = u.id
    GROUP BY o.order_id, s.order_status, s.order_type, s.estimate_delivery, s.delivered_date, u.email, u.user_name, u.mobile_number
    ORDER BY o.created_at DESC
    `
  );
  return result.rows;
};

const getUserOrderByOrderId = async (public_order_id, user_id) => {
  const result = await pool.query(
    `
    SELECT 
      o.public_order_id, o.amount, o.coupon_discount, o.receipant_name, o.receipant_contact,
      o.delivery_address, o.delivery_pin_code, o.created_at,
      s.order_status, s.order_type, s.estimate_delivery, s.delivered_date,
      r.refund_status, r.refund_amount, r.refund_date,
      (SELECT json_agg(
          json_build_object(
            'product_id', d.product_id,
            'product_name', d.product_name,
            'product_size', d.product_size,
            'product_quantity', d.product_quantity,
            'product_price', d.product_price,
            'product_title', d.product_title,
            'product_image', d.product_image,
            'product_status', d.product_status,
            'is_cancelled', d.is_cancelled,
            'is_exchanged', d.is_exchanged,
            'is_returned', d.is_returned
          )
        )
        FROM user_order_details d
        WHERE d.order_id = o.order_id
      ) AS order_items
    FROM user_orders o
    LEFT JOIN user_orders_status s ON o.order_id = s.order_id
    LEFT JOIN user_refunds r ON o.order_id = r.original_order_id
    WHERE o.public_order_id = $1 AND o.user_id = $2
    GROUP BY o.order_id, s.order_status, s.order_type, s.estimate_delivery, s.delivered_date, r.refund_status, r.refund_amount, r.refund_date
    `,
    [public_order_id, user_id]
  );

  return result.rows[0];
};

const cancelOrder = async (order_id, user_id, refundData) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Update order status to 'canceled'
    const result = await client.query(
      `
      UPDATE user_orders_status
      SET order_status = 'canceled'
      WHERE order_id = $1 AND user_id = $2 AND order_status IN ('confirmed', 'accepted')
      RETURNING *
      `,
      [order_id, user_id]
    );

    if (result.rowCount === 0) {
      throw new Error("Order not eligible for cancellation");
    }

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

const requestReturn = async (returnData, refundData) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
      INSERT INTO user_return_orders (original_order_id, user_id, return_reason, return_status)
      VALUES ($1, $2, $3, 'requested')
      RETURNING *
      `,
      [
        returnData.original_order_id,
        returnData.user_id,
        returnData.return_reason,
      ]
    );

    await client.query(
      `
      INSERT INTO user_refunds (original_order_id, refund_status, refund_amount, payment_id, payment_method, refund_reason)
      VALUES ($1, 'initiated', $2, $3, $4, $5)
      `,
      [
        returnData.original_order_id,
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

const requestExchange = async (exchangeData, refundData) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
      INSERT INTO user_exchange_orders (original_order_id, user_id, exchange_reason, exchange_status)
      VALUES ($1, $2, $3, 'requested')
      RETURNING *
      `,
      [
        exchangeData.original_order_id,
        exchangeData.user_id,
        exchangeData.exchange_reason,
      ]
    );

    await client.query(
      `
      INSERT INTO user_refunds (original_order_id, refund_status, refund_amount, payment_id, payment_method, refund_reason)
      VALUES ($1, 'initiated', $2, $3, $4, $5)
      `,
      [
        exchangeData.original_order_id,
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

const getOrderDetailsV2 = async (user_id) => {
  const result = await pool.query(
    `
    SELECT 
      d.detail_id, d.order_id, d.product_name, d.product_size, d.is_cancelled, d.is_exchanged, d.is_returned, d.product_status, d.product_quantity, d.product_price,
      d.product_title, d.product_image, d.public_order_id,
      s.order_status, s.order_type, s.estimate_delivery, s.delivered_date, s.date AS status_date
    FROM user_order_details d
    JOIN user_orders_status s ON d.detail_id = s.detail_id
    WHERE s.user_id = $1
    ORDER BY s.date DESC
    `,
    [user_id]
  );

  return result.rows;
};

const getUserOrdersWithDetailsAndStatus = async (user_id) => {
  const result = await pool.query(
    `
    SELECT 
      o.order_id, o.public_order_id, o.amount, o.coupon_discount, o.receipant_name, 
      o.receipant_contact, o.delivery_address, o.delivery_pin_code, o.created_at,
      d.product_id, d.product_name, d.product_size, d.is_cancelled, d.is_exchanged, d.is_returned, d.product_status, d.product_quantity, 
      d.product_price, d.product_title, d.product_image,
      s.order_status, s.order_type, s.estimate_delivery, s.delivered_date, s.date AS status_date
    FROM user_orders o
    JOIN user_order_details d ON o.order_id = d.order_id
    JOIN user_orders_status s ON o.order_id = s.order_id
    WHERE o.user_id = $1
    ORDER BY o.created_at DESC
    `,
    [user_id]
  );

  return result.rows;
};

const getOrderDetailsForProduct = async (user_id, order_id, detail_id) => {
  const result = await pool.query(
    `
    SELECT 
      o.order_id, o.public_order_id, o.amount, o.coupon_discount, o.receipant_name, 
      o.receipant_contact, o.delivery_address, o.delivery_pin_code, o.created_at,
      d.detail_id, d.product_id, d.product_name, d.product_size, d.is_cancelled, d.is_exchanged, d.is_returned, d.product_status, d.product_quantity, 
      d.product_price, d.product_title, d.product_image, d.public_order_id AS product_public_order_id,
      d.product_tracking_id, d.product_tracking_link,
      s.order_status, s.order_type, s.estimate_delivery, s.delivered_date, s.date AS status_date
    FROM user_orders o
    JOIN user_order_details d ON o.order_id = d.order_id
    JOIN user_orders_status s ON d.detail_id = s.detail_id
    WHERE o.user_id = $1
      AND o.order_id = $2
      AND d.detail_id = $3
    ORDER BY o.created_at DESC
    `,
    [user_id, order_id, detail_id]
  );

  return result.rows[0];
};

const getRefundByDetailAndUser = async (detail_id, user_id) => {
  try {
    const query = `
        SELECT ur.*
        FROM user_refunds ur
        JOIN user_orders uo ON ur.original_order_id = uo.order_id
        WHERE ur.detail_id = $1 AND uo.user_id = $2
      `;
    const result = await pool.query(query, [detail_id, user_id]);
    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

module.exports = {
  createOrder,
  createOrderDetails,
  createOrderStatus,
  getUserOrders,
  getAllUserOrders,
  cancelOrder,
  requestReturn,
  requestExchange,
  getUserOrderByOrderId,
  getOrderDetailsV2,
  getOrderDetailsForProduct,
  getRefundByDetailAndUser,
};
