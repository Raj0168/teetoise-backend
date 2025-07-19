const pool = require("../config/db");
const {
  createProduct,
  getProductById,
  getAllProducts,
  updateProduct,
  deleteProduct,
  addReview,
  reviewExists,
  updateReview,
  getNewArrivalProducts,
  incrementProductView,
  getProductByName,
  getSuggestions,
  incrementProductTrending,
  getTrendingProducts,
  getRelatedProducts,
} = require("../models/productModel");

const getAvailableSizes = async (req, res) => {
  const { product_id } = req.query;

  if (!product_id) {
    return res.status(400).json({ error: "Product ID is required" });
  }

  try {
    const result = await pool.query(
      "SELECT size, available_quantity FROM product_sizes WHERE product_id = $1",
      [product_id]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "No sizes available for this product" });
    }

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching product sizes:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const getAvailableColors = async (req, res) => {
  const { product_id } = req.query;

  if (!product_id) {
    return res.status(400).json({ error: "Product ID is required" });
  }

  try {
    // First, fetch the product_sku for the given product_id
    const skuResult = await pool.query(
      "SELECT product_sku FROM products WHERE id = $1",
      [product_id]
    );

    if (skuResult.rows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    const product_sku = skuResult.rows[0].product_sku;

    // Now, fetch all products with the same SKU but exclude the current product_id to get their colors and product_ids
    const colorsResult = await pool.query(
      "SELECT id as product_id, color FROM products WHERE product_sku = $1 AND id != $2",
      [product_sku, product_id]
    );

    if (colorsResult.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "No other colors available for this SKU" });
    }

    return res.status(200).json(colorsResult.rows);
  } catch (error) {
    console.error("Error fetching product colors:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const createProductController = async (req, res) => {
  try {
    const {
      product_title,
      product_price,
      product_selling_price,
      product_description,
      product_category,
      gender,
      photos_of_product,
      product_style,
      product_availability,
      cloth_fit,
      stock_availability,
      detailed_description,
      product_sku,
      color,
      product_name,
    } = req.body;

    const productId = await createProduct(
      product_title,
      product_price,
      product_selling_price,
      product_description,
      product_category,
      gender,
      photos_of_product,
      product_style,
      product_availability,
      cloth_fit,
      stock_availability,
      detailed_description,
      product_sku,
      color,
      product_name
    );

    res
      .status(201)
      .json({ message: "Product created successfully", productId });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while creating the product" });
  }
};

const getProductByIdController = async (req, res) => {
  try {
    const { id } = req.params;
    await incrementProductView(id);
    await incrementProductTrending(id);
    const product = await getProductById(id);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.status(200).json(product);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while retrieving the product" });
  }
};
const getProductByNameController = async (req, res) => {
  try {
    const { id } = req.params;
    await incrementProductView(id);
    await incrementProductTrending(id);
    const product = await getProductByName(id);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.status(200).json(product);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while retrieving the product" });
  }
};

const getAllProductsController = async (req, res) => {
  try {
    const {
      searchQuery = "",
      filter = {},
      sortBy = "popularity",
      sortOrder = "desc",
      limit = 10,
      offset = 0,
    } = req.query;

    const products = await getAllProducts({
      searchQuery,
      filter,
      sortBy,
      sortOrder,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });

    res.status(200).json(products);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while retrieving products" });
  }
};

const updateProductController = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    await updateProduct(id, updates);
    res.status(200).json({ message: "Product updated successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while updating the product" });
  }
};

const deleteProductController = async (req, res) => {
  try {
    const { id } = req.params;
    await deleteProduct(id);
    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while deleting the product" });
  }
};

const addProductVariantController = async (req, res) => {
  try {
    const productId = req.params.id;
    const { variants } = req.body; // Array of { type, value }

    // Start a transaction
    await pool.query("BEGIN");

    // First, delete existing variants for the product
    await pool.query("DELETE FROM product_variants WHERE product_id = $1", [
      productId,
    ]);

    // Insert new variants
    for (const { type, value } of variants) {
      await pool.query(
        "INSERT INTO product_variants (product_id, variant_type, variant_value) VALUES ($1, $2, $3)",
        [productId, type, value]
      );
    }

    // Commit transaction
    await pool.query("COMMIT");

    res.status(201).json({ message: "Variants updated successfully" });
  } catch (error) {
    // Rollback transaction in case of error
    await pool.query("ROLLBACK");
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while updating variants" });
  }
};

