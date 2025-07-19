const pool = require('../config/db'); 

const getOrderDetailsById = async (orderId) => {
  const orderResult = await pool.query(
    `
    SELECT o.order_id, o.public_order_id, o.receipant_name, o.receipant_contact, 
           o.delivery_address, o.delivery_pin_code, o.amount,
           s.order_status, s.order_type, o.user_id,
           json_agg(
              json_build_object(
                'product_id', d.product_id,
                'product_name', d.product_name,
                'product_quantity', d.product_quantity,
                'product_size', d.product_size,
                'product_price', d.product_price,
                'product_sku', d.product_sku,
                'is_cancelled', d.is_cancelled,
                'is_exchanged', d.is_exchanged,
                'is_returned', d.is_returned
              )
           ) AS order_items
    FROM user_orders o
    LEFT JOIN user_orders_status s ON o.order_id = s.order_id
    LEFT JOIN user_order_details d ON o.order_id = d.order_id
    WHERE o.order_id = $1
    GROUP BY o.order_id, s.order_status, s.order_type;
    `,
    [orderId]
  );

  return orderResult.rows[0];
};

// Fetch user info
const getUserInfoById = async (userId) => {
  const result = await pool.query(
    "SELECT email, user_name, mobile_number FROM users WHERE id = $1",
    [userId]
  );
  return result.rows[0];
};

// Fetch valid order items
const getValidOrderItems = async (orderId) => {
  const result = await pool.query(
    `
    SELECT o.order_id, o.public_order_id, o.receipant_name, o.receipant_contact, 
           o.delivery_address, o.delivery_pin_code, o.amount,
           json_agg(
              json_build_object(
                'product_id', d.product_id,
                'product_name', d.product_name,
                'product_quantity', d.product_quantity,
                'product_size', d.product_size,
                'product_price', d.product_price,
                'product_sku', d.product_sku
              )
           ) AS order_items
    FROM user_orders o
    LEFT JOIN user_order_details d ON o.order_id = d.order_id
    WHERE o.order_id = $1 AND d.is_cancelled = false AND d.is_exchanged = false AND d.is_returned = false
    GROUP BY o.order_id;
    `,
    [orderId]
  );

  return result.rows[0];
};

module.exports = {
  getOrderDetailsById,
  getUserInfoById,
  getValidOrderItems,
};
