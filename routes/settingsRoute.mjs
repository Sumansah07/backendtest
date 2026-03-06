import express from "express";
import {
    getSettings,
    updateSetting,
    uploadBannerVideo,
} from "../controllers/settingsController.mjs";
import adminAuth from "../middleware/adminAuth.js";
import upload from "../middleware/multer.mjs";
import uploadVideo from "../middleware/multerVideo.mjs";

const settingsRouter = express.Router();

const routeValue = "/api/settings/";

settingsRouter.get(`${routeValue}get`, getSettings);
settingsRouter.post(`${routeValue}update`, adminAuth, upload.single("image"), updateSetting);
settingsRouter.post(`${routeValue}upload-banner-video`, adminAuth, uploadVideo.single("video"), uploadBannerVideo);

export default settingsRouter;
