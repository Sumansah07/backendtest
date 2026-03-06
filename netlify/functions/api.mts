import express, { Router } from "express";
import serverless from "serverless-http";
import cors from "cors";

const app = express();

const allowedOrigins = [
  process.env.ADMIN_URL,
  process.env.CLIENT_URL,
  "http://localhost:5174",
  "http://localhost:5173",
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

// Import routes dynamically
const loadRoutes = async () => {
  const routes = [
    'brandRoute.mjs',
    'categoryRoute.mjs',
    'checkout.mjs',
    'contactRoute.js',
    'dashboardRoute.mjs',
    'orderRoute.mjs',
    'paymentRoute.js',
    'productRoute.mjs',
    'settingsRoute.mjs',
    'userRoute.mjs'
  ];

  for (const routeFile of routes) {
    try {
      const routeModule = await import(`../../routes/${routeFile}`);
      app.use("/", routeModule.default);
    } catch (error) {
      console.error(`Failed to load route ${routeFile}:`, error);
    }
  }
};

// Initialize routes
await loadRoutes();

// Initialize Cloudinary
try {
  const cloudinary = await import("../../config/cloudinary.js");
  cloudinary.default();
} catch (error) {
  console.error("Cloudinary initialization failed:", error);
}

app.get("/", (req, res) => {
  res.json({ message: "API is running", timestamp: new Date().toISOString() });
});

export const handler = serverless(app);
