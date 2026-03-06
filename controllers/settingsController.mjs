import supabase from "../config/supabase.js";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import path from "path";

// Helper function to clean up temporary files
const cleanupTempFile = (filePath) => {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (error) {
        console.error("Error cleaning up temporary file:", error);
    }
};

// Get all settings or specific setting by key
const getSettings = async (req, res) => {
    try {
        const { key } = req.query;
        let query = supabase.from("settings").select("*");

        if (key) {
            query = query.eq("key", key).single();
        }

        const { data, error } = await query;

        if (error && error.code !== "PGRST116") {
            // PGRST116 is 'no rows found' for single()
            throw error;
        }

        res.json({ success: true, settings: data });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

// Update or create setting
const updateSetting = async (req, res) => {
    try {
        let { key, value } = req.body;

        if (!key || value === undefined) {
            return res.status(400).json({
                success: false,
                message: "Key and value are required",
            });
        }

        // Try to parse value if it's a string (from FormData)
        let parsedValue = value;
        if (typeof value === "string") {
            try {
                parsedValue = JSON.parse(value);
            } catch (e) {
                // Keep as string if not JSON
            }
        }

        // Handle image uploads if present
        if (req.file) {
            try {
                let folder = "orebi/branding";
                if (key === "banner_settings") {
                    folder = "orebi/banners";
                }

                const result = await cloudinary.uploader.upload(req.file.path, {
                    folder: folder,
                    resource_type: "image",
                });
                cleanupTempFile(req.file.path);

                // Update the imageUrl in the value object or array
                if (key === "logo_settings" && typeof parsedValue === "object") {
                    parsedValue.imageUrl = result.secure_url;
                } else if (key === "product_of_the_year" && typeof parsedValue === "object") {
                    parsedValue.image = result.secure_url;
                } else if (key === "site_settings" && typeof parsedValue === "object") {
                    parsedValue.faviconUrl = result.secure_url;
                } else if (key === "banner_settings") {
                    // For banners, we might be adding a new one or updating an existing one
                    // This logic depends on how the frontend sends it. 
                    // Let's assume the frontend sends the list and we just append/update the URL for the new/updated item.
                    // If parsedValue is the target object, update its image.
                    if (typeof parsedValue === "object" && !Array.isArray(parsedValue)) {
                        parsedValue.image = result.secure_url;
                    }
                }
            } catch (uploadError) {
                cleanupTempFile(req.file.path);
                throw uploadError;
            }
        }

        const { data, error } = await supabase
            .from("settings")
            .upsert({ key, value: parsedValue, updated_at: new Date() }, { onConflict: "key" })
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            message: "Setting updated successfully",
            setting: data,
        });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

// Upload banner video to Supabase Storage bucket
const uploadBannerVideo = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: "No video file provided" });
    }

    const filePath = req.file.path;

    try {
        const BUCKET = "banner-videos";

        // Ensure the bucket exists (idempotent — won't error if already exists)
        const { data: buckets } = await supabase.storage.listBuckets();
        const bucketExists = buckets && buckets.some((b) => b.name === BUCKET);
        if (!bucketExists) {
            await supabase.storage.createBucket(BUCKET, { public: true });
        }

        const ext = path.extname(req.file.originalname) || ".mp4";
        const fileName = `banner_${Date.now()}${ext}`;
        const fileBuffer = fs.readFileSync(filePath);

        const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(fileName, fileBuffer, {
                contentType: req.file.mimetype,
                upsert: false,
            });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
            .from(BUCKET)
            .getPublicUrl(fileName);

        cleanupTempFile(filePath);

        return res.json({
            success: true,
            videoUrl: publicUrlData.publicUrl,
            message: "Video uploaded successfully",
        });
    } catch (error) {
        cleanupTempFile(filePath);
        console.error("Video upload error:", error);
        return res.json({ success: false, message: error.message });
    }
};

export { getSettings, updateSetting, uploadBannerVideo };
