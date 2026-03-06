import multer from "multer";
import path from "path";
import fs from "fs";

// Ensure temp directory exists
const tempDir = "./public/temp/";
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
  console.log("✅ Created temp directory for avatar uploads");
}

// Configure multer for avatar uploads (storing temporarily for Cloudinary upload)
const avatarStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tempDir); // Temporary storage before Cloudinary upload
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, "temp-avatar-" + uniqueSuffix + ext);
  },
});

// File filter for images only
const imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

const avatarUpload = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: imageFilter,
});

export { avatarUpload };
