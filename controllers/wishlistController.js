const {
  addProductToWishlist,
  removeProductFromWishlist,
  getUserWishlist,
  removeAllProductFromWishlist,
} = require("../models/wishlistModel");

const addToWishlistController = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.body;

    const message = await addProductToWishlist(userId, productId);

    res.status(200).json({ message });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "An error occurred while adding the product to the wishlist",
    });
  }
};

const removeFromWishlistController = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.body;
    await removeProductFromWishlist(userId, productId);
    res.status(200).json({ message: "Product removed from wishlist" });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "An error occurred while removing the product from the wishlist",
    });
  }
};

const removeAllFromWishlistController = async (req, res) => {
  try {
    const userId = req.user.id;
    await removeAllProductFromWishlist(userId);
    res.status(200).json({ message: "All Products removed from wishlist" });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "An error occurred while removing the all the products",
    });
  }
};

const getWishlistController = async (req, res) => {
  try {
    const userId = req.user.id; // Extracted from token (authMiddleware)
    const wishlist = await getUserWishlist(userId);
    res.status(200).json(wishlist);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while retrieving the wishlist" });
  }
};

module.exports = {
  addToWishlistController,
  removeFromWishlistController,
  getWishlistController,
  removeAllFromWishlistController,
};
