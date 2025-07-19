const {
  addCouponCode,
  checkCouponCode,
  applyCouponCode,
  addCouponCondition,
  getAllCoupons,
  removeCouponCode,
  toggleCouponStatus,
  getAvailableCouponsForUser,
  removeCouponFromUser,
} = require("../models/couponModel");

// Add a new coupon code
const addCouponCodeController = async (req, res) => {
  try {
    const {
      code,
      discountType,
      discountValue,
      maxDiscountValue,
      startDate,
      endDate,
      usageLimit,
    } = req.body;
    const couponId = await addCouponCode(
      code,
      discountType,
      discountValue,
      maxDiscountValue,
      startDate,
      endDate,
      usageLimit
    );
    res.status(201).json({ id: couponId });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while adding the coupon code" });
  }
};

const removeCouponFromUserController = async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await removeCouponFromUser(userId);

    return res.status(200).json({
      totalAmountBeforeDiscount: result.totalAmountBeforeDiscount,
      totalAmountAfterDiscount: result.totalAmountAfterDiscount,
      couponDiscount: result.couponDiscount,
      message: result.message,
    });
  } catch (error) {
    console.error("Error applying coupon:", error.message);
  }
};

// Apply a coupon code and update times_used
const applyCouponCodeController = async (req, res) => {
  const userId = req.user.id;
  const { couponCode } = req.body;
  try {
    const result = await applyCouponCode(userId, couponCode);

    return res.status(200).json({
      totalAmountBeforeDiscount: result.totalAmountBeforeDiscount,
      totalAmountAfterDiscount: result.totalAmountAfterDiscount,
      couponDiscount: result.couponDiscount,
      message: result.message,
    });
  } catch (error) {
    console.error("Error applying coupon:", error.message);
    return res.status(500).json({
      totalAmountBeforeDiscount: await getCartGrandTotal(userId),
      totalAmountAfterDiscount: await getCartGrandTotal(userId),
      couponDiscount: 0,
      message: "Failed to apply coupon. Please try again later.",
    });
  }
};

// Add conditions to a coupon
const addCouponConditionController = async (req, res) => {
  try {
    const { couponId, conditionType, conditionValue } = req.body;
    await addCouponCondition(couponId, conditionType, conditionValue);
    res.status(201).json({ message: "Condition added to coupon code" });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "An error occurred while adding the condition to the coupon code",
    });
  }
};

// Get available coupons for a user
const getAvailableCouponsForUserController = async (req, res) => {
  try {
    const userId = req.user.id; // Extracted from token (authMiddleware)
    const coupons = await getAvailableCouponsForUser(userId);
    res.status(200).json(coupons);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching available coupons" });
  }
};

const getAllCouponsController = async (req, res) => {
  try {
    const coupons = await getAllCoupons();
    res.status(200).json(coupons);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching all coupon codes" });
  }
};

// Remove a coupon code (Admin only)
const removeCouponCodeController = async (req, res) => {
  try {
    const { code } = req.body;
    await removeCouponCode(code);
    res.status(200).json({ message: "Coupon code removed successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while removing the coupon code" });
  }
};

// Activate or deactivate a coupon code (Admin only)
const toggleCouponStatusController = async (req, res) => {
  try {
    const { code, isActive } = req.body;
    await toggleCouponStatus(code, isActive);
    res.status(200).json({
      message: `Coupon code ${
        isActive ? "activated" : "deactivated"
      } successfully`,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while toggling the coupon status" });
  }
};

module.exports = {
  addCouponCodeController,
  applyCouponCodeController,
  addCouponConditionController,
  getAvailableCouponsForUserController,
  getAllCouponsController,
  removeCouponCodeController,
  toggleCouponStatusController,
  removeCouponFromUserController
};
