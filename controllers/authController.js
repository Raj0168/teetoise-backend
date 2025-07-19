const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const jwt = require("jsonwebtoken");
const {
  createUser,
  findUserByEmail,
  saveRefreshToken,
  getUserById,
  updateUserDetails,
} = require("../models/user");
const sendEmail = require("../utils/emailUtils");
const crypto = require("crypto");

const OTP_RESEND_TIME = 2 * 60 * 1000; 

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await findUserByEmail(email);

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.JWT_REFRESH_SECRET,
      {
        expiresIn: "7d",
      }
    );

    await saveRefreshToken(user.id, refreshToken);

    const userData = {
      id: user.id,
      email: user.email,
      userName: user.user_name || email.split("@")[0],
      userType: user.user_type,
      gender: user.gender || "other",
    };

    return res.status(200).json({ token, refreshToken, user: userData });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: "Refresh token not provided" });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Check if the user exists
    const user = await getUserById(decoded.id);
    if (!user) {
      return res.status(403).json({ error: "Invalid refresh token" });
    }

    const storedToken = await pool.query(
      "SELECT * FROM refresh_tokens WHERE user_id = $1 AND token = $2",
      [user.id, refreshToken]
    );

    if (storedToken.rowCount === 0) {
      return res.status(403).json({ error: "Invalid refresh token" });
    }

    // Generate a new JWT
    const newToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    return res.status(200).json({ token: newToken });
  } catch (error) {
    console.error("Error refreshing token:", error);
    return res.status(403).json({ error: "Invalid refresh token" });
  }
};

