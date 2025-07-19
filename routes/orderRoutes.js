const express = require("express");
const router = express.Router();
const {
  authMiddleware,
  authorizeRoles,
} = require("../models/middleware/authMiddleware");

const orderController = require("../controllers/orderController");
router.use(authMiddleware);

router.get("/users-orders/", orderController.getOrdersByUser);
router.get(
  "/orders",
  authorizeRoles(["admin"]),
  orderController.getAllUserOrders
);
router.get(
  "/confirmed-order/:order_id/",
  orderController.getUserOrderByOrderId
);
router.get(
  "/order-by-id/:order_id/:detail_id",
  orderController.getOrderedProductDetails
);
router.get(
  "/refund-details/:detail_id",
  orderController.getProductRefundDetails
);

router.get(
  "/all-refunds",
  authorizeRoles(["admin"]),
  orderController.getRefunds
);
router.get(
  "/refunds/:refund_id",
  authorizeRoles(["admin"]),
  orderController.getRefundDetails
);
router.put(
  "/refunds/:refund_id/refund",
  authorizeRoles(["admin"]),
  orderController.updateRefundStatus
);
router.put(
  "/refunds/:refund_id/accept-refund",
  authorizeRoles(["admin"]),
  orderController.acceptReturnRequest
);
router.put(
  "/refunds/:refund_id/decline",
  authorizeRoles(["admin"]),
  orderController.declineRefund
);

router.put(
  "/update-status",
  authorizeRoles(["admin"]),
  orderController.updateOrderAndProductStatus
);
router.put(
  "/add-tracking-info",
  authorizeRoles(["admin"]),
  orderController.addTrackingInfo
);
router.put(
  "/mark-delivered",
  authorizeRoles(["admin"]),
  orderController.markAsDeliveredAndRemoveTracking
);

router.get(
  "/return-orders",
  authorizeRoles(["admin"]),
  orderController.getAllReturnRequests
);

router.put(
  "/returns/:return_id/approve",
  authorizeRoles(["admin"]),
  orderController.approveReturnRequest
);

router.put(
  "/returns/:return_id/process",
  authorizeRoles(["admin"]),
  orderController.processReturnRequest
);

router.put(
  "/returns/:return_id/reject",
  authorizeRoles(["admin"]),
  orderController.rejectReturnRequest
);

router.get(
  "/returns/order/:order_id",
  orderController.getReturnDetailsByOrderId
);

router.get(
  "/returns/details/:detail_id/:return_id",
  orderController.getOrderProductReturnDetails
);

router.get(
  "/returns/detailsByDetailId/:detail_id/",
  orderController.getReturnDetailsByDetailId
);


module.exports = router;
