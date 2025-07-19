const cron = require("node-cron");
const pool = require("../config/db");

const createProduct = async (
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
) => {
  // Insert product details into the products table, including the calculated selling price
  const productResult = await pool.query(
    `INSERT INTO products 
    (product_title, product_price, available_discount, product_selling_price, product_description, 
     product_category, gender, photos_of_product, product_style, 
     product_availability, cloth_fit, stock_availability, detailed_description, 
     product_sku, color, product_name) 
    VALUES 
    ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) 
    RETURNING id`,
    [
      product_title,
      product_price,
      ((product_price - product_selling_price) / product_price) * 100,
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
    ]
  );

  const productId = productResult.rows[0].id;

  // Insert the product variant
  const variantResult = await pool.query(
    `INSERT INTO product_variants 
    (product_name, product_color, product_id, product_sku) 
    VALUES 
    ($1, $2, $3, $4) 
    RETURNING id`,
    [product_name, color, productId, product_sku]
  );

  return productId;
};

const getProductById = async (id) => {
  const query = `
    SELECT
      p.id AS product_id,
      p.product_title,
      p.product_sku,
      p.product_description,
      p.product_price,
      p.product_selling_price,
      p.gender,
      p.available_discount,
      p.product_category,
      p.product_availability,
      p.cloth_fit,
      p.stock_availability,
      p.photos_of_product,
      p.detailed_description,
      p.product_style,
      pt.tag,
      ps.size,
      ps.available_quantity,
      pd.design_type,
      pd.design_value,
      pv.product_sku,
      pv.product_name AS variant_name,
      pv.product_color AS variant_color,
      pv.product_id AS variant_id
    FROM
      products p
    LEFT JOIN
      product_tags pt ON p.id = pt.product_id
    LEFT JOIN
      product_sizes ps ON p.id = ps.product_id
    LEFT JOIN
      product_designs pd ON p.id = pd.product_id
    LEFT JOIN
      product_variants pv ON p.product_sku = pv.product_sku
    WHERE
      p.id = $1
  `;

  try {
    const result = await pool.query(query, [id]);

    // Use Sets to filter out duplicates and objects for sizes
    const uniqueColors = new Set();
    const sizesQuantity = {};

    const product = result.rows.reduce((acc, row) => {
      if (!acc) {
        acc = {
          id: row.product_id,
          product_title: row.product_title,
          product_sku: row.product_sku,
          product_description: row.product_description,
          product_price: row.product_price,
          product_selling_price: row.product_selling_price,
          gender: row.gender,
          available_discount: row.available_discount,
          product_category: row.product_category,
          product_availability: row.product_availability,
          cloth_fit: row.cloth_fit,
          stock_availability: row.stock_availability,
          photos_of_product: row.photos_of_product,
          detailed_description: row.detailed_description,
          product_style: row.product_style,
          tags: [],
          sizes: {},
          design_types: [],
          design_values: [],
          available_colors: [],
        };
      }

      // Populate tags
      if (row.tag && !acc.tags.includes(row.tag)) {
        acc.tags.push(row.tag);
      }

      // Populate sizes and quantities
      if (row.size) {
        if (!acc.sizes[row.size]) {
          acc.sizes[row.size] = 0;
        }
        acc.sizes[row.size] = row.available_quantity || 0;
      }

      // Populate design types
      if (row.design_type && !acc.design_types.includes(row.design_type)) {
        acc.design_types.push(row.design_type);
      }

      // Populate design values
      if (row.design_value && !acc.design_values.includes(row.design_value)) {
        acc.design_values.push(row.design_value);
      }

      // Populate unique available colors
      if (row.variant_color && row.variant_name && row.variant_id) {
        const colorKey = `${row.variant_color}:${row.variant_name}`;
        if (!uniqueColors.has(colorKey)) {
          uniqueColors.add(colorKey);
          acc.available_colors.push({
            productColor: row.variant_color,
            productName: row.variant_name,
            productId: row.variant_id,
          });
        }
      }

      return acc;
    }, null);

    // Convert sizes object to desired format
    product.sizes = Object.entries(product.sizes).reduce(
      (acc, [size, quantity]) => {
        acc[size] = quantity;
        return acc;
      },
      {}
    );

    return product;
  } catch (error) {
    console.error("Error fetching product details", error);
    throw error;
  }
};

