const pool = require("../config/db");

// Add or update featured categories
const addOrUpdateFeaturedCategories = async (categories) => {
  try {
    // Clear the table
    await pool.query("TRUNCATE TABLE featured_categories");

    // Prepare the values for insertion
    const insertValues = categories
      .map(
        (category, index) =>
          `($${index * 3 + 1}, $${index * 3 + 2}, $${index * 3 + 3})`
      )
      .join(", ");

    // Flatten the array of parameters
    const params = categories.flatMap((category) => [
      category.category_name,
      category.image_url,
      category.tags,
    ]);

    // Insert new categories with conflict resolution
    await pool.query(
      `INSERT INTO featured_categories (category_name, image_url, tags) 
       VALUES ${insertValues}
       ON CONFLICT (category_name) DO UPDATE 
       SET image_url = EXCLUDED.image_url, tags = EXCLUDED.tags`,
      params
    );
  } catch (error) {
    console.error("Error adding or updating featured categories:", error);
    throw error;
  }
};

// Add or update shop by occasion
const addOrUpdateShopByOccasion = async (occasions) => {
  await pool.query("TRUNCATE TABLE shop_by_occasion");

  const insertValues = occasions
    .map((occasion, index) => `($${index * 2 + 1}, $${index * 2 + 2})`)
    .join(", ");
  const updateValues = occasions
    .map(
      (occasion, index) =>
        `WHEN occasion_name = $${index * 2 + 1} THEN $${index * 2 + 2}`
    )
    .join(" ");

  const params = occasions.flatMap((occasion) => [
    occasion.occasion_name,
    occasion.image_url,
  ]);

  // Insert new occasions
  await pool.query(
    `INSERT INTO shop_by_occasion (occasion_name, image_url) VALUES ${insertValues}
     ON CONFLICT (occasion_name) DO UPDATE SET image_url = EXCLUDED.image_url`,
    params
  );
};

module.exports = { addOrUpdateFeaturedCategories, addOrUpdateShopByOccasion };
