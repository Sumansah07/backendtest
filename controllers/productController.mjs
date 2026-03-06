import { v2 as cloudinary } from "cloudinary";
import { deleteCloudinaryImage } from "../config/cloudinary.js";
import supabase from "../config/supabase.js";
import fs from "fs";

// Helper function to clean up temporary files
const cleanupTempFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log("Temporary file cleaned up:", filePath);
    }
  } catch (error) {
    console.error("Error cleaning up temporary file:", error);
  }
};

// Add product
// Add product
const addProduct = async (req, res) => {
  try {
    const {
      _type,
      name,
      price,
      discountedPercentage,
      stock,
      category,
      brand,
      badge,
      isAvailable,
      offer,
      description,
      tags,
    } = req.body;

    // Process images...
    const image1 = req.files.image1 && req.files.image1[0];
    const image2 = req.files.image2 && req.files.image2[0];
    const image3 = req.files.image3 && req.files.image3[0];
    const image4 = req.files.image4 && req.files.image4[0];

    // Check for required fields
    if (!name || !price || !category || !description) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: name, price, category, and description are mandatory.",
      });
    }

    // Collect only the images that exist
    const images = [image1, image2, image3, image4].filter(
      (item) => item !== undefined
    );

    let imagesUrl = await Promise.all(
      images.map(async (item) => {
        try {
          let result = await cloudinary.uploader.upload(item.path, {
            folder: "orebi/products",
            resource_type: "image",
            transformation: [
              { width: 800, height: 800, crop: "fill" },
              { quality: "auto", fetch_format: "auto" },
            ],
          });

          // Clean up temporary file after successful upload
          cleanupTempFile(item.path);

          return result.secure_url;
        } catch (error) {
          // Clean up temporary file even on error
          cleanupTempFile(item.path);
          throw error;
        }
      })
    );

    // Parse tags or split if necessary
    let parsedTags;
    try {
      parsedTags = JSON.parse(tags);
    } catch (err) {
      parsedTags = tags ? tags.split(",").map((tag) => tag.trim()) : [];
    }

    const productData = {
      _type: _type ? _type : "",
      name,
      price: Number(price),
      discounted_percentage: discountedPercentage
        ? Number(discountedPercentage)
        : 10,
      stock: stock ? Number(stock) : 0,
      sold_quantity: 0,
      category,
      brand: brand ? brand : "",
      badge: badge === "true" ? true : false,
      is_available: isAvailable === "true" ? true : false,
      offer: offer === "true" ? true : false,
      description,
      tags: tags ? parsedTags : [],
      images: imagesUrl,
    };

    const { data: product, error } = await supabase
      .from("products")
      .insert(productData)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: `${name} added and save to DB successfully`,
    });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// List products with filtering
// List products with filtering
const listProducts = async (req, res) => {
  try {
    const {
      _type,
      _id,
      _search,
      brand,
      category,
      offer,
      onSale,
      isAvailable,
      _page = 1,
      _perPage = 25,
    } = req.query;

    // Helper to format product for frontend
    const formatProduct = (p) => ({
      ...p,
      _id: p.id,
      discountedPercentage: p.discounted_percentage,
      soldQuantity: p.sold_quantity,
      isAvailable: p.is_available,
      image: p.images && p.images.length > 0 ? p.images[0] : "",
    });

    // Filter by specific ID
    if (_id) {
      const { data: dbProduct, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", _id)
        .single();

      if (dbProduct) {
        return res.json({ success: true, product: formatProduct(dbProduct) });
      } else {
        return res
          .status(404)
          .json({ success: false, message: "Product not found" });
      }
    }

    // Build query
    let query = supabase.from("products").select("*", { count: "exact" });

    // Filter by availability
    if (isAvailable !== "false") {
      query = query.eq("is_available", true);
    }

    // Filter by type
    if (_type) {
      query = query.eq("_type", _type);
    }

    // Filter by brand
    if (brand) {
      query = query.eq("brand", brand);
    }

    // Filter by category
    if (category) {
      query = query.eq("category", category);
    }

    // Filter by offer
    if (offer === "true") {
      query = query.eq("offer", true);
    }

    // Search by name, description, tags
    // Supabase search is limited, using ilike or textSearch
    if (_search) {
      // Manual OR condition for search
      query = query.or(`name.ilike.%${_search}%,description.ilike.%${_search}%`);
      // Note: Searching invalid tags array as text might not work well, skipping tags for simple ilike usually
    }

    // Sorting
    query = query.order("created_at", { ascending: false });

    // Pagination
    const page = parseInt(_page, 10) || 1;
    const perPage = parseInt(_perPage, 10) || 25;
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    query = query.range(from, to);

    const { data: dbProducts, count: total, error } = await query;

    if (error) throw error;

    // Format products
    const formattedDbProducts = dbProducts.map(formatProduct);

    // Return response
    res.json({
      success: true,
      products: formattedDbProducts,
      currentPage: page,
      perPage,
      totalItems: total,
      totalPages: Math.ceil(total / perPage),
      total: total, // backward compatibility
    });
  } catch (error) {
    console.log("List products error:", error);
    res.json({ success: false, message: error.message });
  }
};

// Remove product
// Remove product
const removeProduct = async (req, res) => {
  try {
    // First, find the product to get its images
    const { data: product } = await supabase
      .from("products")
      .select("*")
      .eq("id", req.body._id)
      .single();

    if (!product) {
      return res.json({ success: false, message: "Product not found" });
    }

    // Delete all product images from Cloudinary
    if (product.images && Array.isArray(product.images)) {
      for (const imageUrl of product.images) {
        try {
          const deleteResult = await deleteCloudinaryImage(imageUrl);
          if (deleteResult.success) {
            console.log("Product image deleted from Cloudinary successfully");
          } else {
            console.log(
              "Failed to delete product image:",
              deleteResult.message
            );
          }
        } catch (error) {
          console.log("Error deleting product image from Cloudinary:", error);
          // Continue with deletion even if some images fail
        }
      }
    }

    // Delete the product from database
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", req.body._id);

    if (error) throw error;

    res.json({ success: true, message: "Product removed successfully" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// Single product
// Single product
const singleProducts = async (req, res) => {
  try {
    const productId = req.body._id || req.query._id || req.params.id;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    const { data: product, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Check availability (Supabase column: is_available)
    if (!product.is_available && !req.user?.role === "admin") {
      return res.status(404).json({
        success: false,
        message: "Product not available",
      });
    }

    // Format for frontend
    const formattedProduct = {
      ...product,
      _id: product.id,
      discountedPercentage: product.discounted_percentage,
      soldQuantity: product.sold_quantity,
      isAvailable: product.is_available,
    };

    res.json({ success: true, product: formattedProduct });
  } catch (error) {
    console.log("Single product error:", error);
    res.json({ success: false, message: error.message });
  }
};

// Update stock after purchase
// Update stock after purchase
const updateStock = async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    if (!productId || !quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Product ID and valid quantity are required",
      });
    }

    const { data: product } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (product.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: "Insufficient stock available",
      });
    }

    // Update stock and sold quantity
    const newStock = product.stock - quantity;
    const newSoldQuantity = product.sold_quantity + quantity;
    const isAvailable = newStock > 0;

    const { data: updatedProduct, error } = await supabase
      .from("products")
      .update({
        stock: newStock,
        sold_quantity: newSoldQuantity, // snake_case
        is_available: isAvailable, // snake_case
      })
      .eq("id", productId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: "Stock updated successfully",
      product: {
        _id: updatedProduct.id,
        stock: updatedProduct.stock,
        soldQuantity: updatedProduct.sold_quantity,
        isAvailable: updatedProduct.is_available,
      },
    });
  } catch (error) {
    console.log("Update stock error:", error);
    res.json({ success: false, message: error.message });
  }
};