const getProductByName = async (id) => {
  const query = `
    SELECT
      p.id AS product_id,
      p.product_title,
      p.product_sku,
      p.product_description,
      p.product_price,
      p.product_selling_price,
      p.gender,
      p.available_discount,
      p.product_category,
      p.product_availability,
      p.cloth_fit,
      p.stock_availability,
      p.photos_of_product,
      p.detailed_description,
      p.product_style,
      p.color,
      pt.tag,
      ps.size,
      ps.available_quantity,
      pd.design_type,
      pd.design_value,
      pv.product_sku,
      pv.product_name AS variant_name,
      pv.product_color AS variant_color,
      pv.product_id AS variant_id
    FROM
      products p
    LEFT JOIN
      product_tags pt ON p.id = pt.product_id
    LEFT JOIN
      product_sizes ps ON p.id = ps.product_id
    LEFT JOIN
      product_designs pd ON p.id = pd.product_id
    LEFT JOIN
      product_variants pv ON p.product_sku = pv.product_sku
    WHERE
      p.product_name = $1
  `;

  try {
    const result = await pool.query(query, [id]);

    // Use Sets to filter out duplicates and objects for sizes
    const uniqueColors = new Set();
    const sizesQuantity = {};

    const product = result.rows.reduce((acc, row) => {
      if (!acc) {
        acc = {
          id: row.product_id,
          product_title: row.product_title,
          product_sku: row.product_sku,
          product_description: row.product_description,
          product_price: row.product_price,
          product_selling_price: row.product_selling_price,
          gender: row.gender,
          available_discount: row.available_discount,
          product_category: row.product_category,
          product_availability: row.product_availability,
          cloth_fit: row.cloth_fit,
          stock_availability: row.stock_availability,
          photos_of_product: row.photos_of_product,
          detailed_description: row.detailed_description,
          product_style: row.product_style,
          color: row.color,
          tags: [],
          sizes: {},
          design_types: [],
          design_values: [],
          available_colors: [],
        };
      }

      // Populate tags
      if (row.tag && !acc.tags.includes(row.tag)) {
        acc.tags.push(row.tag);
      }

      // Populate sizes and quantities
      if (row.size) {
        if (!acc.sizes[row.size]) {
          acc.sizes[row.size] = 0;
        }
        acc.sizes[row.size] = row.available_quantity || 0;
      }

      // Populate design types
      if (row.design_type && !acc.design_types.includes(row.design_type)) {
        acc.design_types.push(row.design_type);
      }

      // Populate design values
      if (row.design_value && !acc.design_values.includes(row.design_value)) {
        acc.design_values.push(row.design_value);
      }

      // Populate unique available colors
      if (row.variant_color && row.variant_name && row.variant_id) {
        const colorKey = `${row.variant_color}:${row.variant_name}`;
        if (!uniqueColors.has(colorKey)) {
          uniqueColors.add(colorKey);
          acc.available_colors.push({
            productColor: row.variant_color,
            productName: row.variant_name,
            productId: row.variant_id,
          });
        }
      }

      return acc;
    }, null);

    // Convert sizes object to desired format
    product.sizes = Object.entries(product.sizes).reduce(
      (acc, [size, quantity]) => {
        acc[size] = quantity;
        return acc;
      },
      {}
    );

    return product;
  } catch (error) {
    console.error("Error fetching product details", error);
    throw error;
  }
};

