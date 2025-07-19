const express = require("express");
const {
  addCouponCodeController,
  applyCouponCodeController,
  addCouponConditionController,
  getAvailableCouponsForUserController,
  getAllCouponsController,
  removeCouponCodeController,
  toggleCouponStatusController,
  removeCouponFromUserController,
} = require("../controllers/couponController");
const {
  authMiddleware,
  authorizeRoles,
} = require("../models/middleware/authMiddleware");
const { getAvailableCouponsForUser } = require("../models/couponModel");

const router = express.Router();
router.use(authMiddleware);

router.post("/add", authorizeRoles(["admin"]), addCouponCodeController);
router.post("/apply", applyCouponCodeController);
router.post("/remove-coupon", removeCouponFromUserController);
router.post(
  "/conditions",
  authorizeRoles(["admin"]),
  addCouponConditionController
);
router.get("/available", getAvailableCouponsForUserController);
router.get("/all", getAllCouponsController);
router.delete(
  "/remove",
  authorizeRoles(["admin"]),
  removeCouponCodeController
);
router.patch(
  "/toggle-status",
  authorizeRoles(["admin"]),
  toggleCouponStatusController
);

module.exports = router;
