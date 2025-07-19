const express = require("express");
const {
  register,
  verifyOtp,
  login,
  resetPassword,
  updatePassword,
  logout,
  refreshToken,
  resendOtp,
} = require("../controllers/authController");
const router = express.Router();
const { authMiddleware } = require("../models/middleware/authMiddleware");
const passport = require("passport");

router.post("/register", register);
router.post("/verify-otp", verifyOtp);
router.post("/login", login);
router.post("/reset-password", resetPassword);
router.post("/resend-otp", resendOtp);
router.post("/update-password", updatePassword);
router.post("/refresh-token", refreshToken);

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => {
    const user = req.user;

    // Create JWT token
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" }
    );

    res.redirect(
      `http://localhost:3000/auth/success?token=${token}&refreshToken=${refreshToken}`
    );
  }
);

router.use(authMiddleware);
router.post("/logout", logout);

module.exports = router;
