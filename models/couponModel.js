const pool = require("../config/db");

// Add a new coupon code
const addCouponCode = async (
  code,
  discountType,
  discountValue,
  maxDiscountValue,
  startDate,
  endDate,
  usageLimit
) => {
  const result = await pool.query(
    `INSERT INTO coupon_codes (code, discount_type, discount_value, max_discount_value, start_date, end_date, usage_limit) 
     VALUES ($1, $2, $3, $4, $5, $6, $7) 
     RETURNING id`,
    [
      code,
      discountType,
      discountValue,
      maxDiscountValue,
      startDate,
      endDate,
      usageLimit,
    ]
  );

  return result.rows[0].id;
};

const getCouponIdByCode = async (couponCode) => {
  try {
    const result = await pool.query(
      `SELECT id FROM coupon_codes WHERE code = $1`,
      [couponCode]
    );

    return result.rows[0].id;
  } catch (error) {
    console.error("Error retrieving coupon ID:", error.message);
    throw new Error("Failed to retrieve coupon ID. Please try again later.");
  }
};

// Apply a coupon code and update times_used
const applyCouponCode = async (userId, code) => {
  try {
    // Check if the coupon code is valid and active
    const coupon = await checkCouponCode(code);
    if (!coupon || !coupon.is_active) {
      return {
        totalAmountBeforeDiscount: await getCartGrandTotal(userId),
        totalAmountAfterDiscount: await getCartGrandTotal(userId),
        couponDiscount: 0,
        message: "No Coupon is applied",
      };
    }

    // Check if the user is eligible for the coupon
    const isEligible = await checkUserEligibility(userId, coupon.id);
    if (!isEligible) {
      return {
        totalAmountBeforeDiscount: await getCartGrandTotal(userId),
        totalAmountAfterDiscount: await getCartGrandTotal(userId),
        couponDiscount: 0,
        message: "Sorry, you are not eligible for this coupon",
      };
    }

    // Calculate the total amount before applying the coupon
    const totalAmountBeforeDiscount = parseFloat(
      await getCartGrandTotal(userId)
    );

    // Calculate the coupon discount on the total amount
    const discountType = coupon.discount_type;
    const discountValue = parseFloat(coupon.discount_value);
    const maxDiscountValue = coupon.max_discount_value
      ? parseFloat(coupon.max_discount_value)
      : null;

    let totalCouponDiscount = 0;

    if (discountType === "PERCENTAGE") {
      totalCouponDiscount = (totalAmountBeforeDiscount * discountValue) / 100;
      if (maxDiscountValue && totalCouponDiscount > maxDiscountValue) {
        totalCouponDiscount = maxDiscountValue;
      }
    } else if (discountType === "FLAT") {
      totalCouponDiscount = discountValue;
    }

    totalCouponDiscount = parseFloat(totalCouponDiscount.toFixed(2));

    // Calculate the total amount after applying the coupon
    const totalAmountAfterDiscount = Math.max(
      totalAmountBeforeDiscount - totalCouponDiscount,
      0
    );

    return {
      totalAmountBeforeDiscount,
      totalAmountAfterDiscount,
      couponDiscount: totalCouponDiscount,
      message: "Coupon applied successfully",
    };
  } catch (error) {
    console.error("Error applying coupon:", error.message);
    return {
      totalAmountBeforeDiscount: await getCartGrandTotal(userId),
      totalAmountAfterDiscount: await getCartGrandTotal(userId),
      couponDiscount: 0,
      message: "Failed to apply coupon. Please try again later.",
    };
  }
};

const removeCouponFromUser = async (userId) => {
  try {
    const totalAmountBeforeDiscount = parseFloat(
      await getCartGrandTotal(userId)
    );

    return {
      totalAmountBeforeDiscount,
      totalAmountAfterDiscount: totalAmountBeforeDiscount,
      couponDiscount: 0, 
      message: "Coupon removed successfully, no discount applied",
    };
  } catch (error) {
    console.error("Error removing coupon:", error.message);
    return {
      totalAmountBeforeDiscount: await getCartGrandTotal(userId),
      totalAmountAfterDiscount: await getCartGrandTotal(userId),
      couponDiscount: 0,
      message: "Failed to remove coupon. Please try again later.",
    };
  }
};