// GET /products?searchQuery=shirt&filter=category:Men's Clothing,availability:In Stock&sortBy=price&sortOrder=asc&limit=10&offset=0
const getAllProducts = async ({
  searchQuery = "",
  filter = {},
  sortBy = "popularity",
  sortOrder = "desc",
  limit = 10,
  offset = 0,
}) => {
  // Build the WHERE clause based on searchQuery and filters
  let whereClauses = [];
  let queryParams = [];

  if (searchQuery) {
    whereClauses.push(`product_title ILIKE $${queryParams.length + 1}`);
    queryParams.push(`%${searchQuery}%`);
  }

  for (const [key, value] of Object.entries(filter)) {
    whereClauses.push(`${key} = $${queryParams.length + 1}`);
    queryParams.push(value);
  }

  const whereSql =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  // Build the ORDER BY clause based on sortBy and sortOrder
  const orderBy =
    {
      popularity: "views",
      price: "product_selling_price",
      rating: "average_rating",
      date: "created_at",
    }[sortBy] || "views";

  const result = await pool.query(
    `SELECT * FROM products ${whereSql} ORDER BY ${orderBy} ${sortOrder.toUpperCase()} LIMIT $${
      queryParams.length + 1
    } OFFSET $${queryParams.length + 2}`,
    [...queryParams, limit, offset]
  );

  return result.rows;
};

const updateProduct = async (id, updates) => {
  const fields = Object.keys(updates)
    .map((key, index) => `${key} = $${index + 1}`)
    .join(", ");
  const values = Object.values(updates);
  values.push(id);

  await pool.query(
    `UPDATE products SET ${fields} WHERE id = $${values.length}`,
    values
  );
};

const deleteProduct = async (id) => {
  await pool.query("DELETE FROM products WHERE id = $1", [id]);
};

const updateProductRating = async (productId) => {
  // Fetch all ratings for the product
  const { rows: ratings } = await pool.query(
    "SELECT rating FROM reviews WHERE product_id = $1",
    [productId]
  );

  if (ratings.length === 0) {
    // If no ratings exist, set average_rating to 0 and number_of_ratings to 0
    await pool.query(
      "UPDATE products SET average_rating = 0, number_of_ratings = 0 WHERE id = $1",
      [productId]
    );
    return;
  }

  // Calculate average rating and number of ratings
  const totalRating = ratings.reduce((sum, { rating }) => sum + rating, 0);
  const averageRating = totalRating / ratings.length;

  // Update the product with new average rating and number of ratings
  await pool.query(
    "UPDATE products SET average_rating = $1, number_of_ratings = $2 WHERE id = $3",
    [averageRating, ratings.length, productId]
  );
};

const reviewExists = async (productId, userId) => {
  const result = await pool.query(
    "SELECT id FROM reviews WHERE product_id = $1 AND user_id = $2",
    [productId, userId]
  );
  return result.rows.length > 0;
};

const updateReview = async (productId, userId, rating, review) => {
  await pool.query(
    "UPDATE reviews SET rating = $1, review = $2 WHERE product_id = $3 AND user_id = $4",
    [rating, review, productId, userId]
  );
  // Update the product's rating information
  await updateProductRating(productId);
};

const addReview = async (product_id, user_id, rating, review) => {
  // Insert the new review
  await pool.query(
    "INSERT INTO reviews (product_id, user_id, rating, review) VALUES ($1, $2, $3, $4)",
    [product_id, user_id, rating, review]
  );

  // Update the product's rating information
  await updateProductRating(product_id);
};
const incrementProductTrending = async (productName) => {
  const name_to_id = await pool.query(
    "SELECT id FROM products WHERE product_name = $1",
    [productName]
  );

  if (name_to_id.rows.length === 0) {
    throw new Error("Product not found");
  }

  const productId = name_to_id.rows[0].id;

  const { rows } = await pool.query(
    "SELECT product_name, photos_of_product[1] AS photo FROM products WHERE id = $1",
    [productId]
  );

  if (rows.length === 0) {
    throw new Error("Product not found");
  }

  const { product_name, photo } = rows[0];

  // Check if the product is already in the trending table
  const { rows: trendingRows } = await pool.query(
    "SELECT * FROM trending WHERE product_id = $1",
    [productId]
  );

  if (trendingRows.length > 0) {
    // Product exists, update views_in_past_day
    await pool.query(
      "UPDATE trending SET views_in_past_day = views_in_past_day + 1 WHERE product_id = $1",
      [productId]
    );
  } else {
    // Product does not exist, insert new record
    await pool.query(
      "INSERT INTO trending (product_id,  views_in_past_day) VALUES ($1, 1)",
      [productId]
    );
  }

  // Ensure the table contains a maximum of 40 entities
  const { rowCount } = await pool.query("SELECT COUNT(*) FROM trending");
  if (parseInt(rowCount) > 40) {
    await pool.query(`
          DELETE FROM trending
          WHERE product_id IN (
              SELECT product_id
              FROM trending
              ORDER BY views_in_past_day ASC
              LIMIT (SELECT COUNT(*) - 40 FROM trending)
          )
      `);
  }
};

