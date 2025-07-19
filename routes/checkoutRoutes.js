const express = require("express");
const {
  getCheckout,
  applyCoupon,
  finalizeCheckoutController,
  removeCoupon,
  getCheckoutDetailsAfterCoupon
} = require("../controllers/checkoutController");
const {
  authMiddleware,
  authorizeRoles,
} = require("../models/middleware/authMiddleware");

const router = express.Router();
router.use(authMiddleware);

router.get("/", getCheckout);
router.post("/apply-coupon", applyCoupon);
router.post("/finalize", finalizeCheckoutController);
router.delete('/remove-coupon', removeCoupon);
router.get('/checkout-final', getCheckoutDetailsAfterCoupon);

module.exports = router;
