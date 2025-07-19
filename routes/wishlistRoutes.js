const express = require("express");
const { authMiddleware } = require("../models/middleware/authMiddleware");
const {
  addToWishlistController,
  removeFromWishlistController,
  removeAllFromWishlistController,
  getWishlistController,
} = require("../controllers/wishlistController");

const router = express.Router();

// Middleware to authenticate user
router.use(authMiddleware);

// Routes for wishlist
router.post("/", addToWishlistController); // Add a product to wishlist
router.delete("/", removeFromWishlistController); // Remove a product from wishlist
router.delete("/removeAll", removeAllFromWishlistController); // Remove a product from wishlist
router.get("/", getWishlistController); // Get all products in wishlist

module.exports = router;
