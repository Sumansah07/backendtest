import supabase from "./config/supabase.js";
import "dotenv/config";

const checkDatabase = async () => {
  try {
    console.log("✅ Connecting to Supabase...");

    // Check products
    const { count: productCount, data: products } = await supabase
      .from("products")
      .select("name, price, stock, category_id, is_active", { count: "exact" })
      .limit(10);

    console.log(`\n📦 Products in database: ${productCount}`);

    if (products && products.length > 0) {
      console.log("\nSample products:");
      products.forEach((p, index) => {
        console.log(
          `${index + 1}. ${p.name} - $${p.price} (Stock: ${p.stock})`
        );
      });
      if (productCount > 10) {
        console.log(`... and ${productCount - 10} more products`);
      }
    } else {
      console.log("No products found in database");
    }

    // Check users
    const { count: userCount, data: users } = await supabase
      .from("users")
      .select("role", { count: "exact" });

    console.log(`\n👥 Users in database: ${userCount}`);

    if (users) {
      const adminUsers = users.filter((u) => u.role === "admin");
      const regularUsers = users.filter((u) => u.role === "user");
      console.log(`   - Admin users: ${adminUsers.length}`);
      console.log(`   - Regular users: ${regularUsers.length}`);
    }

    // Check orders
    const { count: orderCount } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true });

    console.log(`\n🛍️  Orders in database: ${orderCount || 0}`);

    console.log("\n🎯 Database check completed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

checkDatabase();
