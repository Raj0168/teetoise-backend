const pool = require("../config/db");

const { getUserCart } = require("./cartModel");
const { applyCouponCode } = require("./couponModel");

const userCreateCheckout = async (userId, couponCode) => {
  const cartDetails = await getUserCart(userId);
  const couponDetails = await applyCouponCode(userId, couponCode);

  try {
    // Start a transaction
    // await pool.query("BEGIN");

    // Check if there is an existing checkout for the user
    const existingCheckouts = await pool.query(
      `SELECT checkout_id FROM user_checkouts WHERE user_id = $1`,
      [userId]
    );

    if (existingCheckouts.rowCount > 0) {
      for (const checkout of existingCheckouts.rows) {
        const existingCheckoutId = checkout.checkout_id;

        // Delete existing checkout details and checkout
        await pool.query(
          `DELETE FROM user_checkout_details WHERE checkout_id = $1`,
          [existingCheckoutId]
        );
        await pool.query(`DELETE FROM user_checkouts WHERE checkout_id = $1`, [
          existingCheckoutId,
        ]);
      }
    }

    // Insert new checkout
    const insertCheckoutResult = await pool.query(
      `INSERT INTO user_checkouts (user_id, total_amount_before_coupon, coupon_discount, total_amount_after_coupon)
       VALUES ($1, $2, $3, $4) RETURNING checkout_id`,
      [
        userId,
        couponDetails.totalAmountBeforeDiscount,
        couponDetails.couponDiscount,
        couponDetails.totalAmountAfterDiscount,
      ]
    );

    const checkoutId = insertCheckoutResult.rows[0].checkout_id;

    if (!checkoutId) {
      throw new Error("Checkout ID could not be generated.");
    }

    // Insert into user_checkout_details
    const detailsPromises = cartDetails.items.map((item) =>
      pool.query(
        `INSERT INTO user_checkout_details (checkout_id, product_id, product_price, product_size, product_quantity, photos, product_title, product_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          checkoutId,
          item.id,
          item.total_price,
          item.size,
          item.quantity,
          item.photo,
          item.product_title,
          item.product_name,
        ]
      )
    );

    await Promise.all(detailsPromises);

    // Commit transaction
    // await pool.query("COMMIT");

    return {
      checkoutId,
      totalAmountBeforeCoupon: couponDetails.totalAmountBeforeDiscount,
      totalAmountAfterCoupon: couponDetails.totalAmountAfterDiscount,
      couponDiscount: couponDetails.couponDiscount,
      message: "Checkout created successfully",
    };
  } catch (error) {
    // Rollback transaction in case of an error
    await pool.query("ROLLBACK");
    console.error(
      "Error during checkout creation, transaction rolled back:",
      error.message
    );

    return {
      message: "Failed to create checkout. Please try again later.",
    };
  }
};

const getUserCheckoutDetails = async (userId) => {
  try {
    const checkoutsResult = await pool.query(
      `SELECT uc.checkout_id, uc.total_amount_before_coupon, uc.coupon_discount, uc.total_amount_after_coupon,
              ucd.product_id, ucd.product_price, ucd.product_size, ucd.product_quantity, ucd.photos, ucd.product_title, ucd.product_name
       FROM user_checkouts uc
       LEFT JOIN user_checkout_details ucd ON uc.checkout_id = ucd.checkout_id
       WHERE uc.user_id = $1`,
      [userId]
    );

    if (checkoutsResult.rowCount === 0) {
      return { message: "No checkouts found for this user." };
    }

    const {
      checkout_id,
      total_amount_before_coupon,
      coupon_discount,
      total_amount_after_coupon,
    } = checkoutsResult.rows[0];

    const items = checkoutsResult.rows.map((row) => ({
      productId: row.product_id,
      productPrice: row.product_price,
      productSize: row.product_size,
      productQuantity: row.product_quantity,
      photos: row.photos,
      productTitle: row.product_title,
      productName: row.product_name,
    }));

    const checkout = {
      checkoutId: checkout_id,
      totalAmountBeforeCoupon: total_amount_before_coupon,
      couponDiscount: coupon_discount,
      totalAmountAfterCoupon: total_amount_after_coupon,
      items,
    };

    return { checkout };
  } catch (error) {
    console.error("Error fetching user checkout details:", error.message);
    return {
      message: "Failed to fetch checkout details. Please try again later.",
    };
  }
};

const clearCheckoutData = async (user_id) => {
  await pool.query("DELETE FROM user_checkouts WHERE user_id = $1", [user_id]);
  await pool.query(
    "DELETE FROM user_checkout_details WHERE checkout_id IN (SELECT checkout_id FROM user_checkouts WHERE user_id = $1)",
    [user_id]
  );
  await pool.query("DELETE FROM cart WHERE user_id = $1", [user_id]);
};

module.exports = {
  userCreateCheckout,
  getUserCheckoutDetails,
  clearCheckoutData,
};
