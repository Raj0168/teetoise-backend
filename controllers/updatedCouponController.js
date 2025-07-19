const pool = require("../config/db");

const {
  getCheckoutDetailsBeforeCoupon,
  getCouponIdByCode,
} = require("../models/checkoutModel");

const { checkUserEligibility } = require("../models/couponModel");

const calculateDiscount = (
  discountType,
  discountValue,
  productMRP,
  maxDiscountValue,
  quantity
) => {
  let discountAmount = 0;

  if (discountType === "PERCENTAGE") {
    discountAmount = (productMRP * discountValue) / 100;
    if (maxDiscountValue && discountAmount > maxDiscountValue) {
      discountAmount = maxDiscountValue;
    }
  } else if (discountType === "FLAT") {
    discountAmount = discountValue;
  }

  return parseFloat(discountAmount.toFixed(2)) * quantity;
};

// Helper function to apply discounts on the checkout details
const applyDiscountsOnCheckout = (
  checkoutDetails,
  discountType,
  discountValue,
  maxDiscountValue
) => {
  let totalCouponDiscount = 0;
  let totalProductDiscount = 0;
  let grandTotal = 0;

  checkoutDetails.forEach((item) => {
    const productMRP = parseFloat(item.mrp);
    const productDiscount =
      (parseFloat(item.product_discount) / 100) * productMRP;
    const couponDiscount = calculateDiscount(
      discountType,
      discountValue,
      productMRP,
      maxDiscountValue,
      item.quantity
    );

    totalCouponDiscount += couponDiscount;
    totalProductDiscount += productDiscount * item.quantity;

    item.coupon_discount = couponDiscount;
    item.final_price = parseFloat(item.final_price) - couponDiscount;

    if (item.final_price < 0) item.final_price = 0;

    grandTotal += item.final_price;
  });

  return {
    totalCouponDiscount: parseFloat(totalCouponDiscount.toFixed(2)),
    totalProductDiscount: parseFloat(totalProductDiscount.toFixed(2)),
    grandTotal: parseFloat(grandTotal.toFixed(2)),
  };
};

// Helper function to check coupon validity and update its usage
const validateAndUpdateCoupon = async (couponId) => {
  const couponResult = await pool.query(
    `SELECT * FROM coupon_codes WHERE id = $1`,
    [couponId]
  );

  if (couponResult.rows.length === 0)
    throw new Error("Coupon id is not valid.");

  const coupon = couponResult.rows[0];
  if (!coupon.is_active) throw new Error("Coupon id is inactive.");

  // Update coupon usage stats
  await pool.query(
    `UPDATE coupon_codes SET times_used = times_used + 1 WHERE id = $1`,
    [couponId]
  );

  if (coupon.usage_limit > 0 && coupon.times_used >= coupon.usage_limit) {
    await pool.query(
      `UPDATE coupon_codes SET is_active = FALSE WHERE id = $1`,
      [couponId]
    );
  }

  return coupon;
};

// Main function to apply coupon
const applyCoupon = async (req, res) => {
  try {
    const userId = req.user.id;
    const { couponCode, giftWrap } = req.body;
    const couponId = await getCouponIdByCode(couponCode);

    // Check if the user is eligible for the coupon
    const isEligible = await checkUserEligibility(userId, couponId);
    if (!isEligible) {
      return res
        .status(400)
        .json({ error: "Coupon is not eligible for this user" });
    }

    // Get active checkout details
    const checkoutDetailsBefore = await getCheckoutDetailsBeforeCoupon(userId);
    if (!checkoutDetailsBefore || checkoutDetailsBefore.length === 0) {
      throw new Error("No checkout details found for this user.");
    }

    // Validate the coupon and update its usage
    const coupon = await validateAndUpdateCoupon(couponId);

    // Apply discounts
    const { totalCouponDiscount, totalProductDiscount, grandTotal } =
      applyDiscountsOnCheckout(
        checkoutDetailsBefore,
        coupon.discount_type,
        parseFloat(coupon.discount_value),
        coupon.max_discount_value ? parseFloat(coupon.max_discount_value) : null
      );

    // Calculate wrapping cost if applicable
    const wrappingCost = giftWrap ? 5 : 0;

    // Return the final checkout details
    res.status(200).json({
      checkoutDetails: checkoutDetailsBefore,
      totalCouponDiscount,
      totalProductDiscount,
      grandTotal: grandTotal + wrappingCost,
    });
  } catch (error) {
    console.error("Error applying coupon:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