const addAvailableSizeController = async (req, res) => {
  try {
    const productId = req.params.id;
    const { sizes } = req.body; // Array of { size, available_quantity }

    // Start a transaction
    await pool.query("BEGIN");

    // First, delete existing sizes for the product
    await pool.query("DELETE FROM product_sizes WHERE product_id = $1", [
      productId,
    ]);

    // Insert new sizes
    for (const { size, available_quantity } of sizes) {
      await pool.query(
        "INSERT INTO product_sizes (product_id, size, available_quantity) VALUES ($1, $2, $3)",
        [productId, size, available_quantity]
      );
    }

    // Calculate the total stock availability by summing available_quantity for the product
    const { rows } = await pool.query(
      "SELECT SUM(available_quantity) AS total_stock FROM product_sizes WHERE product_id = $1",
      [productId]
    );
    const totalStock = rows[0].total_stock || 0;

    // Update the stock_availability column in the products table
    await pool.query(
      "UPDATE products SET stock_availability = $1 WHERE id = $2",
      [totalStock, productId]
    );

    // Commit transaction
    await pool.query("COMMIT");

    res.status(201).json({ message: "Sizes updated successfully" });
  } catch (error) {
    // Rollback transaction in case of error
    await pool.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "An error occurred while updating sizes" });
  }
};

const addProductDesignController = async (req, res) => {
  try {
    const productId = req.params.id;
    const { designs } = req.body; // Array of { type, value }

    // Start a transaction
    await pool.query("BEGIN");

    // First, delete existing designs for the product
    await pool.query("DELETE FROM product_designs WHERE product_id = $1", [
      productId,
    ]);

    // Insert new designs
    for (const { design_type, design_value } of designs) {
      await pool.query(
        "INSERT INTO product_designs (product_id, design_type, design_value) VALUES ($1, $2, $3)",
        [productId, design_type, design_value]
      );
    }

    // Commit transaction
    await pool.query("COMMIT");

    res.status(201).json({ message: "Designs updated successfully" });
  } catch (error) {
    // Rollback transaction in case of error
    await pool.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "An error occurred while updating designs" });
  }
};

const addProductTagController = async (req, res) => {
  try {
    const productId = req.params.id;
    const { tags } = req.body; // Array of tags

    await pool.query("BEGIN");

    // First, delete existing tags for the product
    await pool.query("DELETE FROM product_tags WHERE product_id = $1", [
      productId,
    ]);

    // Insert new tags
    for (const tag of tags) {
      await pool.query(
        "INSERT INTO product_tags (product_id, tag) VALUES ($1, $2)",
        [productId, tag]
      );
    }

    // Commit transaction
    await pool.query("COMMIT");

    res.status(201).json({ message: "Tags updated successfully" });
  } catch (error) {
    // Rollback transaction in case of error
    await pool.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "An error occurred while updating tags" });
  }
};

const addReviewController = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { product_id, rating, review } = req.body;

    const exists = await reviewExists(product_id, user_id);

    if (exists) {
      await updateReview(product_id, user_id, rating, review);
      res.status(200).json({ message: "Review updated successfully" });
    } else {
      await addReview(product_id, user_id, rating, review);
      res.status(201).json({ message: "Review added successfully" });
    }
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while adding or updating the review" });
  }
};

