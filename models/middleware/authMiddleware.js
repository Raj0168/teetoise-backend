const jwt = require("jsonwebtoken");
const pool = require("../../config/db");

// Middleware to authenticate the user
const authMiddleware = async (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    // Check if token is blacklisted
    const result = await pool.query(
      "SELECT * FROM token_blacklist WHERE token = $1",
      [token]
    );
    if (result.rowCount > 0) {
      return res.status(401).json({ error: "Token has been invalidated" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // Fetch user details including user_type from the database
    const userResult = await pool.query(
      "SELECT user_type FROM users WHERE id = $1",
      [decoded.id]
    );
    const userType = userResult.rows[0]?.user_type;

    req.user.userType = userType; // Add userType to the request

    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
};

// Middleware to authorize user roles
const authorizeRoles = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.userType)) {
      return res
        .status(403)
        .json({ error: "Access forbidden: insufficient rights" });
    }
    next();
  };
};

module.exports = { authMiddleware, authorizeRoles };
