const pool = require("../config/db");

// Get checkout details for a user before applying a coupon
const simpleCheckout = async (userId, giftWrap = false) => {
  try {
    // Query to get product details from the cart
    const result = await pool.query(
      `SELECT 
         p.id AS product_id,
         p.product_price AS mrp,
         p.available_discount AS product_discount,
         c.id AS cart_id,
         c.quantity,
         c.size,
         c.variant,
         (p.product_selling_price) * c.quantity AS final_price
       FROM cart c
       JOIN products p ON c.product_id = p.id
       WHERE c.user_id = $1`,
      [userId]
    );

    const checkoutDetails = result.rows;
    if (!checkoutDetails || checkoutDetails.length === 0) {
      throw new Error("No checkout details found for this user.");
    }

    let totalCouponDiscount = 0;
    let totalProductDiscount = 0;
    let grandTotal = 0;

    // Calculate the total product discount and grand total
    for (let item of checkoutDetails) {
      const productMRP = parseFloat(item.mrp);
      const productDiscount =
        (parseFloat(item.product_discount) / 100) * productMRP;
      const finalPrice = (productMRP - productDiscount) * item.quantity;

      item.final_price = finalPrice < 0 ? 0 : finalPrice;
      item.coupon_discount = 0; // No coupon applied yet

      totalProductDiscount += productDiscount * item.quantity;
      grandTotal += item.final_price;
    }

    // Calculate wrapping cost if giftWrap is true
    const wrappingCost = giftWrap ? calculateWrappingCost(checkoutDetails) : 0;

    return {
      checkoutDetails,
      totalCouponDiscount: parseFloat(totalCouponDiscount.toFixed(2)),
      totalProductDiscount: parseFloat(totalProductDiscount.toFixed(2)),
      wrappingCost,
      grandTotal: parseFloat((grandTotal + wrappingCost).toFixed(2)),
    };
  } catch (error) {
    console.error(
      "Error getting checkout details before coupon:",
      error.message
    );
    throw new Error(
      "Failed to retrieve checkout details. Please try again later."
    );
  }
};

const getCheckoutDetailsBeforeCoupon = async (userId) => {
  const result = await pool.query(
    `SELECT 
       p.id AS product_id,
       p.product_selling_price AS mrp,
       p.available_discount AS product_discount,
       c.id AS cart_id,
       c.quantity,
       c.size,
       c.variant,
       (p.product_selling_price) * c.quantity AS final_price
     FROM cart c
     JOIN products p ON c.product_id = p.id
     WHERE c.user_id = $1 AND c.is_available = true`,
    [userId]
  );
  return result.rows;
};

