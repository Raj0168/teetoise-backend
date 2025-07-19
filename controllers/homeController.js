const pool = require("../config/db");
const {
  addOrUpdateFeaturedCategories,
  addOrUpdateShopByOccasion,
} = require("../models/homeModel");

const addOrUpdateFeaturedCategoriesController = async (req, res) => {
  try {
    const categories = req.body; // Array of { category_name, image_url, tags }

    if (!Array.isArray(categories)) {
      return res.status(400).json({ error: "Invalid data format" });
    }

    await addOrUpdateFeaturedCategories(categories);
    res
      .status(200)
      .json({ message: "Featured categories added or updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Commented out Shop by Occasion Controller
/*
const addOrUpdateShopByOccasionController = async (req, res) => {
  try {
    const occasions = req.body; // Array of { occasion_name, image_url }

    if (!Array.isArray(occasions)) {
      return res.status(400).json({ error: "Invalid data format" });
    }

    await addOrUpdateShopByOccasion(occasions);
    res.status(200).json({
      message: "Shop by occasion details added or updated successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
*/

const getHomeScreenDetails = async (req, res) => {
  try {
    const featuredCategoriesResult = await pool.query(
      "SELECT * FROM featured_categories"
    );
    const featuredCategories = featuredCategoriesResult.rows.reduce(
      (acc, row) => {
        acc[row.category_name] = {
          image_url: row.image_url,
          tags: row.tags,
        };
        return acc;
      },
      {}
    );

    // Fetch featured products with DISTINCT ON product_sku
    const featuredProductTagsResult = await pool.query(
      "SELECT product_id FROM product_tags WHERE tag = 'FEATURED'"
    );
    const featuredProductIds = featuredProductTagsResult.rows.map(
      (row) => row.product_id
    );

    const featuredProductsResult = await pool.query(
      `SELECT DISTINCT ON (p.product_sku) 
             p.id, p.product_name, p.product_title, p.available_discount, 
             p.product_availability, p.product_sku, p.photos_of_product[1] AS first_photo
       FROM products p
       WHERE p.id = ANY($1::int[]) AND p.product_availability = true
       ORDER BY p.product_sku, p.updated_at DESC
       LIMIT 10`,
      [featuredProductIds]
    );

    const featuredProducts = featuredProductsResult.rows;

    // Fetch popular products with DISTINCT ON product_sku
    const popularProductsResult = await pool.query(
      `SELECT *
              FROM (
                  SELECT DISTINCT ON (p.product_sku) 
                        p.id, 
                        p.views, 
                        p.product_name, 
                        p.product_title, 
                        p.available_discount, 
                        p.product_availability, 
                        p.product_sku, 
                        p.photos_of_product[1] AS first_photo
                  FROM products p
                  ORDER BY p.product_sku, p.views DESC 
              ) subquery
              ORDER BY subquery.views DESC
              LIMIT 10;`
    );
    const popularProducts = popularProductsResult.rows;

    // Fetch new arrival products
    const newArrivalProducts = await getNewArrivalProducts();

    res.status(200).json({
      featured_categories: featuredCategories,
      featured_products: featuredProducts,
      popular_right_now: popularProducts,
      new_arrivals: newArrivalProducts,
      // shop_by_occasion: shopByOccasion, // Commented out shop_by_occasion
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// New Arrival Products query
const getNewArrivalProducts = async () => {
  try {
    const { rows } = await pool.query(`
      SELECT *
FROM (
    SELECT DISTINCT ON (p.product_sku) 
           p.product_name, 
           p.product_price, 
           p.gender,
           p.product_selling_price, 
           p.product_title, 
           p.id, 
           p.available_discount, 
           p.product_availability,
           p.product_sku,
           p.updated_at,
           p.photos_of_product[1] AS photo
    FROM products p
    WHERE p.product_availability = true
    ORDER BY p.product_sku, p.updated_at DESC
) AS subquery
ORDER BY subquery.updated_at DESC LIMIT 10;

    `);

    return rows;
  } catch (error) {
    console.error("Error fetching new arrival products:", error);
    throw new Error("Could not fetch new arrival products");
  }
};

module.exports = {
  getHomeScreenDetails,
  addOrUpdateFeaturedCategoriesController,
  // addOrUpdateShopByOccasionController,
};
