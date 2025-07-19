const {
  getCheckoutDetailsBeforeCoupon,
  applyCouponDiscount,
  createOrUpdateCheckout,
  addCheckoutDetails,
  finalizeCheckout,
  getCouponIdByCode,
  removeCouponDiscount,
  simpleCheckout,
  getCheckoutDetailsAfterCouponApplied,
} = require("../models/checkoutModel");

const { checkUserEligibility } = require("../models/couponModel");

// Get checkout details before applying any coupon
const getCheckout = async (req, res) => {
  try {
    const userId = req.user.id;
    const { giftWrap } = req.query;
    const checkoutDetailsBefore = await simpleCheckout(
      userId,
      giftWrap === "true"
    );
    res.status(200).json({ checkoutDetails: checkoutDetailsBefore });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const applyCoupon = async (req, res) => {
  try {
    const userId = req.user.id;
    const { couponCode, giftWrap } = req.body;
    const couponId = await getCouponIdByCode(couponCode);

    const isEligible = await checkUserEligibility(userId, couponId);
    if (!isEligible) {
      return res
        .status(400)
        .json({ error: "Coupon is not eligible for this user" });
    }

    const {
      checkoutDetailsAfter,
      totalCouponDiscount,
      totalProductDiscount,
      grandTotal,
      couponCodeUsed
    } = await applyCouponDiscount(userId, couponId);

    res.status(200).json({
      checkoutDetails: checkoutDetailsAfter,
      totalCouponDiscount,
      totalProductDiscount,
      couponCodeUsed,
      grandTotal: grandTotal,
    });
  } catch (error) {
    console.error("Error applying coupon:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const getCheckoutDetailsAfterCoupon = async (req, res) => {
  try {
    const userId = req.user.id;

    // Call the service to get checkout details after applying the coupon
    const checkoutDetails = await getCheckoutDetailsAfterCouponApplied(userId);

    // Return the checkout details in the response
    res.status(200).json(checkoutDetails);
  } catch (error) {
    console.error(
      "Error getting checkout details after applying coupon:",
      error.message
    );
    res.status(500).json({
      error: "Failed to retrieve checkout details. Please try again later.",
    });
  }
};

// Finalize checkout
const finalizeCheckoutController = async (req, res) => {
  try {
    const userId = req.user.id;
    const { couponCode } = req.body;

    const result = await finalizeCheckout(userId, couponCode);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Calculate wrapping cost
const calculateWrappingCost = (checkoutDetails) => {
  const wrappingCostPerItem = 25;
  return wrappingCostPerItem * checkoutDetails.length;
};

// Remove coupon from checkout
const removeCoupon = async (req, res) => {
  const userId = req.user.id; // Assuming user ID is available in the request object

  try {
    const result = await removeCouponDiscount(userId);
    res.status(200).json({
      success: true,
      message: "Coupon discount removed successfully.",
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "An error occurred while removing the coupon.",
    });
  }
};

module.exports = {
  getCheckout,
  applyCoupon,
  finalizeCheckoutController,
  removeCoupon,
  getCheckoutDetailsAfterCoupon,
};