// Check if the user has an existing incomplete checkout
const getActiveCheckout = async (userId) => {
  try {
    // Fetch the most recent checkout for the user
    const result = await pool.query(
      `SELECT id 
       FROM checkout 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [userId]
    );

    // If no checkout found, return null
    if (result.rows.length === 0) {
      return null; // No active checkout
    }

    const checkoutId = result.rows[0].id;

    // Return the checkoutId as it represents the most recent, incomplete checkout
    return checkoutId;
  } catch (error) {
    console.error("Error fetching active checkout:", error.message);
    throw new Error(
      "Failed to retrieve active checkout. Please try again later."
    );
  }
};

// Apply coupon discount and update checkout details
const applyCouponCode = async (userId, code) => {
  try {
    // Check if the coupon code is valid and active
    const coupon = await checkCouponCode(code);
    if (!coupon || !coupon.is_active) {
      return {
        totalAmountBeforeDiscount: await getCartGrandTotal(userId),
        totalAmountAfterDiscount: await getCartGrandTotal(userId),
        couponDiscount: 0,
        message: "Coupon code is not valid or inactive",
      };
    }

    // Check if the coupon's usage limit has been exceeded
    if (coupon.usage_limit > 0 && coupon.times_used >= coupon.usage_limit) {
      await pool.query(
        "UPDATE coupon_codes SET is_active = FALSE WHERE code = $1",
        [code]
      );
      return {
        totalAmountBeforeDiscount: await getCartGrandTotal(userId),
        totalAmountAfterDiscount: await getCartGrandTotal(userId),
        couponDiscount: 0,
        message: "Coupon code usage limit exceeded",
      };
    }

    // Check if the user is eligible for the coupon
    const isEligible = await checkUserEligibility(userId, coupon.id);
    if (!isEligible) {
      return {
        totalAmountBeforeDiscount: await getCartGrandTotal(userId),
        totalAmountAfterDiscount: await getCartGrandTotal(userId),
        couponDiscount: 0,
        message: "User is not eligible for this coupon",
      };
    }

    // Calculate the total amount before applying the coupon
    const totalAmountBeforeDiscount = parseFloat(
      await getCartGrandTotal(userId)
    );

    // Calculate the coupon discount on the total amount
    const discountType = coupon.discount_type;
    const discountValue = parseFloat(coupon.discount_value);
    const maxDiscountValue = coupon.max_discount_value
      ? parseFloat(coupon.max_discount_value)
      : null;

    let totalCouponDiscount = 0;

    if (discountType === "PERCENTAGE") {
      totalCouponDiscount = (totalAmountBeforeDiscount * discountValue) / 100;
      if (maxDiscountValue && totalCouponDiscount > maxDiscountValue) {
        totalCouponDiscount = maxDiscountValue;
      }
    } else if (discountType === "FLAT") {
      totalCouponDiscount = discountValue;
    }

    totalCouponDiscount = parseFloat(totalCouponDiscount.toFixed(2));

    // Update the coupon usage
    await pool.query(
      "UPDATE coupon_codes SET times_used = times_used + 1 WHERE code = $1",
      [code]
    );

    // Calculate the total amount after applying the coupon
    const totalAmountAfterDiscount = Math.max(
      totalAmountBeforeDiscount - totalCouponDiscount,
      0
    );

    return {
      totalAmountBeforeDiscount,
      totalAmountAfterDiscount,
      couponDiscount: totalCouponDiscount,
      message: "Coupon applied successfully",
    };
  } catch (error) {
    console.error("Error applying coupon:", error.message);
    return {
      totalAmountBeforeDiscount: await getCartGrandTotal(userId),
      totalAmountAfterDiscount: await getCartGrandTotal(userId),
      couponDiscount: 0,
      message: "Failed to apply coupon. Please try again later.",
    };
  }
};

const createOrUpdateCheckout = async (
  userId,
  giftWrap,
  wrappingCost,
  grandTotal
) => {
  try {
    const activeCheckoutId = await getActiveCheckout(userId);

    if (activeCheckoutId) {
      await pool.query(
        `UPDATE checkout 
         SET gift_wrap = $1, 
             wrapping_cost = $2, 
             total_payment_amount = $3 
         WHERE id = $4`,
        [giftWrap, wrappingCost, grandTotal, activeCheckoutId]
      );
      return activeCheckoutId;
    } else {
      const result = await pool.query(
        `INSERT INTO checkout (user_id, gift_wrap, wrapping_cost, total_payment_amount) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id`,
        [userId, giftWrap, wrappingCost, grandTotal]
      );
      return result.rows[0].id;
    }
  } catch (error) {
    throw new Error("Failed to create or update checkout entry");
  }
};

// Add checkout details
const addCheckoutDetails = async (
  checkoutId,
  productId,
  mrp,
  productDiscount,
  couponDiscount,
  finalPrice,
  size
) => {
  try {
    await pool.query(
      `INSERT INTO checkout_details (checkout_id, product_id, mrp, product_discount, coupon_discount, final_price, product_size) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (checkout_id, product_id, product_size) DO UPDATE 
       SET mrp = EXCLUDED.mrp, 
           product_discount = EXCLUDED.product_discount, 
           coupon_discount = EXCLUDED.coupon_discount, 
           final_price = EXCLUDED.final_price`,
      [
        checkoutId,
        productId,
        mrp,
        productDiscount,
        couponDiscount,
        finalPrice,
        size,
      ]
    );
  } catch (error) {
    console.error(
      `Failed to add or update checkout details for product ID ${productId} in checkout ID ${checkoutId} and size ${size}:`,
      error.message
    );
    throw new Error(
      "Failed to add or update checkout details. Please try again later."
    );
  }
};

const getCouponIdByCode = async (couponCode) => {
  try {
    const result = await pool.query(
      `SELECT id FROM coupon_codes WHERE code = $1`,
      [couponCode]
    );

    if (result.rows.length === 0) {
      throw new Error("Coupon code is not valid.");
    }

    return result.rows[0].id;
  } catch (error) {
    console.error("Error retrieving coupon ID:", error.message);
    throw new Error("Failed to retrieve coupon ID. Please try again later.");
  }
};

// Helper function to update the total_payment_amount in the checkout table
const updateCheckoutTotalPaymentAmount = async (checkoutId, grandTotal) => {
  const query = `
    UPDATE checkout
    SET total_payment_amount = $1
    WHERE id = $2
  `;

  await pool.query(query, [grandTotal, checkoutId]);
};

const finalizeCheckout = async (userId, couponCode, giftWrap = false) => {
  try {
    const checkoutId = await createOrUpdateCheckout(
      userId,
      giftWrap,
      calculateWrappingCost(await getCheckoutDetailsBeforeCoupon(userId))
    );

    // Step 2: Get checkout details before applying a coupon
    const checkoutDetailsBefore = await getCheckoutDetailsBeforeCoupon(userId);

    if (!checkoutDetailsBefore || checkoutDetailsBefore.length === 0) {
      throw new Error("No checkout details found for this user.");
    }

    let checkoutDetailsAfter = [];
    let totalCouponDiscount = 0;
    let grandTotal = 0;
    let totalProductDiscount = 0;

    if (couponCode) {
      const couponId = await getCouponIdByCode(couponCode);
      const {
        checkoutDetailsAfter: couponCheckoutDetailsAfter,
        totalCouponDiscount: couponDiscount,
        totalProductDiscount: productDiscount,
        grandTotal: calculatedGrandTotal,
      } = await applyCouponDiscount(userId, couponId);

      checkoutDetailsAfter = couponCheckoutDetailsAfter;
      totalCouponDiscount = couponDiscount;
      totalProductDiscount = productDiscount;
      grandTotal = calculatedGrandTotal;

      // Update or add checkout details
      for (let item of checkoutDetailsAfter) {
        const {
          product_id,
          mrp,
          product_discount,
          coupon_discount,
          final_price,
          size,
        } = item;

        await addCheckoutDetails(
          checkoutId,
          product_id,
          mrp,
          product_discount,
          coupon_discount,
          final_price,
          size
        );
      }
    } else {
      // No coupon code, calculate the totals without coupon
      for (let item of checkoutDetailsBefore) {
        const productMRP = parseFloat(item.mrp);
        const productDiscount =
          (parseFloat(item.product_discount) / 100) * productMRP;
        const finalPrice = (productMRP - productDiscount) * item.quantity;

        item.final_price = finalPrice < 0 ? 0 : finalPrice;
        totalProductDiscount += productDiscount * item.quantity;
        grandTotal += item.final_price;

        // Update or add checkout details
        await addCheckoutDetails(
          checkoutId,
          item.product_id,
          item.mrp,
          item.product_discount,
          0,
          item.final_price,
          item.size
        );
      }
      checkoutDetailsAfter = checkoutDetailsBefore; // Set this to before details if no coupon
    }

    // Step 4: Update the grand total in the checkout table
    await updateCheckoutTotalPaymentAmount(checkoutId, grandTotal);

    return {
      checkoutDetails: checkoutDetailsAfter,
      totalCouponDiscount: parseFloat(totalCouponDiscount.toFixed(2)),
      totalProductDiscount: parseFloat(totalProductDiscount.toFixed(2)),
      grandTotal: parseFloat(grandTotal.toFixed(2)),
    };
  } catch (error) {
    console.error("Error finalizing checkout:", error.message);
    throw new Error("Failed to finalize checkout. Please try again later.");
  }
};

// Remove coupon discount and reset checkout details
const removeCouponDiscount = async (userId) => {
  try {
    const checkoutDetails = await getCheckoutDetailsBeforeCoupon(userId);
    if (!checkoutDetails || checkoutDetails.length === 0) {
      throw new Error("No checkout details found for this user.");
    }

    const activeCheckoutId = await getActiveCheckout(userId);

    let grandTotal = 0;
    for (let item of checkoutDetails) {
      const productMRP = parseFloat(item.mrp);
      const productDiscount =
        (parseFloat(item.product_discount) / 100) * productMRP;
      const finalPrice = productMRP - productDiscount;

      item.coupon_discount = 0;
      item.final_price = finalPrice * item.quantity;

      await pool.query(
        `UPDATE checkout_details 
         SET coupon_discount = 0, final_price = $1
         WHERE checkout_id = $2 AND product_id = $3`,
        [item.final_price, activeCheckoutId, item.product_id]
      );
    }

    return {
      checkoutDetails,
      grandTotal: parseFloat(grandTotal.toFixed(2)),
    };
  } catch (error) {
    console.error("Error removing coupon:", error.message);
    throw new Error("Failed to remove coupon. Please try again later.");
  }
};

// Calculate wrapping cost based on the number of items in the checkout
const calculateWrappingCost = (checkoutDetails) => {
  const wrappingCostPerItem = 25;
  return wrappingCostPerItem * checkoutDetails.length;
};

// Get checkout details after applying a coupon
const getCheckoutDetailsAfterCouponApplied = async (userId) => {
  try {
    // Get the active checkout ID for the user
    const activeCheckoutIdResult = await pool.query(
      `SELECT id FROM checkout WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (activeCheckoutIdResult.rows.length === 0) {
      throw new Error("No active checkout found for this user.");
    }

    const activeCheckoutId = activeCheckoutIdResult.rows[0].id;

    const result = await pool.query(
      `SELECT 
         p.id AS product_id,
         p.product_title,
         p.product_price as mrp,
         p.photos_of_product[1] AS product_photo, 
         p.available_discount AS product_discount,
         c.size,
         c.variant,
         c.quantity,
         cd.coupon_discount,
         cd.final_price
       FROM checkout_details cd
       JOIN products p ON cd.product_id = p.id
       JOIN cart c ON c.product_id = p.id 
       WHERE cd.checkout_id = $1
       AND c.user_id = $2`,
      [activeCheckoutId, userId]
    );

    const checkoutDetails = result.rows;
    if (!checkoutDetails || checkoutDetails.length === 0) {
      throw new Error("No checkout details found.");
    }

    // Calculate the totals
    let totalCouponDiscount = 0;
    let totalProductDiscount = 0;
    let grandTotal = 0;

    for (let item of checkoutDetails) {
      const productMRP = parseFloat(item.mrp);
      const productDiscount =
        (parseFloat(item.product_discount) / 100) * productMRP;
      totalProductDiscount += productDiscount * item.quantity;

      totalCouponDiscount += parseFloat(item.coupon_discount);
      grandTotal += parseFloat(item.final_price);
    }

    return {
      checkoutDetails,
      totalCouponDiscount: parseFloat(totalCouponDiscount.toFixed(2)),
      totalProductDiscount: parseFloat(totalProductDiscount.toFixed(2)),
      grandTotal: parseFloat(grandTotal.toFixed(2)),
    };
  } catch (error) {
    console.error(
      "Error getting checkout details after applying coupon:",
      error.message
    );
    throw new Error(
      "Failed to retrieve checkout details. Please try again later."
    );
  }
};

module.exports = {
  getCheckoutDetailsBeforeCoupon,
  createOrUpdateCheckout,
  addCheckoutDetails,
  finalizeCheckout,
  removeCouponDiscount,
  simpleCheckout,
  getCouponIdByCode,
  getCheckoutDetailsAfterCouponApplied,
};
