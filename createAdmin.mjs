import supabase from "./config/supabase.js";
import bcrypt from "bcrypt";
import "dotenv/config";

const createInitialAdmin = async () => {
  try {
    console.log("Checking for admin user...");

    // Check if admin already exists
    // Note: single() returns error if no rows found, so we handle that.
    const { data: existingAdmin, error: findError } = await supabase
      .from("users")
      .select("email")
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();

    if (existingAdmin) {
      console.log("✅ Admin user already exists:", existingAdmin.email);
      process.exit(0);
    }

    if (findError) {
      console.error("Error checking admin:", findError);
    }

    // Create admin user
    const adminEmail = process.env.ADMIN_EMAIL || "admin@elaricai.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123456";
    const adminName = process.env.ADMIN_NAME || "Admin User";

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    const { data: adminUser, error: insertError } = await supabase
      .from("users")
      .insert({
        name: adminName,
        email: adminEmail,
        password: hashedPassword,
        role: "admin",
        is_active: true,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    console.log("✅ Initial admin user created successfully!");
    console.log("Email:", adminEmail);
    console.log("Password:", adminPassword);
    console.log("⚠️  Please change the default password after first login");
  } catch (error) {
    console.error("Error creating admin user:", error);
  } finally {
    process.exit(0);
  }
};

createInitialAdmin();
