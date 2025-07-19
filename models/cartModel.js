const pool = require("../config/db");

const getProductPrice = async (productId) => {
  const result = await pool.query(
    "SELECT product_selling_price FROM products WHERE id = $1",
    [productId]
  );
  if (result.rows.length === 0) {
    throw new Error("Product not found");
  }
  return result.rows[0].product_selling_price;
};

const addProductToCart = async (userId, productId, size, variant, quantity) => {
  try {
    // Get the current quantity of the product in the cart
    const result = await pool.query(
      `SELECT quantity FROM cart
       WHERE user_id = $1 AND product_id = $2 AND size = $3 AND variant = $4`,
      [userId, productId, size, variant]
    );

    const currentQuantity = result.rows[0] ? result.rows[0].quantity : 0;
    const newQuantity = currentQuantity + quantity;

    // Check if the total quantity exceeds the maximum allowed (5)
    if (newQuantity > 5) {
      throw new Error("You cannot have more than 5 of this item in your cart.");
    }

    // Get the product price
    const productPrice = await getProductPrice(productId);

    // Insert or update the cart
    await pool.query(
      `INSERT INTO cart (user_id, product_id, size, variant, quantity, price)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, product_id, size, variant)
       DO UPDATE SET quantity = cart.quantity + EXCLUDED.quantity`,
      [userId, productId, size, variant, quantity, productPrice]
    );

    return { success: true };
  } catch (error) {
    console.error("Error adding product to cart:", error);
    throw error;
  }
};

const updateCartItem = async (
  userId,
  productId,
  oldSize,
  newSize,
  variant,
  quantity
) => {
  await pool.query(
    "UPDATE cart SET quantity = $1, size = $2 WHERE user_id = $3 AND product_id = $4 AND size = $5",
    [quantity, newSize, userId, productId, oldSize]
  );
};

// Remove a product from the cart
const removeProductFromCart = async (userId, productId, size) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Remove the product from the cart
    await client.query(
      "DELETE FROM cart WHERE user_id = $1 AND product_id = $2 AND size = $3",
      [userId, productId, size]
    );

    // Get the checkout_id for the user
    const checkoutResult = await client.query(
      "SELECT id FROM checkout WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
      [userId]
    );

    if (checkoutResult.rows.length > 0) {
      const checkoutId = checkoutResult.rows[0].id;

      // Remove the product from checkout_details
      await client.query(
        "DELETE FROM checkout_details WHERE checkout_id = $1 AND product_id = $2",
        [checkoutId, productId]
      );

      // Optional: If there are no more items in checkout_details, delete the checkout
      const remainingItems = await client.query(
        "SELECT COUNT(*) FROM checkout_details WHERE checkout_id = $1",
        [checkoutId]
      );

      if (remainingItems.rows[0].count == 0) {
        await client.query("DELETE FROM checkout WHERE id = $1", [checkoutId]);
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error removing product from cart and checkout:", error);
    throw new Error("Failed to remove product. Please try again later.");
  } finally {
    client.release();
  }
};

const getUserCart = async (userId) => {
  const result = await pool.query(
    `SELECT 
      p.id,
      p.product_name,
      p.product_title,
      p.product_price, 
      p.product_selling_price,
      p.available_discount, 
      p.photos_of_product,
      c.size,
      c.quantity, 
      c.variant, 
      (p.product_selling_price * c.quantity) AS total_price,
      ARRAY_AGG(DISTINCT ps.size) FILTER (WHERE ps.available_quantity > 0) AS available_sizes,
      MIN(ps.available_quantity) AS available_quantity_for_size,
      c.is_available
    FROM 
      cart c 
    JOIN 
      products p 
    ON 
      c.product_id = p.id
    LEFT JOIN 
      product_sizes ps 
    ON 
      ps.product_id = p.id 
      AND ps.size = c.size
    WHERE 
      c.user_id = $1 
    GROUP BY 
      p.id, 
      p.product_title, 
      p.product_selling_price, 
      p.available_discount,
      p.photos_of_product, 
      c.size, 
      c.quantity, 
      c.variant,
      c.is_available`,
    [userId]
  );

  const allItems = result.rows.map((item) => {
    const isAvailable =
      item.available_quantity_for_size >= item.quantity &&
      item.available_sizes !== null &&
      item.available_quantity_for_size !== null;

    // Update the cart table's is_available field for the current item
    pool.query(
      `UPDATE cart SET is_available = $1 WHERE user_id = $2 AND product_id = $3 AND size = $4`,
      [isAvailable, userId, item.id, item.size]
    );

    return {
      id: item.id,
      product_name: item.product_name,
      product_title: item.product_title,
      product_price: parseFloat((Number(item.product_price) || 0).toFixed(2)),
      product_selling_price: parseFloat(
        (Number(item.product_selling_price) || 0).toFixed(2)
      ),
      discount_percentage: item.available_discount,
      photo: item.photos_of_product[0],
      size: item.size,
      quantity: item.quantity,
      variant: item.variant,
      total_price: parseFloat((Number(item.total_price) || 0).toFixed(2)),
      available_sizes: item.available_sizes,
      available_quantity: item.available_quantity_for_size,
      is_available: isAvailable,
    };
  });

  const availableItems = allItems.filter((item) => item.is_available);
  const unavailableItems = allItems.filter((item) => !item.is_available);

  const grandTotal = availableItems.reduce(
    (acc, item) => acc + parseFloat(item.total_price),
    0
  );

  return {
    items: availableItems,
    added_but_soldout: unavailableItems,
    grand_total_price: grandTotal.toFixed(2),
  };
};

const getAvailableSizesAndQuantities = async (productId) => {
  const result = await pool.query(
    `SELECT 
       size,
       available_quantity 
     FROM 
       product_sizes 
     WHERE 
       product_id = $1 
       AND available_quantity > 0`,
    [productId]
  );
  return result.rows;
};

module.exports = {
  addProductToCart,
  removeProductFromCart,
  getUserCart,
  updateCartItem,
  getAvailableSizesAndQuantities,
};