cron.schedule("0 0 * * *", async () => {
  try {
    await pool.query("UPDATE trending SET views_in_past_day = 1");
  } catch (error) {
    console.error("Error resetting trending views:", error);
  }
});

const incrementProductView = async (productId) => {
  await pool.query(
    "UPDATE products SET views = views + 1 WHERE product_name = $1",
    [productId]
  );
};

const getTrendingProducts = async () => {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT ON (p.product_sku)
             p.product_name, 
             p.product_price, 
             p.product_selling_price, 
             p.product_title, 
             p.id, 
             p.gender,
             p.available_discount, 
             p.product_availability,
             p.product_sku,
             p.photos_of_product[1] AS photo
      FROM trending t
      JOIN products p ON t.product_id = p.id
      WHERE p.product_availability = true
      ORDER BY p.product_sku, t.views_in_past_day DESC
    `);

    return rows;
  } catch (error) {
    console.error("Error fetching trending products:", error);
    throw new Error("Could not fetch trending products");
  }
};

const getNewArrivalProducts = async () => {
  try {
    const { rows } = await pool.query(`
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
             p.photos_of_product[1] AS photo
      FROM products p
      WHERE p.product_availability = true
      ORDER BY p.product_sku, p.updated_at DESC
    `);

    return rows;
  } catch (error) {
    console.error("Error fetching new arrival products:", error);
    throw new Error("Could not fetch new arrival products");
  }
};

const getSuggestions = async (searchQuery) => {
  try {
    const upperSearchQuery = `%${searchQuery.toUpperCase()}%`;
    const categories = await pool.query(
      `SELECT name, category_type 
       FROM suggestions_categories 
       WHERE UPPER(name) ILIKE $1
       LIMIT 3`,
      [upperSearchQuery]
    );

    const products = await pool.query(
      `SELECT id AS product_id, product_name, product_title, product_category
       FROM products 
       WHERE UPPER(product_title) ILIKE $1 
       OR UPPER(product_category) ILIKE $1
       LIMIT 4`,
      [upperSearchQuery]
    );

    return {
      categories: categories.rows,
      products: products.rows,
    };
  } catch (error) {
    console.error("Error fetching suggestions:", error);
    throw error;
  }
};

const getRelatedProducts = async (productStyles) => {
  const query = `
    SELECT
      id AS product_id,
      product_name,
      product_title,
      photos_of_product[1] AS first_photo,
      product_price,
      product_selling_price,
      available_discount,
      cardinality(array(SELECT UNNEST(product_style) INTERSECT SELECT UNNEST($1::text[]))) AS style_matches
    FROM
      products
    WHERE
      product_availability = true
      AND cardinality(array(SELECT UNNEST(product_style) INTERSECT SELECT UNNEST($1::text[]))) > 0
    ORDER BY
      style_matches DESC
    LIMIT 10
  `;

  try {
    const result = await pool.query(query, [productStyles]);

    const relatedProducts = result.rows.map((row) => ({
      id: row.product_id,
      product_name: row.product_name,
      product_title: row.product_title,
      first_photo: row.first_photo,
      product_price: row.product_price,
      product_selling_price: row.product_selling_price,
      available_discount: row.available_discount,
      style_matches: row.style_matches,
    }));

    return relatedProducts;
  } catch (error) {
    console.error("Error fetching related products", error);
    throw error;
  }
};

module.exports = {
  createProduct,
  getProductById,
  getProductByName,
  getAllProducts,
  updateProduct,
  deleteProduct,
  addReview,
  incrementProductView,
  reviewExists,
  updateReview,
  getSuggestions,
  incrementProductTrending,
  getTrendingProducts,
  getRelatedProducts,
  getNewArrivalProducts,
};
