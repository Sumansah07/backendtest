import supabase from "./config/supabase.js";
import "dotenv/config";
import bcrypt from "bcrypt";

console.log("✅ All dependencies loaded\n");

// Clear existing data
const clearData = async () => {
  try {
    console.log("🗑️ Clearing existing data...");

    // Delete in order to avoid foreign key constraints if possible, 
    // or rely on cascade if configured (not guaranteed here so we delete children first)
    // Using nil UUID because '0' is not valid for UUID type
    const nilUuid = "00000000-0000-0000-0000-000000000000";

    const { error: error1 } = await supabase.from("orders").delete().neq("id", nilUuid);
    if (error1) console.error("Error clearing orders:", error1);

    const { error: error2 } = await supabase.from("contacts").delete().neq("id", nilUuid);
    if (error2) console.error("Error clearing contacts:", error2);

    const { error: error3 } = await supabase.from("products").delete().neq("id", nilUuid);
    if (error3) console.error("Error clearing products:", error3);

    const { error: error4 } = await supabase.from("categories").delete().neq("id", nilUuid);
    if (error4) console.error("Error clearing categories:", error4);

    const { error: error5 } = await supabase.from("brands").delete().neq("id", nilUuid);
    if (error5) console.error("Error clearing brands:", error5);

    const { error: error6 } = await supabase.from("users").delete().neq("id", nilUuid);
    if (error6) console.error("Error clearing users:", error6);

    console.log("✅ Cleared existing data");
  } catch (error) {
    console.error("Error clearing data:", error);
  }
};

