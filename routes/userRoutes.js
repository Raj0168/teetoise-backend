const express = require("express");
const {
  authMiddleware,
  authorizeRoles,
} = require("../models/middleware/authMiddleware");
const {
  addUserDetails,
  getUserDetails,
  addAddressController,
  removeAddressController,
  getAllAddresses,
  deleteUser
} = require("../controllers/userController");

const router = express.Router();

// Middleware to authenticate user
router.use(authMiddleware);

// Route accessible only to authenticated users
router.post("/details", addUserDetails);
router.get("/details", getUserDetails);
router.delete("/details", deleteUser);
router.post("/address", addAddressController);
router.get("/address", getAllAddresses);
router.delete("/address/:addressId", removeAddressController);

module.exports = router;
