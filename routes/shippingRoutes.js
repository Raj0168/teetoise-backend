const express = require("express");
const router = express.Router();
const {
  viewOrderDetails,
  placeOrder,
} = require("../controllers/shippingController");
const {
  authMiddleware,
  authorizeRoles,
} = require("../models/middleware/authMiddleware");

router.use(authMiddleware);

router.get(
  "/view-details/:order_id",
  authorizeRoles(["admin"]),
  viewOrderDetails
);

router.post("/place-order", authorizeRoles(["admin"]), placeOrder);

module.exports = router;
