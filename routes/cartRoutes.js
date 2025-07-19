const express = require("express");
const {
  addToCartController,
  removeFromCartController,
  getCartController,
  updateCartController,
  clearCartController,
  getAvailableSizesController,
} = require("../controllers/cartController");

const {
  authMiddleware,
  authorizeRoles,
} = require("../models/middleware/authMiddleware");

const router = express.Router();

router.get("/sizeAvailability/:product_id", getAvailableSizesController);

// Middleware to authenticate user
router.use(authMiddleware);

// Routes for cart
router.post("/", authorizeRoles(["customer"]), addToCartController); // Add a product to cart
router.delete("/", authorizeRoles(["customer"]), removeFromCartController); // Remove a product from cart
router.delete("/clearCart", authorizeRoles(["customer"]), clearCartController); // Remove a product from cart
router.get("/", getCartController); // Get all products in cart
router.put("/", authorizeRoles(["customer"]), updateCartController);

module.exports = router;
