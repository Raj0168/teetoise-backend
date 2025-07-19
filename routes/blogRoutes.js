// src/routes.js
const express = require("express");
const router = express.Router();
const {
  addBlog,
  getBlogs,
  getBlogById,
  getBlogByTitle,
} = require("../controllers/blogController");

const { authMiddleware } = require("../models/middleware/authMiddleware");

router.get("/blogs", getBlogs);
router.get("/blogs/:id", getBlogById);

router.use(authMiddleware);
router.post("/blogs", addBlog);

module.exports = router;
