const pool = require("../config/db");

// Add a product to the wishlist
const addProductToWishlist = async (userId, productId) => {
  const { rowCount } = await pool.query(
    "SELECT 1 FROM wishlist WHERE user_id = $1 AND product_id = $2",
    [userId, productId]
  );

  if (rowCount > 0) {
    return "Product is already in the wishlist.";
  }

  await pool.query(
    "INSERT INTO wishlist (user_id, product_id) VALUES ($1, $2)",
    [userId, productId]
  );

  return "Product added to the wishlist.";
};

// Remove a product from the wishlist
const removeProductFromWishlist = async (userId, productId) => {
  await pool.query(
    "DELETE FROM wishlist WHERE user_id = $1 AND product_id = $2",
    [userId, productId]
  );
};

// Remove a all products
const removeAllProductFromWishlist = async (userId) => {
  await pool.query("DELETE FROM wishlist WHERE user_id = $1", [userId]);
};

// Get all products in the wishlist for a user
const getUserWishlist = async (userId) => {
  const result = await pool.query(
    `SELECT 
      p.id, 
      p.product_name, 
      p.product_title, 
      p.product_selling_price, 
      p.product_price, 
      p.available_discount, 
      p.cloth_fit, 
      p.photos_of_product[1] AS first_photo 
    FROM wishlist w 
    JOIN products p ON w.product_id = p.id 
    WHERE w.user_id = $1`,
    [userId]
  );
  return result.rows;
};

module.exports = {
  addProductToWishlist,
  removeProductFromWishlist,
  getUserWishlist,
  removeAllProductFromWishlist,
};
