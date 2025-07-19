// routes/homeRoutes.js
const express = require("express");
const {
  getHomeScreenDetails,
  addOrUpdateFeaturedCategoriesController,
  addOrUpdateShopByOccasionController,
} = require("../controllers/homeController");
const {
  authMiddleware,
  authorizeRoles,
} = require("../models/middleware/authMiddleware");
const router = express.Router();

router.get("/home-product-details", getHomeScreenDetails);

router.use(authMiddleware);
router.post(
  "/featured-categories",
  authorizeRoles(["admin"]),
  addOrUpdateFeaturedCategoriesController
);
// router.post(
//   "/shop-by-occasion",
//   authorizeRoles(["admin"]),
//   addOrUpdateShopByOccasionController
// );

module.exports = router;
