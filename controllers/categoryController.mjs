import supabase from "../config/supabase.js";
import { cloudinary, deleteCloudinaryImage } from "../config/cloudinary.js";
import fs from "fs";

// Helper function to clean up temporary files
const cleanupTempFile = (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log("Temporary file cleaned up:", filePath);
    }
  } catch (error) {
    console.error("Error cleaning up temporary file:", error);
  }
};

// Create category
const createCategory = async (req, res) => {
  try {
    const { name, description, showOnNav } = req.body;

    // Check if category already exists
    const { data: existingCategory } = await supabase
      .from("categories")
      .select("id")
      .ilike("name", name)
      .single();

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: "Category already exists",
      });
    }

    let imageUrl = "";

    // Upload image to cloudinary if provided
    if (req.file) {
      try {
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          folder: "orebi/categories",
          resource_type: "image",
          transformation: [
            { width: 400, height: 400, crop: "fill" },
            { quality: "auto", fetch_format: "auto" },
          ],
        });
        imageUrl = uploadResult.secure_url;

        // Clean up temporary file
        cleanupTempFile(req.file.path);
      } catch (uploadError) {
        // Clean up temporary file on error
        if (req.file?.path) {
          cleanupTempFile(req.file.path);
        }

        return res.status(400).json({
          success: false,
          message: "Failed to upload image",
        });
      }
    }

    // Insert new category
    const { data: newCategory, error } = await supabase
      .from("categories")
      .insert({
        name,
        image: imageUrl,
        description: description || "",
        is_active: true,
        show_on_nav: showOnNav === "true" || showOnNav === true,
      })
      .select()
      .single();

    if (error) throw error;

    // Format for frontend
    const formattedCategory = {
      ...newCategory,
      _id: newCategory.id,
      isActive: newCategory.is_active,
      showOnNav: newCategory.show_on_nav,
    };

    res.json({
      success: true,
      message: "Category created successfully",
      category: formattedCategory,
    });
  } catch (error) {
    console.error("Create category error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Get all categories
const getCategories = async (req, res) => {
  try {
    const { data: categories, error } = await supabase
      .from("categories")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const formattedCategories = categories.map((c) => ({
      ...c,
      _id: c.id,
      isActive: c.is_active,
      showOnNav: c.show_on_nav,
    }));

    res.json({
      success: true,
      categories: formattedCategories,
    });
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Get single category
const getCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: category, error } = await supabase
      .from("categories")
      .select("*")
      .eq("id", id)
      .single();

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const formattedCategory = {
      ...category,
      _id: category.id,
      isActive: category.is_active,
      showOnNav: category.show_on_nav,
    };

    res.json({
      success: true,
      category: formattedCategory,
    });
  } catch (error) {
    console.error("Get category error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Update category
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, isActive, showOnNav } = req.body;

    const { data: category } = await supabase
      .from("categories")
      .select("*")
      .eq("id", id)
      .single();

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Check if name is being changed and if new name already exists
    if (name && name !== category.name) {
      const { data: existingCategory } = await supabase
        .from("categories")
        .select("id")
        .ilike("name", name)
        .neq("id", id)
        .single();

      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: "Category name already exists",
        });
      }
    }

    let imageUrl = category.image;

    // Upload new image if provided
    if (req.file) {
      try {
        // Delete old image from Cloudinary if exists
        if (category.image) {
          const deleteResult = await deleteCloudinaryImage(category.image);
          if (deleteResult.success) {
            console.log(
              "Old category image deleted from Cloudinary successfully"
            );
          } else {
            console.log(
              "Failed to delete old category image:",
              deleteResult.message
            );
          }
        }

        // Upload new image
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          folder: "orebi/categories",
          resource_type: "image",
          transformation: [
            { width: 400, height: 400, crop: "fill" },
            { quality: "auto", fetch_format: "auto" },
          ],
        });
        imageUrl = uploadResult.secure_url;

        // Clean up temporary file
        cleanupTempFile(req.file.path);
      } catch (uploadError) {
        // Clean up temporary file on error
        if (req.file?.path) {
          cleanupTempFile(req.file.path);
        }

        return res.status(400).json({
          success: false,
          message: "Failed to upload image",
        });
      }
    }

    const updates = {
      image: imageUrl,
    };
    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (isActive !== undefined) updates.is_active = isActive;
    if (showOnNav !== undefined) {
      updates.show_on_nav = showOnNav === "true" || showOnNav === true;
    }

    const { data: updatedCategory, error } = await supabase
      .from("categories")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // Format response
    const formattedCategory = {
      ...updatedCategory,
      _id: updatedCategory.id,
      isActive: updatedCategory.is_active,
      showOnNav: updatedCategory.show_on_nav,
    };

    res.json({
      success: true,
      message: "Category updated successfully",
      category: formattedCategory,
    });
  } catch (error) {
    console.error("Update category error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Delete category (soft delete)
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: category } = await supabase
      .from("categories")
      .select("id")
      .eq("id", id)
      .single();

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const { error } = await supabase
      .from("categories")
      .update({ is_active: false })
      .eq("id", id);

    if (error) throw error;

    res.json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Delete category error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Delete multiple categories
const bulkDeleteCategories = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No category IDs provided",
      });
    }

    const { error } = await supabase
      .from("categories")
      .update({ is_active: false })
      .in("id", ids);

    if (error) throw error;

    res.json({
      success: true,
      message: `${ids.length} categories deleted successfully`,
    });
  } catch (error) {
    console.error("Bulk delete categories error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export {
  createCategory,
  getCategories,
  getCategory,
  updateCategory,
  deleteCategory,
  bulkDeleteCategories,
};
