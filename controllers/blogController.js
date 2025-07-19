// src/controllers.js
const pool = require("../config/db");

// Add a new blog post
const addBlog = async (req, res) => {
  const { title, sections } = req.body;

  // Validate input
  if (!title || !sections || !Array.isArray(sections)) {
    return res
      .status(400)
      .json({ error: "Title and sections (array) are required" });
  }

  try {
    const result = await pool.query(
      "INSERT INTO blogs (title, sections) VALUES ($1, $2) RETURNING *",
      [title, JSON.stringify(sections)]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getBlogs = async (req, res) => {
    try {
        const result = await pool.query('SELECT id, title FROM blogs');
        res.status(200).json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get a blog by ID
const getBlogById = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('SELECT * FROM blogs WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Blog not found' });
        }
        res.status(200).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
  addBlog,
  getBlogs,
  getBlogById,
};
