const express = require("express");
const router = express.Router();
const RefundController = require("../controllers/RefundController");
const {
  authMiddleware,
  authorizeRoles,
} = require("../models/middleware/authMiddleware");
router.use(authMiddleware);

// Cancel order item (requires user authentication)
router.post(
  "/orders/:order_id/details/:detail_id/cancel",
  RefundController.cancelOrderItem
);

// Request return for an order item
router.post(
  "/orders/:order_id/details/:detail_id/return",
  RefundController.requestReturnForItem
);

// Request exchange for an order item
router.post(
  "/orders/:order_id/details/:detail_id/exchange",
  RefundController.requestExchangeForItem
);

router.post(
  "/orders/:order_id/details/:detail_id/:new_size/size_change",
  RefundController.changeSizeProduct
);

module.exports = router;
