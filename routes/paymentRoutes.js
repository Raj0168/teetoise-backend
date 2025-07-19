const express = require("express");
const {
  authMiddleware,
  authorizeRoles,
} = require("../models/middleware/authMiddleware");

const {
  verifyPayment,
  initiatePayment,
} = require("../controllers/paymentController");

const router = express.Router();
router.use(authMiddleware);

router.post("/verify-payment", verifyPayment);
router.post("/initiate-payment", initiatePayment);

module.exports = router;