const logout = async (req, res) => {
  const token = req.headers["authorization"]?.split(" ")[1];

  if (!token) {
    return res.status(400).json({ error: "No token provided" });
  }

  try {
    // Add token to blacklist with an expiration time
    await pool.query(
      "INSERT INTO token_blacklist (token, expiration) VALUES ($1, NOW() + INTERVAL '1 hour')",
      [token]
    );
    res.status(200).json({ message: "Logged out successfully" });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
};

const register = async (req, res) => {
  const { email, password, userType } = req.body;
  const existingUser = await findUserByEmail(email);

  if (existingUser) {
    return res.status(400).json({ error: "Email already in use" });
  }

  // Check if an OTP request has been made in the last 2 minutes
  const lastRequest = await pool.query(
    "SELECT * FROM otp_codes WHERE email = $1 ORDER BY created_at DESC LIMIT 1",
    [email]
  );

  const currentTime = new Date();

  if (
    lastRequest.rowCount > 0 &&
    new Date(lastRequest.rows[0].resend_otp_time) > currentTime
  ) {
    const waitTime = Math.ceil(
      (new Date(lastRequest.rows[0].resend_otp_time) - currentTime) / 1000
    );
    return res.status(429).json({
      error: `Please wait ${waitTime} seconds before requesting a new OTP`,
    });
  }

  // Invalidate any existing OTP
  await pool.query("DELETE FROM otp_codes WHERE email = $1", [email]);

  // Generate new OTP
  const otp = crypto.randomInt(100000, 999999).toString();
  const resendOtpTime = new Date(currentTime.getTime() + OTP_RESEND_TIME);
  await pool.query(
    "INSERT INTO otp_codes (email, otp, expiration, created_at, resend_otp_time) VALUES ($1, $2, NOW() + INTERVAL '10 minutes', NOW(), $3)",
    [email, otp, resendOtpTime]
  );

  // Send OTP to user
  await sendEmail(
    email,
    "Hi! register with us using OTP",
    `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
      <h2 style="text-align: center; color: #333;">Welcome to Teetoise!</h2>
      <p>Hi,</p>
      <p>We're excited to have you onboard! Please use the following OTP to verify your account:</p>
      <div style="text-align: center; margin: 20px 0;">
        <span style="font-size: 24px; font-weight: bold; color: #28a745;">${otp}</span>
      </div>
      <p>If you did not request this, please ignore this email.</p>
      <hr style="border: 1px solid #ddd;">
      <footer style="text-align: center; font-size: 12px; color: #888;">
        
        <p style="margin: 5px 0;">This email was sent to <strong>${email}</strong></p>
        <p style="margin: 5px 0;">&copy; ${new Date().getFullYear()} Teetoise. All rights reserved.</p>
      </footer>
    </div>
    `
  );

  if (userType === "admin") {
    const adminOtp = crypto.randomInt(100000, 999999).toString();
    await pool.query(
      "INSERT INTO otp_codes (email, otp, expiration, created_at, resend_otp_time) VALUES ($1, $2, NOW() + INTERVAL '10 minutes', NOW(), $3)",
      ["imprateek08@gmail.com", adminOtp, resendOtpTime]
    );

    await sendEmail(
      "imprateek08@gmail.com",
      "Admin OTP Code",
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <h2 style="text-align: center; color: #333;">Welcome to Teetoise!</h2>
          <p>Hi,</p>
          <p>We're excited to have you onboard! Please use the following OTP to verify your account:</p>
          <div style="text-align: center; margin: 20px 0;">
            <span style="font-size: 24px; font-weight: bold; color: #28a745;">${adminOtp}</span>
          </div>
          <p>If you did not request this, please ignore this email.</p>
          <hr style="border: 1px solid #ddd;">
          <footer style="text-align: center; font-size: 12px; color: #888;">
            
            <p style="margin: 5px 0;">This email was sent to <strong>${email}</strong></p>
            <p style="margin: 5px 0;">&copy; ${new Date().getFullYear()} Teetoise. All rights reserved.</p>
          </footer>
        </div>
      `
    );
  }

  res.status(200).json({ message: "OTP sent to your email" });
};

const resendOtp = async (req, res) => {
  const { email } = req.body;

  const currentTime = new Date();
  const lastRequest = await pool.query(
    "SELECT * FROM otp_codes WHERE email = $1 ORDER BY created_at DESC LIMIT 1",
    [email]
  );

  if (
    lastRequest.rowCount > 0 &&
    new Date(lastRequest.rows[0].resend_otp_time) > currentTime
  ) {
    const waitTime = Math.ceil(
      (new Date(lastRequest.rows[0].resend_otp_time) - currentTime) / 1000
    );
    return res.status(429).json({
      error: `Please wait ${waitTime} seconds before requesting a new OTP`,
    });
  }

  const otp = crypto.randomInt(100000, 999999).toString();
  const resendOtpTime = new Date(currentTime.getTime() + OTP_RESEND_TIME);

  await pool.query(
    "UPDATE otp_codes SET otp = $1, created_at = NOW(), expiration = NOW() + INTERVAL '10 minutes', resend_otp_time = $2 WHERE email = $3",
    [otp, resendOtpTime, email]
  );

  await sendEmail(
    email,
    "Your OTP Code",
    `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
      <h2 style="text-align: center; color: #333;">Welcome to Teetoise!</h2>
      <p>Hi,</p>
      <p>We're excited to have you onboard! Your new OTP code:</p>
      <div style="text-align: center; margin: 20px 0;">
        <span style="font-size: 24px; font-weight: bold; color: #28a745;">${otp}</span>
      </div>
      <p>If you did not request this, please ignore this email.</p>
      <hr style="border: 1px solid #ddd;">
      <footer style="text-align: center; font-size: 12px; color: #888;">
        
        <p style="margin: 5px 0;">This email was sent to <strong>${email}</strong></p>
        <p style="margin: 5px 0;">&copy; ${new Date().getFullYear()} Teetoise. All rights reserved.</p>
      </footer>
    </div>
    `
  );

  res.status(200).json({ message: "OTP resent to your email" });
};

const verifyOtp = async (req, res) => {
  const { email, userOtp, adminOtp, password, userType } = req.body;

  if (userType === "admin") {
    // Verify user's OTP
    const resultUser = await pool.query(
      "SELECT * FROM otp_codes WHERE email = $1 AND otp = $2 AND expiration > NOW()",
      [email, userOtp]
    );

    // Verify admin's OTP
    const resultAdmin = await pool.query(
      "SELECT * FROM otp_codes WHERE email = $1 AND otp = $2 AND expiration > NOW()",
      ["imprateek08@gmail.com", adminOtp] // Admin email
    );

    if (resultUser.rowCount === 0 || resultAdmin.rowCount === 0) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    // Delete both OTPs after successful verification
    await pool.query("DELETE FROM otp_codes WHERE email = $1", [email]);
    await pool.query("DELETE FROM otp_codes WHERE email = $1", [
      "imprateek08@gmail.com",
    ]);
  } else {
    // Regular user OTP verification
    const result = await pool.query(
      "SELECT * FROM otp_codes WHERE email = $1 AND otp = $2 AND expiration > NOW()",
      [email, userOtp]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    // Delete OTP after successful verification
    await pool.query("DELETE FROM otp_codes WHERE email = $1", [email]);
  }

  const temp_name = email.slice(0, email.indexOf("@")); // Extracting name before '@'
  const userId = await createUser(email, password, userType, temp_name);
  res.status(201).json({ message: "User registered successfully", userId });
};

const resetPassword = async (req, res) => {
  const { email } = req.body;
  const user = await findUserByEmail(email);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // Check if a reset request has been made in the last 2 minutes
  const lastResetRequest = await pool.query(
    "SELECT * FROM reset_tokens WHERE email = $1 ORDER BY created_at DESC LIMIT 1",
    [email]
  );

  const currentTime = new Date();

  if (
    lastResetRequest.rowCount > 0 &&
    new Date(lastResetRequest.rows[0].created_at) > currentTime - 2 * 60 * 1000
  ) {
    const waitTime = Math.ceil(
      (new Date(lastResetRequest.rows[0].created_at).getTime() +
        2 * 60 * 1000 -
        currentTime.getTime()) /
        1000
    );
    return res.status(429).json({
      error: `Please wait ${waitTime} seconds before requesting a new password reset link`,
    });
  }

  // Generate reset token and link
  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetLink = `${process.env.FRONTEND_URL}/auth/update-password?token=${resetToken}`;

  // Store reset token in database with expiration (1 hour)
  await pool.query(
    "INSERT INTO reset_tokens (email, token, expiration, created_at) VALUES ($1, $2, NOW() + INTERVAL '1 hour', NOW())",
    [email, resetToken]
  );

  const htmlContent = `
    <div style="text-align: center;">
      <h1>Password Reset</h1>
      <p>You requested a password reset. Click the button below to reset your password:</p>
      <a href="${resetLink}" style="
        background-color: #f8d32a;
        color: #000;
        font-weight: 600;
        padding: 14px 25px;
        text-align: center;
        display: inline-block;
        border-radius: 10px;
      ">Reset Password</a>
       <p>If you did not request this, please ignore this email.</p>
        <hr style="border: 1px solid #ddd;">
        <footer style="text-align: center; font-size: 12px; color: #888;">
          
          <p style="margin: 5px 0;">This email was sent to <strong>${email}</strong></p>
          <p style="margin: 5px 0;">&copy; ${new Date().getFullYear()} Teetoise. All rights reserved.</p>
        </footer>
    </div>
  `;

  // Send email with reset link
  await sendEmail(email, "Password Reset", htmlContent);

  res.status(200).json({ message: "Password reset link sent" });
};

const updatePassword = async (req, res) => {
  const { resetToken, newPassword } = req.body;

  const result = await pool.query(
    "SELECT * FROM reset_tokens WHERE token = $1 AND expiration > NOW()",
    [resetToken]
  );

  if (result.rowCount === 0) {
    return res.status(400).json({ error: "Invalid or expired reset token" });
  }

  const email = result.rows[0].email;
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await pool.query("UPDATE users SET password = $1 WHERE email = $2", [
    hashedPassword,
    email,
  ]);
  await pool.query("DELETE FROM reset_tokens WHERE token = $1", [resetToken]);

  res.status(200).json({ message: "Password updated successfully" });
};

module.exports = {
  register,
  verifyOtp,
  login,
  resendOtp,
  resetPassword,
  updatePassword,
  logout,
  refreshToken,
};
