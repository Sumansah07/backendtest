import express from "express";
const app = express();
import "dotenv/config";
import cors from "cors";
import { fileURLToPath } from "url";
import path from "path";
import { readdirSync } from "fs";
import connectCloudinary from "./config/cloudinary.js";

const port = process.env.PORT || 8000;

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

// Load routes
const routesPath = path.resolve(__dirname, "./routes");
const routeFiles = readdirSync(routesPath);

console.log("Loading routes:", routeFiles);

for (const file of routeFiles) {
  try {
    const routeModule = await import(`./routes/${file}`);
    if (routeModule.default) {
      app.use("/", routeModule.default);
      console.log(`✓ Loaded route: ${file}`);
    } else {
      console.error(`✗ No default export in ${file}`);
    }
  } catch (error) {
    console.error(`✗ Error loading route ${file}:`, error.message);
  }
}

console.log("All routes loaded successfully");

app.get("/", (req, res) => {
  res.json({ 
    message: "API is running", 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV 
  });
});

// For local development
if (process.env.NODE_ENV !== "production") {
  app.listen(port, () => {
    console.log(`Server is running on ${port}`);
  });
}

// Export for Vercel serverless
export default app;
