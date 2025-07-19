const express = require("express");
const { userCreateCheckoutController } = require("../controllers/userCheckoutController");
const { getUserCheckoutDetailsController } = require("../controllers/userCheckoutController");

const {
  authMiddleware,
  authorizeRoles,
} = require("../models/middleware/authMiddleware");

const router = express.Router();

router.use(authMiddleware);

router.post("/", userCreateCheckoutController);
router.get("/", getUserCheckoutDetailsController);

module.exports = router;
