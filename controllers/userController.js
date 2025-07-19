// controllers/userController.js
const {
  updateUserDetails,
  getUserById,
  addAddress,
  removeAddress,
  getAddresses,
} = require("../models/user");

const addUserDetails = async (req, res) => {
  try {
    const { userName, mobileNumber, gender } = req.body;
    const userId = req.user.id;

    await updateUserDetails(userId, userName, mobileNumber, gender);
    res.status(200).json({ message: "User details updated" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while updating user details" });
  }
};

const getAllAddresses = async (req, res) => {
  try {
    const userId = req.user.id;
    const addresses = await getAddresses(userId);
    res.status(200).json(addresses);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while retrieving user addresses" });
  }
};

const addAddressController = async (req, res) => {
  try {
    const { address_header, address, pin_code } = req.body;
    const userId = req.user.id;
    await addAddress(userId, address_header, address, pin_code);
    res.status(200).json({ message: "Address added successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while adding the address" });
  }
};

const removeAddressController = async (req, res) => {
  try {
    const { addressId } = req.params;
    await removeAddress(addressId);
    res.status(200).json({ message: "Address removed successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while removing the address" });
  }
};

const getUserDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await getUserById(userId);

    res.status(200).json(user);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while retrieving user details" });
  }
};

const deleteUser = async (req, res) => {
  try {
    const userId = req.user.id;

    await pool.query("DELETE FROM addresses WHERE user_id = $1", [userId]);

    await deleteUser(userId);

    res.status(200).json({ message: "User account deleted successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while deleting the user account" });
  }
};

module.exports = {
  addUserDetails,
  getUserDetails,
  addAddressController,
  removeAddressController,
  getAllAddresses,
  deleteUser,
};
