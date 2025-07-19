const RefundModel = require("../models/refundModel");

const RefundController = {
  cancelOrderItem: async (req, res) => {
    const user_id = req.user.id;
    const { order_id, detail_id } = req.params;
    const { cancelReason } = req.body;

    try {
      if (!cancelReason) {
        return res
          .status(400)
          .json({ message: "Cancellation reason is required" });
      }

      const result = await RefundModel.cancelOrderItem(
        user_id,
        order_id,
        detail_id,
        cancelReason
      );
      return res.status(200).json({
        message: "Order item canceled successfully",
        data: result,
      });
    } catch (err) {
      return res.status(500).json({
        message:
          err.message || "Something went wrong while canceling the order item",
      });
    }
  },

  changeSizeProduct: async (req, res) => {
    const user_id = req.user.id;
    const { order_id, detail_id, new_size } = req.params;

    try {
      if (!new_size) {
        return res
          .status(400)
          .json({ message: "Cancellation reason is required" });
      }

      const result = await RefundModel.updateProductSize(
        user_id,
        order_id,
        detail_id,
        new_size
      );
      return res.status(200).json({
        message: "Size changed successfully",
        data: result,
      });
    } catch (err) {
      return res.status(500).json({
        message: err.message || "Something went wrong while changing size",
      });
    }
  },

  requestReturnForItem: async (req, res) => {
    const user_id = req.user.id;
    const { order_id, detail_id } = req.params;
    const { returnReason } = req.body;

    try {
      if (!returnReason) {
        return res.status(400).json({ message: "Return reason is required" });
      }

      const result = await RefundModel.requestReturnForItem(
        user_id,
        order_id,
        detail_id,
        returnReason,
      );
      return res.status(200).json({
        message: "Return requested successfully",
        data: result,
      });
    } catch (err) {
      return res.status(500).json({
        message:
          err.message || "Something went wrong while requesting the return",
      });
    }
  },

  requestExchangeForItem: async (req, res) => {
    const user_id = req.user.id;
    const { order_id, detail_id } = req.params;
    const { exchangeReason, size } = req.body;

    try {
      if (!exchangeReason) {
        return res.status(400).json({ message: "Exchange reason is required" });
      }

      const result = await RefundModel.requestExchangeForItem(
        user_id,
        order_id,
        detail_id,
        exchangeReason,
        size
      );
      return res.status(200).json({
        message: "Exchange requested successfully",
        data: result,
      });
    } catch (err) {
      return res.status(500).json({
        message:
          err.message || "Something went wrong while requesting the exchange",
      });
    }
  },
};

module.exports = RefundController;
