/**
 * setup-storage.mjs
 * ------------------
 * Automatically creates all required Supabase Storage buckets for this project.
 * Run once before first deploy or whenever buckets need to be provisioned.
 *
 * Usage:
 *   npm run setup-storage
 *   -- or --
 *   node scripts/setup-storage.mjs
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from server root
dotenv.config({ path: path.join(__dirname, "../.env") });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌  Missing SUPABASE_URL or SUPABASE_KEY in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ──────────────────────────────────────────────
// Define all buckets this project needs
// ──────────────────────────────────────────────
const BUCKETS = [
    {
        name: "banner-videos",
        public: true,
        description: "Hero banner section video files (≤50 MB)",
        allowedMimeTypes: ["video/mp4", "video/webm", "video/ogg", "video/quicktime", "video/*"],
        fileSizeLimit: 50 * 1024 * 1024, // 50 MB
    },
    {
        name: "banners",
        public: true,
        description: "Hero banner section images",
        allowedMimeTypes: ["image/*"],
        fileSizeLimit: 10 * 1024 * 1024, // 10 MB
    },
    {
        name: "branding",
        public: true,
        description: "Logo, favicon and other branding assets",
        allowedMimeTypes: ["image/*"],
        fileSizeLimit: 5 * 1024 * 1024, // 5 MB
    },
];

// ──────────────────────────────────────────────
// Helper: create or skip a bucket
// ──────────────────────────────────────────────
async function ensureBucket(bucket, existingNames) {
    if (existingNames.includes(bucket.name)) {
        console.log(`  ⏭   Bucket "${bucket.name}" already exists — skipping`);
        return;
    }

    const { error } = await supabase.storage.createBucket(bucket.name, {
        public: bucket.public,
        allowedMimeTypes: bucket.allowedMimeTypes,
        fileSizeLimit: bucket.fileSizeLimit,
    });

    if (error) {
        // Code 23505 = duplicate (race condition) – treat as success
        if (error.message?.includes("already exists") || error.statusCode === "23505") {
            console.log(`  ⏭   Bucket "${bucket.name}" already exists — skipping`);
        } else {
            console.error(`  ❌  Failed to create bucket "${bucket.name}":`, error.message);
        }
    } else {
        console.log(`  ✅  Created bucket "${bucket.name}" (public: ${bucket.public})`);
    }
}

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────
async function setupStorage() {
    console.log("\n🚀  Supabase Storage Setup\n");
    console.log(`    Project URL : ${supabaseUrl}`);
    console.log(`    Buckets     : ${BUCKETS.map((b) => b.name).join(", ")}\n`);

    // Fetch existing buckets once
    const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
        console.error("❌  Could not list existing buckets:", listError.message);
        console.error("    Make sure your SUPABASE_KEY has Storage Admin permissions (service_role key).");
        process.exit(1);
    }

    const existingNames = (existingBuckets || []).map((b) => b.name);

    for (const bucket of BUCKETS) {
        await ensureBucket(bucket, existingNames);
    }

    console.log("\n✔   Storage setup complete!\n");
    console.log("    Next steps, if running for the first time:");
    console.log("    1. Go to Supabase Dashboard → Storage → Each bucket → Policies");
    console.log("    2. Allow public read access for all three buckets (or they're auto-public)");
    console.log("    3. The server will handle authenticated writes via the service_role key.\n");
}

setupStorage().catch((err) => {
    console.error("Unexpected error:", err);
    process.exit(1);
});