const createAdminFromEnv = async () => {
  console.log("\n🔐 Optional: Create Admin from .env");
  console.log("==============================");

  const adminName = process.env.ADMIN_NAME || "Admin";
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.log("⏭️ Skipping - Set ADMIN_EMAIL and ADMIN_PASSWORD in server/.env");
    return;
  }

  if (adminPassword.length < 8) {
    console.log("❌ ADMIN_PASSWORD too short (min 8 chars)");
    return;
  }

  try {
    const trimmedEmail = adminEmail.trim().toLowerCase();

    const { data: existingUser } = await supabase
      .from("users")
      .select("email")
      .eq("email", trimmedEmail)
      .single();

    if (existingUser) {
      console.log(`✅ Admin exists: ${trimmedEmail}`);
      console.log("💡 Login: http://localhost:5174");
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    const { data: newAdmin, error } = await supabase
      .from("users")
      .insert({
        name: adminName.trim(),
        email: trimmedEmail,
        password: hashedPassword,
        role: "admin",
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ Admin created: ${newAdmin.email}`);
    console.log("💡 Login: http://localhost:5174");
    console.log(`📝 Email: ${adminEmail}`);
    console.log(`📝 Password: ${adminPassword}`);
    console.log("⚠️ Change after first login!");
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
};

// Seed Categories
const seedCategories = async () => {
  const categories = [
    {
      name: "Electronics",
      image: "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=800&h=600&fit=crop",
      description: "Latest smartphones, laptops, tablets, and electronic gadgets",
      is_active: true,
    },
    {
      name: "Fashion",
      image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&h=600&fit=crop",
      description: "Trendy clothing, shoes, accessories, and fashion essentials",
      is_active: true,
    },
    {
      name: "Home & Kitchen",
      image: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=800&h=600&fit=crop",
      description: "Furniture, kitchen appliances, home decor, and household items",
      is_active: true,
    },
    {
      name: "Sports & Outdoors",
      image: "https://plus.unsplash.com/premium_vector-1718167295743-db54a78e8c63?w=800&h=600&fit=crop",
      description: "Sports equipment, fitness gear, outdoor activities, and adventure",
      is_active: true,
    },
  ];

  try {
    const { data: insertedCategories, error } = await supabase
      .from("categories")
      .insert(categories)
      .select();

    if (error) throw error;

    console.log(`✅ Inserted ${insertedCategories.length} categories`);
    return insertedCategories;
  } catch (error) {
    console.error("Error seeding categories:", error);
    throw error;
  }
};

// Seed Brands
const seedBrands = async () => {
  const brands = [
    {
      name: "Samsung",
      image: "https://images.unsplash.com/photo-1597762470488-3877b1f538c6?w=400&h=300&fit=crop",
      description: "Innovative electronics and smartphones",
      website: "https://www.samsung.com",
      is_active: true,
    },
    {
      name: "Apple",
      image: "https://images.unsplash.com/vector-1739890611115-d3d9dc8c3269?w=400&h=300&fit=crop",
      description: "Premium technology products and devices",
      website: "https://www.apple.com",
      is_active: true,
    },
    {
      name: "Nike",
      image: "https://images.unsplash.com/vector-1764006664802-5a3e06e99115?w=400&h=300&fit=crop",
      description: "Athletic footwear and sportswear",
      website: "https://www.nike.com",
      is_active: true,
    },
    {
      name: "Adidas",
      image: "https://images.unsplash.com/photo-1555274175-75f4056dfd05?w=400&h=300&fit=crop",
      description: "Sports apparel and footwear",
      website: "https://www.adidas.com",
      is_active: true,
    },
    {
      name: "Sony",
      image: "https://images.unsplash.com/photo-1573405122783-4f0387d37733?w=400&h=300&fit=crop",
      description: "Audio, video, and gaming electronics",
      website: "https://www.sony.com",
      is_active: true,
    },
  ];

  try {
    const { data: insertedBrands, error } = await supabase
      .from("brands")
      .insert(brands)
      .select();

    if (error) throw error;

    console.log(`✅ Inserted ${insertedBrands.length} brands`);
    return insertedBrands;
  } catch (error) {
    console.error("Error seeding brands:", error);
    throw error;
  }
};

// Seed Products
const seedProducts = async (categories, brands) => {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Use category and brand names for consistency with schema
  const products = [
    // New Arrivals
    {
      name: "Samsung Galaxy S24 Ultra",
      images: [
        "https://images.samsung.com/sg/smartphones/galaxy-s24-ultra/images/galaxy-s24-ultra-highlights-color-titanium-yellow-back-mo.jpg?w=800&h=800&fit=crop",
        "https://i.ytimg.com/vi/5PFp7c8lc6o/maxresdefault.jpg?w=800&h=800&fit=crop",
        "https://media.assettype.com/deccanherald%2F2024-01%2F7af3077d-841b-4a30-b1ec-37ea9906fb1a%2FSamsung_Galaxy_S24_Ultra_Cover_Photo_selected_1A.jpg?w=800&h=800&fit=crop",
      ],
      price: 1199.99,
      discounted_percentage: 12,
      stock: 50,
      sold_quantity: 25,
      category: "Electronics",
      brand: "Samsung",
      badge: true,
      is_available: true,
      offer: false,
      description: "Latest flagship smartphone with advanced AI features, 200MP camera, and S Pen support. Premium design with titanium frame.",
      tags: ["smartphone", "android", "flagship", "camera"],
      created_at: oneWeekAgo,
    },
    {
      name: "Sony WH-1000XM5 Headphones",
      images: [
        "https://m.media-amazon.com/images/I/61ULAZmt9NL.jpg?w=800&h=800&fit=crop",
        "https://gameone.ph/media/catalog/product/mpiowebpcache/d378a0f20f83637cdb1392af8dc032a2/s/o/sony-wh-1000xm5-headset.webp?w=800&h=800&fit=crop",
        "https://down-my.img.susercontent.com/file/my-11134207-7rasb-mdegizikbjch75?w=800&h=800&fit=crop",
      ],
      price: 399.99,
      discounted_percentage: 10,
      stock: 30,
      sold_quantity: 15,
      category: "Electronics",
      brand: "Sony",
      badge: true,
      is_available: true,
      offer: false,
      description: "Industry-leading noise canceling with two processors and eight microphones. Exceptional sound quality.",
      tags: ["headphones", "wireless", "noise-canceling", "audio"],
      created_at: oneWeekAgo,
    },

    // Best Sellers
    {
      name: "iPhone 15 Pro Max",
      images: [
        "https://512pixels.net/wp-content/uploads/2023/12/iphone-15-pro-max-natural.jpg?w=800&h=800&fit=crop",
        "https://static0.pocketlintimages.com/wordpress/wp-content/uploads/wm/2023/09/iphone-15-pro-max-review-4-1.jpg?w=800&h=800&fit=crop",
        "https://images.macrumors.com/t/OGS-wMpuHXbX6VkpJd6urJH1rEg=/1600x0/article-new/2023/09/iphone-15-pro-gray.jpg?w=800&h=800&fit=crop",
      ],
      price: 1199.99,
      discounted_percentage: 5,
      stock: 60,
      sold_quantity: 523,
      category: "Electronics",
      brand: "Apple",
      badge: false,
      is_available: true,
      offer: true,
      description: "Premium smartphone with A17 Pro chip, titanium design, and ProRes video recording. The ultimate iPhone experience.",
      tags: ["iphone", "smartphone", "premium", "camera"],
    },
    {
      name: "Nike Air Force 1 '07",
      images: [
        "https://static.nike.com/a/images/t_PDP_1280_v1/f_auto,q_auto:eco/b7d9211c-26e7-431a-ac24-b0540fb3c00f/air-force-1-07-mens-shoes-jBrhbr.png?w=800&h=800&fit=crop",
        "https://m.media-amazon.com/images/I/61Nl-t0+e5L._AC_UY900_.jpg?w=800&h=800&fit=crop",
        "https://cdn.shopify.com/s/files/1/0013/8377/6326/products/CW2288-111_1_2048x2048.jpg?v=1605307373&w=800&h=800&fit=crop",
      ],
      price: 110.00,
      discounted_percentage: 0,
      stock: 100,
      sold_quantity: 450,
      category: "Fashion",
      brand: "Nike",
      badge: false,
      is_available: true,
      offer: false,
      description: "The radiance lives on in the Nike Air Force 1 '07, the basketball icon that puts a fresh spin on what you know best.",
      tags: ["shoes", "nike", "classic", "streetwear"],
    },

    // Special Offers
    {
      name: "Samsung 55-inch The Frame QLED TV",
      images: [
        "https://images.samsung.com/is/image/samsung/p6pim/in/qa55ls03baklxl/gallery/in-the-frame-ls03b-qa55ls03baklxl-532962306?$684_547_PNG$?w=800&h=800&fit=crop",
        "https://m.media-amazon.com/images/I/91tO0N2J7AL._AC_SL1500_.jpg?w=800&h=800&fit=crop",
        "https://pisces.bbystatic.com/image2/BestBuy_US/images/products/6502/6502220_sd.jpg?w=800&h=800&fit=crop",
      ],
      price: 1499.99,
      discounted_percentage: 25,
      stock: 20,
      sold_quantity: 89,
      category: "Home & Kitchen",
      brand: "Samsung",
      badge: false,
      is_available: true,
      offer: true,
      description: "Artwork, television, movies, and memories - The Frame showcases it all on a beautiful QLED screen.",
      tags: ["tv", "qled", "samsung", "4k"],
    },
    {
      name: "Adidas Ultraboost Light",
      images: [
        "https://assets.adidas.com/images/w_600,f_auto,q_auto/4f49557451454556b693af7500d027e8_9366/Ultraboost_Light_Running_Shoes_White_HQ6351_01_standard.jpg?w=800&h=800&fit=crop",
        "https://m.media-amazon.com/images/I/718t8-wQ3+L._AC_UY1000_.jpg?w=800&h=800&fit=crop",
        "https://hips.hearstapps.com/hmg-prod/images/adidas-ultraboost-light-review-1678204680.jpg?w=800&h=800&fit=crop",
      ],
      price: 190.00,
      discounted_percentage: 20,
      stock: 45,
      sold_quantity: 110,
      category: "Fashion",
      brand: "Adidas",
      badge: false,
      is_available: true,
      offer: true,
      description: "Experience epic energy with the lightness of the new Ultraboost Light, our lightest Ultraboost ever.",
      tags: ["shoes", "running", "adidas", "sport"],
    },

    // Regular Products
    {
      name: "Apple MacBook Air 15-inch M2",
      images: [
        "https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/macbook-air-15-midnight-select-202306?wid=904&hei=840&fmt=jpeg&qlt=90&.v=1684518479433?w=800&h=800&fit=crop",
        "https://m.media-amazon.com/images/I/71S4sIPFvBL._AC_SL1500_.jpg?w=800&h=800&fit=crop",
        "https://i.pcmag.com/imagery/reviews/07y3b03tT80s04a27549704-1.fit_lim.size_1050x591.v1686776518.jpg?w=800&h=800&fit=crop",
      ],
      price: 1299.00,
      discounted_percentage: 0,
      stock: 40,
      sold_quantity: 123,
      category: "Electronics",
      brand: "Apple",
      badge: false,
      is_available: true,
      offer: false,
      description: "Impossibly thin and incredibly fast. The 15-inch MacBook Air with M2 chip gives you more room for what you love.",
      tags: ["laptop", "apple", "macbook", "m2"],
      created_at: oneMonthAgo,
    },
    {
      name: "Sony PlayStation 5",
      images: [
        "https://gmedia.playstation.com/is/image/SIEPDC/ps5-product-thumbnail-01-en-14sep21?$facebook$?w=800&h=800&fit=crop",
        "https://m.media-amazon.com/images/I/51051FiD9UL._SX522_.jpg?w=800&h=800&fit=crop",
        "https://cdn.vox-cdn.com/thumbor/9j-s_d067c2957b45-4299446d-9781-4295-b_d7-5.jpg?w=800&h=800&fit=crop",
      ],
      price: 499.99,
      discounted_percentage: 0,
      stock: 15,
      sold_quantity: 800,
      category: "Electronics",
      brand: "Sony",
      badge: false,
      is_available: true,
      offer: false,
      description: "Experience lightning-fast loading with an ultra-high-speed SSD, deeper immersion with haptic feedback, and 3D Audio.",
      tags: ["gaming", "console", "sony", "ps5"],
      created_at: oneMonthAgo,
    }
  ];

  try {
    const { data: insertedProducts, error } = await supabase
      .from("products")
      .insert(products)
      .select();

    if (error) throw error;

    console.log(`✅ Inserted ${insertedProducts.length} products`);
    return insertedProducts;
  } catch (error) {
    console.error("Error seeding products:", error);
    throw error;
  }
};

// Seed Settings
const seedSettings = async () => {
  const settings = [
    {
      key: "logo_settings",
      value: { type: "text", text: "ELARIC AI", imageUrl: "" },
    },
    {
      key: "site_settings",
      value: { name: "ELARIC AI", description: "Modern e-commerce platform", faviconUrl: "" },
    },
    {
      key: "product_of_the_year",
      value: {
        title: "Product of The Year",
        description: "Discover our most innovative and popular product that has captured hearts worldwide. Experience excellence in every detail.",
        buttonText: "Shop Now",
        link: "/shop",
        image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop",
      },
    },
  ];

  try {
    console.log("⚙️ Seeding settings...");
    for (const setting of settings) {
      const { error } = await supabase
        .from("settings")
        .upsert(setting, { onConflict: "key" });
      if (error) throw error;
    }
    console.log("✅ Seeded settings");
  } catch (error) {
    console.error("Error seeding settings:", error);
    throw error;
  }
};

// Main seeding function
const seedDatabase = async () => {
  console.log("🚀 Starting seed script...\n");

  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
      console.error("❌ Error: SUPABASE_URL or SUPABASE_KEY is not set in your .env file");
      process.exit(1);
    }

    // Clear existing data
    await clearData();

    // Seed categories
    const categories = await seedCategories();

    // Seed brands
    const brands = await seedBrands();

    // Seed products
    await seedProducts(categories, brands);

    // Seed settings
    await seedSettings();

    // Create admin from .env
    await createAdminFromEnv();

    console.log("\n✅ Database seeding completed successfully!");

    // Summary
    console.log("\nSummary:");
    if (categories) console.log(`- Categories: ${categories.length}`);
    if (brands) console.log(`- Brands: ${brands.length}`);
    console.log(`- Products: 8 (Diverse mix across categories)`);

  } catch (error) {
    console.error("\n❌ Error seeding database:");
    console.error(error.message);
    if (error.stack) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    process.exit(0);
  }
};

// Run the seeding
seedDatabase().catch((error) => {
  console.error("❌ Unhandled error:", error);
  process.exit(1);
});