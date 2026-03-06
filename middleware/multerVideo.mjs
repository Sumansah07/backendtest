import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ensureTempDir = () => {
    const tempDir = path.join(__dirname, "../public/temp/");
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    return tempDir;
};

const storage = multer.diskStorage({
    destination: function (req, file, callback) {
        try {
            const tempDir = ensureTempDir();
            callback(null, tempDir);
        } catch (error) {
            callback(error, null);
        }
    },
    filename: function (req, file, callback) {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const extension = path.extname(file.originalname);
        const nameWithoutExt = path.basename(file.originalname, extension);
        callback(null, uniqueSuffix + "-" + nameWithoutExt + extension);
    },
});

const uploadVideo = multer({
    storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
    },
    fileFilter: (req, file, callback) => {
        if (file.mimetype.startsWith("video/")) {
            callback(null, true);
        } else {
            callback(new Error("Only video files are allowed"), false);
        }
    },
});

export default uploadVideo;