// Update product
// Update product
const updateProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const {
      _type,
      name,
      price,
      discountedPercentage,
      stock,
      category,
      brand,
      badge,
      isAvailable,
      offer,
      description,
      tags,
    } = req.body;

    const image1 = req.files?.image1 && req.files.image1[0];
    const image2 = req.files?.image2 && req.files.image2[0];
    const image3 = req.files?.image3 && req.files.image3[0];
    const image4 = req.files?.image4 && req.files.image4[0];

    // Find the existing product using Supabase
    const { data: existingProduct, error: findError } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Check for required fields
    if (!name || !price || !category || !description) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: name, price, category, and description are mandatory.",
      });
    }

    let imagesUrl = existingProduct.images; // Keep existing images by default

    // If new images are uploaded, upload them to cloudinary
    const newImages = [image1, image2, image3, image4].filter(
      (item) => item !== undefined
    );

    if (newImages.length > 0) {
      try {
        const uploadPromises = newImages.map(async (item, index) => {
          const result = await cloudinary.uploader.upload(item.path, {
            folder: "orebi/products",
            resource_type: "image",
            transformation: [
              { width: 800, height: 800, crop: "fill" },
              { quality: "auto", fetch_format: "auto" },
            ],
          });

          // Clean up temporary file after successful upload
          cleanupTempFile(item.path);

          return { index, url: result.secure_url };
        });

        const uploadResults = await Promise.all(uploadPromises);

        // Update only the new image positions
        uploadResults.forEach(({ index, url }) => {
          if (index < imagesUrl.length) {
            imagesUrl[index] = url;
          } else {
            imagesUrl.push(url);
          }
        });
      } catch (error) {
        console.error("Error uploading images:", error);
        // Clean up temp files on error
        newImages.forEach((item) => cleanupTempFile(item.path));
        return res.status(500).json({
          success: false,
          message: "Error uploading images",
        });
      }
    }

    // Parse tags
    let parsedTags;
    try {
      parsedTags = JSON.parse(tags);
    } catch (err) {
      parsedTags = tags ? tags.split(",").map((tag) => tag.trim()) : [];
    }

    const updateData = {
      _type: _type || "",
      name,
      price: Number(price),
      discounted_percentage: discountedPercentage
        ? Number(discountedPercentage)
        : 10,
      stock: stock ? Number(stock) : 0,
      category,
      brand: brand || "",
      badge: badge === "true" ? true : false,
      is_available: isAvailable === "true" ? true : false,
      offer: offer === "true" ? true : false,
      description,
      tags: parsedTags,
      images: imagesUrl,
    };

    const { data: updatedProduct, error: updateError } = await supabase
      .from("products")
      .update(updateData)
      .eq("id", productId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Format for response compatible with frontend
    const formattedUpdatedProduct = {
      ...updatedProduct,
      _id: updatedProduct.id,
      discountedPercentage: updatedProduct.discounted_percentage,
      soldQuantity: updatedProduct.sold_quantity,
      isAvailable: updatedProduct.is_available,
    };

    res.json({
      success: true,
      message: `${name} updated successfully`,
      product: formattedUpdatedProduct,
    });
  } catch (error) {
    console.log("Update product error:", error);
    res.json({ success: false, message: error.message });
  }
};

export {
  addProduct,
  listProducts,
  removeProduct,
  singleProducts,
  updateStock,
  updateProduct,
};
