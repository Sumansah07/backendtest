import express from "express";
import serverless from "serverless-http";
import cors from "cors";
import { fileURLToPath } from "url";
import path from "path";
import { readdirSync } from "fs";
import connectCloudinary from "../../config/cloudinary.js";

const app = express();

const allowedOrigins = [
  process.env.ADMIN_URL,
  process.env.CLIENT_URL,
  "http://localhost:5174",
  "http://localhost:5173",
  "http://localhost:8081",
  "http://10.0.2.2:8081",
  "http://10.0.2.2:8000",
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (process.env.NODE_ENV === "development") {
        return callback(null, true);
      }
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "token", "adminauth"],
  })
);

app.use(express.json());

connectCloudinary();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const routesPath = path.resolve(__dirname, "../../routes");
const routeFiles = readdirSync(routesPath);

for (const file of routeFiles) {
  const routeModule = await import(`../../routes/${file}`);
  app.use("/", routeModule.default);
}

app.get("/", (req, res) => {
  res.json({ message: "API is running" });
});

export const handler = serverless(app);
