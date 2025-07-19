const express = require("express");
const {
  createProductController,
  getProductByIdController,
  getAllProductsController,
  updateProductController,
  deleteProductController,
  addProductVariantController,
  addAvailableSizeController,
  addProductDesignController,
  addProductTagController,
  addReviewController,
  getFilteredProductsController,
  getSuggestionsController,
  getTrendingProductsController,
  fetchRelatedProducts,
  getProductByNameController,
  getNewArrivalProductsController,
  getAvailableSizes,
  getAvailableColors,
} = require("../controllers/productController");
const {
  authMiddleware,
  authorizeRoles,
} = require("../models/middleware/authMiddleware");

const router = express.Router();

// Routes accessible to all users (no token required)
router.get("/products/:id", getProductByNameController);
router.get("/products", getAllProductsController);
router.get("/getFilteredResults", getFilteredProductsController);
router.get("/suggestions", getSuggestionsController);
router.get("/trending", getTrendingProductsController);
router.get("/new-arrivals", getNewArrivalProductsController);
router.get("/related-products", fetchRelatedProducts);
router.get("/products/sizes", getAvailableSizes);
router.get("/products/colors", getAvailableColors);

// Apply authMiddleware to all routes after this point
router.use(authMiddleware);

// Routes accessible to admin only (must be logged in and have admin role)
router.post("/products", authorizeRoles(["admin"]), createProductController);
router.put("/products/:id", authorizeRoles(["admin"]), updateProductController);
router.delete(
  "/products/:id",
  authorizeRoles(["admin"]),
  deleteProductController
);
// router.post(
//   "/products/:id/variants",
//   authorizeRoles(["admin"]),
//   addProductVariantController
// );
router.post(
  "/products/:id/sizes",
  authorizeRoles(["admin"]),
  addAvailableSizeController
);
router.post(
  "/products/:id/designs",
  authorizeRoles(["admin"]),
  addProductDesignController
);
router.post(
  "/products/:id/tags",
  authorizeRoles(["admin"]),
  addProductTagController
);

router.post(
  "/products/:id/reviews",
  authorizeRoles(["admin", "customer"]),
  addReviewController
);

module.exports = router;
