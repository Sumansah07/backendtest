import supabase from "../config/supabase.js";
import { cloudinary, deleteCloudinaryImage } from "../config/cloudinary.js";
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

// Create brand
// Create brand
const createBrand = async (req, res) => {
  try {
    const { name, description, website } = req.body;

    // Check if brand already exists
    const { data: existingBrand } = await supabase
      .from("brands")
      .select("id")
      .ilike("name", name)
      .single();

    if (existingBrand) {
      return res.status(400).json({
        success: false,
        message: "Brand already exists",
      });
    }

    let imageUrl = "";

    // Upload image to cloudinary if provided
    if (req.file) {
      try {
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          folder: "orebi/brands",
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
    } else {
      return res.status(400).json({
        success: false,
        message: "Brand image is required",
      });
    }

    const { data: newBrand, error } = await supabase
      .from("brands")
      .insert({
        name,
        image: imageUrl,
        description: description || "",
        website: website || "",
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;

    const formattedBrand = {
      ...newBrand,
      _id: newBrand.id,
      isActive: newBrand.is_active,
    };

    res.json({
      success: true,
      message: "Brand created successfully",
      brand: formattedBrand,
    });
  } catch (error) {
    console.error("Create brand error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Get all brands
// Get all brands
const getBrands = async (req, res) => {
  try {
    const { data: brands, error } = await supabase
      .from("brands")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const formattedBrands = brands.map(b => ({
      ...b,
      _id: b.id,
      isActive: b.is_active,
    }));

    res.json({
      success: true,
      brands: formattedBrands,
    });
  } catch (error) {
    console.error("Get brands error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Get single brand
// Get single brand
const getBrand = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: brand, error } = await supabase
      .from("brands")
      .select("*")
      .eq("id", id)
      .single();

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found",
      });
    }

    const formattedBrand = {
      ...brand,
      _id: brand.id,
      isActive: brand.is_active,
    };

    res.json({
      success: true,
      brand: formattedBrand,
    });
  } catch (error) {
    console.error("Get brand error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Update brand
// Update brand
const updateBrand = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, website, isActive } = req.body;

    const { data: brand } = await supabase
      .from("brands")
      .select("*")
      .eq("id", id)
      .single();

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found",
      });
    }

    // Check if name is being changed and if new name already exists
    if (name && name !== brand.name) {
      const { data: existingBrand } = await supabase
        .from("brands")
        .select("id")
        .ilike("name", name)
        .neq("id", id)
        .single();

      if (existingBrand) {
        return res.status(400).json({
          success: false,
          message: "Brand name already exists",
        });
      }
    }

    let imageUrl = brand.image;

    // Upload new image if provided
    if (req.file) {
      try {
        // Delete old image from Cloudinary if exists
        if (brand.image) {
          const deleteResult = await deleteCloudinaryImage(brand.image);
          if (deleteResult.success) {
            console.log("Old brand image deleted from Cloudinary successfully");
          } else {
            console.log(
              "Failed to delete old brand image:",
              deleteResult.message
            );
          }
        }

        // Upload new image
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          folder: "orebi/brands",
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
    if (website !== undefined) updates.website = website;
    if (isActive !== undefined) updates.is_active = isActive;

    const { data: updatedBrand, error } = await supabase
      .from("brands")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // Format response
    const formattedBrand = {
      ...updatedBrand,
      _id: updatedBrand.id,
      isActive: updatedBrand.is_active,
    };

    res.json({
      success: true,
      message: "Brand updated successfully",
      brand: formattedBrand,
    });
  } catch (error) {
    console.error("Update brand error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Delete brand (soft delete)
// Delete brand (soft delete)
const deleteBrand = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: brand } = await supabase
      .from("brands")
      .select("id")
      .eq("id", id)
      .single();

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found",
      });
    }

    const { error } = await supabase
      .from("brands")
      .update({ is_active: false })
      .eq("id", id);

    if (error) throw error;

    res.json({
      success: true,
      message: "Brand deleted successfully",
    });
  } catch (error) {
    console.error("Delete brand error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export { createBrand, getBrands, getBrand, updateBrand, deleteBrand };