const getFilteredProductsController = async (req, res) => {
  try {
    const {
      sortBy = "popularity",
      sortOrder = "desc",
      searchQuery,
      tags,
      sizes,
      cloth_fit,
      gender,
      product_style,
      color,
      minPrice,
      maxPrice,
      available = true,
    } = req.query;

    // Ensure sortOrder is treated as a string
    const sortOrderStr = Array.isArray(sortOrder) ? sortOrder[0] : sortOrder;
    const sortByStr = Array.isArray(sortBy) ? sortBy[0] : sortBy;

    // Constructing the base query
    let baseQuery = `
      SELECT p.id, p.product_name, p.gender, p.views, p.product_title, p.product_price, p.product_selling_price, p.available_discount, 
             p.product_availability, 
             p.photos_of_product[1] AS first_photo  -- Selecting only the first image
      FROM products p
      WHERE 1=1
    `;

    let queryParams = [];
    let queryCounter = 1;

    // Product availability filter
    if (available === "true" || available === true) {
      baseQuery += ` AND p.product_availability = true`;
    }

    // Search query
    if (searchQuery) {
      const searchPattern = `%${searchQuery}%`;
      baseQuery += `
        AND (
          p.product_title ILIKE $${queryCounter} 
          OR p.product_description ILIKE $${queryCounter} 
          OR p.product_category ILIKE $${queryCounter} 
          OR p.id IN (
            SELECT product_id 
            FROM product_tags 
            WHERE tag ILIKE $${queryCounter}
          )
        )
      `;
      queryParams.push(searchPattern);
      queryCounter++;
    }

    // Tags filter
    if (tags) {
      const tagList = tags.split(",").map((tag) => tag.trim());
      baseQuery += `
        AND p.id IN (
          SELECT product_id 
          FROM product_tags 
          WHERE tag = ANY($${queryCounter})
        )
      `;
      queryParams.push(tagList);
      queryCounter++;
    }

    // Sizes filter
    if (sizes) {
      const sizeList = sizes.split(",").map((size) => size.trim());
      baseQuery += `
        AND p.id IN (
          SELECT product_id 
          FROM product_sizes 
          WHERE size = ANY($${queryCounter}) 
          AND available_quantity > 0
        )
      `;
      queryParams.push(sizeList);
      queryCounter++;
    }

    // Cloth fit filter
    if (cloth_fit) {
      const fitList = cloth_fit.split(",").map((fit) => fit.trim());
      baseQuery += ` AND p.cloth_fit = ANY($${queryCounter})`;
      queryParams.push(fitList);
      queryCounter++;
    }

    // Gender filter
    if (gender) {
      const genderList = gender.split(",").map((g) => g.trim());
      baseQuery += ` AND (p.gender = ANY($${queryCounter}) OR p.gender = 'Unisex')`;
      queryParams.push(genderList);
      queryCounter++;
    }

    // Product style filter
    if (product_style) {
      const styleList = product_style.split(",").map((style) => style.trim());
      baseQuery += ` AND p.product_style && $${queryCounter}::text[]`;
      queryParams.push(styleList);
      queryCounter++;
    }

    // Color filter
    if (color) {
      const colorList = color.split(",").map((col) => col.trim());
      baseQuery += ` AND p.color = ANY($${queryCounter})`;
      queryParams.push(colorList);
      queryCounter++;
    }

    // Price range filter
    if (minPrice) {
      baseQuery += ` AND p.product_selling_price >= $${queryCounter}`;
      queryParams.push(minPrice);
      queryCounter++;
    }
    if (maxPrice) {
      baseQuery += ` AND p.product_selling_price <= $${queryCounter}`;
      queryParams.push(maxPrice);
      queryCounter++;
    }

    // Sorting logic
    const validSortBy = ["popularity", "price"];
    const orderBy = validSortBy.includes(sortByStr)
      ? sortByStr === "popularity"
        ? "p.views"
        : "p.product_selling_price"
      : "p.views";
    const sortOrderSql = sortOrderStr.toUpperCase() === "ASC" ? "ASC" : "DESC";

    baseQuery += ` ORDER BY ${orderBy} ${sortOrderSql}`;

    // Execute the query
    const result = await pool.query(baseQuery, queryParams);

    res.status(200).json({ products: result.rows });
  } catch (error) {
    console.error("Error fetching filtered products:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const productCategory = ["T-SHIRTS", "SWEATSHIRTS"];
const tagCategory = ["OVERSIZED", "FEATURED", "GIRL"];
const styleCategory = ["ROUNDNECK", "V-NECK"];

// const result = await pool.query(
//   `SELECT p.id, p.product_title, p.available_discount, p.product_availability, p.photos_of_product
//    FROM products p
//    ${whereSql}`,
//   queryParams
// );

const getSuggestionsController = async (req, res) => {
  try {
    const { query } = req.query;
    const suggestions = await getSuggestions(query);
    res.json(suggestions);
  } catch (error) {
    res.status(500).json({ message: "Error fetching suggestions", error });
  }
};

const getTrendingProductsController = async (req, res) => {
  try {
    const trendingProducts = await getTrendingProducts();
    res.json(trendingProducts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getNewArrivalProductsController = async (req, res) => {
  try {
    const newArrivals = await getNewArrivalProducts();
    res.json(newArrivals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const fetchRelatedProducts = async (req, res) => {
  try {
    const { styles } = req.query;

    if (!styles || !Array.isArray(styles) || styles.length === 0) {
      return res.status(400).json({
        error: "Styles parameter is required and must be a non-empty array.",
      });
    }

    const relatedProducts = await getRelatedProducts(styles);
    return res.json(relatedProducts);
  } catch (error) {
    console.error("Error in fetchRelatedProducts controller", error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching related products." });
  }
};

module.exports = {
  createProductController,
  getProductByIdController,
  getAllProductsController,
  updateProductController,
  deleteProductController,
  addProductVariantController,
  addAvailableSizeController,
  addProductDesignController,
  addProductTagController,
  addReviewController,
  getFilteredProductsController,
  getProductByNameController,
  getSuggestionsController,
  getTrendingProductsController,
  getNewArrivalProductsController,
  fetchRelatedProducts,
  getAvailableSizes,
  getAvailableColors,
};
