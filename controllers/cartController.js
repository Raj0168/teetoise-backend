const {
  addProductToCart,
  removeProductFromCart,
  getUserCart,
  updateCartItem,
  getAvailableSizesAndQuantities,
} = require("../models/cartModel");

const { clearCart } = require("../models/orderModel");

const addToCartController = async (req, res) => {
  try {
    const userId = req.user.id; // Extracted from token (authMiddleware)
    const { product_id, size, variant, quantity } = req.body;
    await addProductToCart(userId, product_id, size, variant, quantity);
    res.status(200).json({ message: "Product added to cart" });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "An error occurred while adding the product to the cart",
    });
  }
};

const getAvailableSizesController = async (req, res) => {
  try {
    const { product_id } = req.params;
    const availableSizes = await getAvailableSizesAndQuantities(product_id);

    if (availableSizes.length === 0) {
      return res
        .status(404)
        .json({ message: "No available sizes found for this product" });
    }

    res.status(200).json({
      product_id,
      available_sizes: availableSizes,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "An error occurred while fetching available sizes and quantities",
    });
  }
};

const updateCartController = async (req, res) => {
  try {
    const userId = req.user.id;
    const { product_id, old_size, new_size, variant, quantity } = req.body;

    await updateCartItem(
      userId,
      product_id,
      old_size,
      new_size,
      variant,
      quantity
    );
    res.status(200).json({ message: "Cart item updated successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while updating cart item" });
  }
};

const clearCartController = async (req, res) => {
  try {
    const userId = req.user.id;
    await clearCart(userId);
    res.status(200).json({ message: "Cart has been cleared." });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "An error occurred while clearing cart",
    });
  }
};

const removeFromCartController = async (req, res) => {
  try {
    const userId = req.user.id; // Extracted from token (authMiddleware)
    const { product_id, size } = req.body;

    await removeProductFromCart(userId, product_id, size);
    res.status(200).json({ message: "Product removed from cart" });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "An error occurred while removing the product from the cart",
    });
  }
};

const getCartController = async (req, res) => {
  try {
    const userId = req.user.id; 
    const cart = await getUserCart(userId);
    res.status(200).json(cart);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while retrieving the cart" });
  }
};

module.exports = {
  addToCartController,
  removeFromCartController,
  getCartController,
  updateCartController,
  clearCartController,
  getAvailableSizesController,
};
