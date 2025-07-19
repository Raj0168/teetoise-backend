const pool = require("../config/db");
const bcrypt = require("bcryptjs");

const createUser = async (email, password, userType, userName) => {
  if (!password) {
    throw new Error("Password is required for user registration");
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const result = await pool.query(
    "INSERT INTO users (email, password, user_type, user_name) VALUES ($1, $2, $3, $4) RETURNING id",
    [email, hashedPassword, userType, userName]
  );
  return result.rows[0].id;
};

const findUserByEmail = async (email) => {
  const result = await pool.query("SELECT * FROM users WHERE email = $1", [
    email,
  ]);
  return result.rows[0];
};

const deleteUser = async (id) => {
  await pool.query("DELETE FROM users WHERE id = $1", [id]);
};

const getAddresses = async (userId) => {
  const result = await pool.query(
    "SELECT * FROM addresses WHERE user_id = $1",
    [userId]
  );
  return result.rows;
};

const addAddress = async (userId, addressHeader, address, pin) => {
  await pool.query(
    "INSERT INTO addresses (user_id, address_header, address, pin_code) VALUES ($1, $2, $3, $4)",
    [userId, addressHeader, address, pin]
  );
};

const removeAddress = async (addressId) => {
  await pool.query("DELETE FROM addresses WHERE id = $1", [addressId]);
};

const getUserById = async (id) => {
  const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
  return result.rows[0];
};

const getUserInfoById = async (id) => {
  const result = await pool.query(
    "SELECT email, user_name, mobile_number FROM users WHERE id = $1",
    [id]
  );
  return result.rows[0];
};

const updateUserDetails = async (id, userName, mobileNumber, gender) => {
  await pool.query(
    "UPDATE users SET user_name = $1, mobile_number = $2, gender = $3 WHERE id = $4",
    [userName, mobileNumber, gender, id]
  );
};

const saveRefreshToken = async (userId, refreshToken) => {
  await pool.query(
    "INSERT INTO refresh_tokens (user_id, token) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET token = $2",
    [userId, refreshToken]
  );
};

module.exports = {
  createUser,
  findUserByEmail,
  getUserById,
  updateUserDetails,
  deleteUser,
  addAddress,
  removeAddress,
  getAddresses,
  saveRefreshToken,
  getUserInfoById,
};
