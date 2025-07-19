const {
  userCreateCheckout,
  getUserCheckoutDetails,
} = require("../models/userCheckoutModel");

const userCreateCheckoutController = async (req, res) => {
  const { couponCode } = req.body;

  try {
    const userId = req.user.id;
    const result = await userCreateCheckout(userId, couponCode);

    if (result.message === "Checkout created successfully") {
      return res.status(200).json(result);
    } else {
      return res.status(500).json(result);
    }
  } catch (error) {
    console.error("Error in checkoutController:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const getUserCheckoutDetailsController = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await getUserCheckoutDetails(userId);

    if (result.message) {
      return res.status(404).json({ message: result.message });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in getCheckoutDetailsController:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  userCreateCheckoutController,
  getUserCheckoutDetailsController,
};