// Add conditions to a coupon
const addCouponCondition = async (couponId, conditionType, conditionValue) => {
  await pool.query(
    `INSERT INTO coupon_conditions (coupon_id, condition_type, condition_value) 
     VALUES ($1, $2, $3)`,
    [couponId, conditionType, conditionValue]
  );
};

const checkUserEligibility = async (userId, couponId) => {
  const conditions = await pool.query(
    `SELECT * FROM coupon_conditions WHERE coupon_id = $1`,
    [couponId]
  );

  for (const condition of conditions.rows) {
    if (condition.condition_type === "MINIMUM_PURCHASE") {
      const cartTotal = await getCartGrandTotal(userId);

      if (cartTotal < parseFloat(condition.condition_value)) {
        return false;
      }
    } else if (condition.condition_type === "PRODUCT_CATEGORY") {
      const isCategoryMatched = await checkProductCategoryCondition(
        userId,
        condition.condition_value
      );
      if (!isCategoryMatched) return false;
    } else if (condition.condition_type === "TAG") {
      const isTagMatched = await checkProductTagCondition(
        userId,
        condition.condition_value
      );
      if (!isTagMatched) return false;
    }
  }

  return true;
};

const getCartGrandTotal = async (userId) => {
  const result = await pool.query(
    `SELECT 
      c.price, 
      c.quantity, 
      c.size, 
      c.product_id,
      c.id AS cart_item_id,
      ps.available_quantity AS available_quantity_for_size
    FROM 
      cart c
    LEFT JOIN 
      product_sizes ps 
    ON 
      ps.product_id = c.product_id 
      AND ps.size = c.size
    WHERE 
      c.user_id = $1
      AND c.is_available = true`,
    [userId]
  );

  const grandTotal = result.rows
    .filter(
      (item) =>
        item.available_quantity_for_size &&
        item.available_quantity_for_size >= item.quantity
    )
    .reduce((acc, item) => acc + parseFloat(item.price) * item.quantity, 0);

  return grandTotal.toFixed(2);
};

// Check if a product meets the category condition
const checkProductCategoryCondition = async (userId, category) => {
  const result = await pool.query(
    `SELECT COUNT(*) FROM cart c
     JOIN products p ON c.product_id = p.id
     WHERE c.user_id = $1 AND p.product_category = $2 AND c.is_available = true`,
    [userId, category]
  );

  return result.rows[0].count > 0;
};

// Check if a product meets the tag condition
const checkProductTagCondition = async (userId, tag) => {
  const result = await pool.query(
    `SELECT COUNT(*) FROM cart c
     JOIN product_tags pt ON c.product_id = pt.product_id
     WHERE c.user_id = $1 AND pt.tag = $2 AND c.is_available = true`,
    [userId, tag]
  );

  return result.rows[0].count > 0;
};

// Get all coupon codes
const getAllCoupons = async () => {
  const result = await pool.query("SELECT * FROM coupon_codes");
  return result.rows;
};

// Get available coupons for a user
const getAvailableCouponsForUser = async (userId) => {
  const coupons = await pool.query(
    `SELECT * FROM coupon_codes WHERE is_active = TRUE ORDER BY discount_value DESC`
  );

  const eligibleCoupons = [];
  for (const coupon of coupons.rows) {
    const isEligible = await checkUserEligibility(userId, coupon.id);
    if (isEligible) {
      eligibleCoupons.push(coupon);
    }
  }

  return eligibleCoupons;
};

// Check if a coupon code exists and is active
const checkCouponCode = async (code) => {
  const result = await pool.query(
    "SELECT * FROM coupon_codes WHERE code = $1",
    [code]
  );
  return result.rows[0] || null;
};

// Remove a coupon code
const removeCouponCode = async (code) => {
  await pool.query("DELETE FROM coupon_codes WHERE code = $1", [code]);
};

// Activate or deactivate a coupon code
const toggleCouponStatus = async (code, isActive) => {
  await pool.query("UPDATE coupon_codes SET is_active = $1 WHERE code = $2", [
    isActive,
    code,
  ]);
};

module.exports = {
  addCouponCode,
  checkCouponCode,
  applyCouponCode,
  addCouponCondition,
  getAllCoupons,
  getAvailableCouponsForUser,
  removeCouponCode,
  toggleCouponStatus,
  checkUserEligibility,
  removeCouponFromUser
};
