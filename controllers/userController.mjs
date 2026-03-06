import validator from "validator";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import supabase from "../config/supabase.js";
import { cloudinary, deleteCloudinaryImage } from "../config/cloudinary.js";
import fs from "fs";

// Helper function to clean up temporary files
const cleanupTempFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log("Temporary file cleaned up:", filePath);
    }
  } catch (error) {
    console.error("Error cleaning up temporary file:", error);
  }
};

const createToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
};

// Route for user login
// Route for user login
const userLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !user) {
      return res.json({ success: false, message: "User doesn't exist" });
    }

    if (!user.is_active) {
      return res.json({ success: false, message: "Account is deactivated" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch) {
      // Update last login
      await supabase
        .from("users")
        .update({ last_login: new Date() })
        .eq("id", user.id);

      const token = createToken(user);
      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          _id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        message: "User logged in successfully",
      });
    } else {
      res.json({ success: false, message: "Invalid credentials, try again" });
    }
  } catch (error) {
    console.log("User Login Error", error);
    res.json({ success: false, message: error.message });
  }
};

// Route for user registration
// Route for user registration
const userRegister = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role = "user",
      address,
      isActive = true,
    } = req.body;

    // Check if user exists
    const { data: existingUser } = await supabase
      .from("users")
      .select("email")
      .eq("email", email)
      .single();

    if (existingUser) {
      return res.json({ success: false, message: "User already exists" });
    }

    // Validating email format & strong password
    if (!validator.isEmail(email)) {
      return res.json({
        success: false,
        message: "Please enter a valid email address",
      });
    }

    if (password.length < 8) {
      return res.json({
        success: false,
        message: "Password length should be equal or greater than 8",
      });
    }

    // Only allow admin role creation if the request comes from an admin
    if (role === "admin") {
      const { count: existingAdmins } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin");

      if (existingAdmins > 0 && (!req.user || req.user.role !== "admin")) {
        return res.json({
          success: false,
          message: "Only admins can create admin accounts",
        });
      }

      console.log(`✅ Creating admin account (existing admins: ${existingAdmins})`);
    }

    // Hashing user password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = {
      name,
      email,
      password: hashedPassword,
      role: role,
      is_active: isActive, // Note snake_case for Supabase
      // Addresses are handled separately now, or initially empty in separate table
      // user_cart is default empty jsonb
    };

    const { data: user, error: createError } = await supabase
      .from("users")
      .insert(newUser)
      .select()
      .single();

    if (createError) {
      throw new Error(createError.message);
    }

    // If address is provided during registration, add it to addresses table
    if (address) {
      await supabase.from("addresses").insert({
        user_id: user.id,
        label: 'Home', // Default label
        street: address.street || "",
        city: address.city || "",
        state: address.state || "",
        zip_code: address.zipCode || "",
        country: address.country || "",
        phone: address.phone || "",
        is_default: true
      });
    }

    const token = createToken(user);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        _id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      message: "User registered successfully!",
    });
  } catch (error) {
    console.log("User Register Error", error);
    res.json({ success: false, message: error.message });
  }
};

// Route for admin login (now uses role-based authentication)
// Route for admin login (now uses role-based authentication)
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !user) {
      return res.json({ success: false, message: "User doesn't exist" });
    }

    if (user.role !== "admin") {
      return res.json({ success: false, message: "Admin access required" });
    }

    if (!user.is_active) {
      return res.json({ success: false, message: "Account is deactivated" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch) {
      // Update last login
      await supabase
        .from("users")
        .update({ last_login: new Date() })
        .eq("id", user.id);

      const token = createToken(user);
      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          _id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        message: "Welcome admin",
      });
    } else {
      res.json({ success: false, message: "Invalid credentials" });
    }
  } catch (error) {
    console.log("Admin Login Error", error);
    res.json({ success: false, message: error.message });
  }
};

const removeUser = async (req, res) => {
  try {
    // First, find the user to get their avatar URL
    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("id", req.body._id || req.body.id) // Support both _id and id
      .single();

    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    // Delete user's avatar from Cloudinary if exists
    if (user.avatar) {
      try {
        const deleteResult = await deleteCloudinaryImage(user.avatar);
        if (deleteResult.success) {
          console.log("User avatar deleted from Cloudinary successfully");
        } else {
          console.log(
            "Failed to delete user avatar from Cloudinary:",
            deleteResult.message
          );
        }
      } catch (error) {
        console.log("Error deleting user avatar from Cloudinary:", error);
        // Continue with user deletion even if avatar deletion fails
      }
    }

    // Delete the user from database
    const { error } = await supabase
      .from("users")
      .delete()
      .eq("id", user.id);

    if (error) throw error;

    res.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    console.log("Removed user Error", error);
    res.json({ success: false, message: error.message });
  }
};

const updateUser = async (req, res) => {
  try {
    // Get user ID from URL parameter
    const userId = req.params.id;
    const { name, email, password, role, avatar, addresses, isActive } =
      req.body;

    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    const updates = {};

    if (name) updates.name = name;
    if (email) {
      if (!validator.isEmail(email)) {
        return res.json({
          success: false,
          message: "Please enter a valid email address",
        });
      }
      updates.email = email;
    }

    if (role) {
      // Only allow admin role updates if the requesting user is admin
      if (role === "admin" && (!req.user || req.user.role !== "admin")) {
        return res.json({
          success: false,
          message: "Only admins can assign admin role",
        });
      }
      updates.role = role;
    }

    // Handle avatar update
    if (avatar !== undefined) {
      updates.avatar = avatar;
    }

    // Handle isActive field - only admins can change account status
    if (isActive !== undefined && req.user && req.user.role === "admin") {
      updates.is_active = isActive;
    }

    if (password) {
      if (password.length < 8) {
        return res.json({
          success: false,
          message: "Password length should be equal or greater than 8",
        });
      }

      const salt = await bcrypt.genSalt(10);
      updates.password = await bcrypt.hash(password, salt);
    }

    // Perform User Updates
    const { error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", userId);

    if (error) throw error;

    // Handle new addresses array - Replace existing addresses?
    // In SQL, we should delete old addresses and insert new ones or update carefully.
    // For simplicity matching the replacement logic:
    if (addresses && Array.isArray(addresses)) {
      // Delete all existing addresses for this user
      await supabase.from("addresses").delete().eq("user_id", userId);

      // Insert new ones
      const newAddresses = addresses.map(addr => ({
        user_id: userId,
        label: addr.label,
        street: addr.street,
        city: addr.city,
        state: addr.state,
        zip_code: addr.zipCode,
        country: addr.country,
        phone: addr.phone,
        is_default: addr.isDefault
      }));

      if (newAddresses.length > 0) {
        await supabase.from("addresses").insert(newAddresses);
      }
    }

    res.json({ success: true, message: "User updated successfully" });
  } catch (error) {
    console.log("Update user Error", error);
    res.json({ success: false, message: error.message });
  }
};

const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role } = req.query;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("users")
      .select("*, orders(*)", { count: "exact" }) // Populate orders
      .order("created_at", { ascending: false })
      .range(from, to);

    if (role) {
      query = query.eq("role", role);
    }

    const { data: users, count: total, error } = await query;

    if (error) throw error;

    // Filter out password from response
    const usersWithoutPassword = users.map(user => {
      const { password, ...rest } = user;
      return { ...rest, _id: user.id };
    });

    res.json({
      success: true,
      total,
      users: usersWithoutPassword,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// Address Management Functions

// Add new address for user
// Add new address for user
const addAddress = async (req, res) => {
  try {
    const userId = req.user?.id; // Get from auth middleware for user routes
    const paramUserId = req.params?.userId; // Get from params for admin routes
    const targetUserId = userId || paramUserId;

    const { label, street, city, state, zipCode, country, phone, isDefault } =
      req.body;

    // Validate required fields
    if (!label || !street || !city || !state || !zipCode || !country) {
      return res.json({
        success: false,
        message:
          "All address fields are required (label, street, city, state, zipCode, country)",
      });
    }

    // Check if user exists
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("id", targetUserId)
      .single();

    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    // If this is being set as default, remove default from other addresses
    if (isDefault) {
      await supabase
        .from("addresses")
        .update({ is_default: false })
        .eq("user_id", targetUserId);
    }

    // Check if it's the first address
    const { count: addressCount } = await supabase
      .from("addresses")
      .select("*", { count: "exact", head: true })
      .eq("user_id", targetUserId);

    const newAddress = {
      user_id: targetUserId,
      label,
      street,
      city,
      state,
      zip_code: zipCode,
      country,
      phone: phone || "",
      is_default: isDefault || addressCount === 0,
    };

    const { data: createdAddress, error } = await supabase
      .from("addresses")
      .insert(newAddress)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: "Address added successfully",
      address: createdAddress,
    });
  } catch (error) {
    console.log("Add Address Error", error);
    res.json({ success: false, message: error.message });
  }
};

// Update existing address
// Update existing address
const updateAddress = async (req, res) => {
  try {
    const userId = req.user?.id; // Get from auth middleware for user routes
    const paramUserId = req.params?.userId; // Get from params for admin routes
    const targetUserId = userId || paramUserId;
    const { addressId } = req.params;
    const { label, street, city, state, zipCode, country, phone, isDefault } =
      req.body;

    // Check if address exists and belongs to user
    const { data: existingAddress } = await supabase
      .from("addresses")
      .select("*")
      .eq("id", addressId)
      .eq("user_id", targetUserId)
      .single();

    if (!existingAddress) {
      return res.json({ success: false, message: "Address not found" });
    }

    // If setting as default, remove default from other addresses
    if (isDefault) {
      await supabase
        .from("addresses")
        .update({ is_default: false })
        .eq("user_id", targetUserId);
    }

    const updates = {};
    if (label) updates.label = label;
    if (street) updates.street = street;
    if (city) updates.city = city;
    if (state) updates.state = state;
    if (zipCode) updates.zip_code = zipCode;
    if (country) updates.country = country;
    if (phone !== undefined) updates.phone = phone;
    if (isDefault !== undefined) updates.is_default = isDefault;

    const { data: updatedAddress, error } = await supabase
      .from("addresses")
      .update(updates)
      .eq("id", addressId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: "Address updated successfully",
      address: updatedAddress,
    });
  } catch (error) {
    console.log("Update Address Error", error);
    res.json({ success: false, message: error.message });
  }
};

// Delete address
// Delete address
const deleteAddress = async (req, res) => {
  try {
    const userId = req.user?.id; // Get from auth middleware for user routes
    const paramUserId = req.params?.userId; // Get from params for admin routes
    const targetUserId = userId || paramUserId;
    const { addressId } = req.params;

    // Check if address exists and belongs to user
    const { data: address } = await supabase
      .from("addresses")
      .select("*")
      .eq("id", addressId)
      .eq("user_id", targetUserId)
      .single();

    if (!address) {
      return res.json({ success: false, message: "Address not found" });
    }

    const wasDefault = address.is_default;

    // Delete
    await supabase.from("addresses").delete().eq("id", addressId);

    // If deleted address was default, make another one default
    if (wasDefault) {
      const { data: remainingAddresses } = await supabase
        .from("addresses")
        .select("*")
        .eq("user_id", targetUserId)
        .limit(1);

      if (remainingAddresses && remainingAddresses.length > 0) {
        await supabase
          .from("addresses")
          .update({ is_default: true })
          .eq("id", remainingAddresses[0].id);
      }
    }

    res.json({
      success: true,
      message: "Address deleted successfully",
    });
  } catch (error) {
    console.log("Delete Address Error", error);
    res.json({ success: false, message: error.message });
  }
};

// Set default address
// Set default address
const setDefaultAddress = async (req, res) => {
  try {
    const userId = req.user?.id; // Get from auth middleware for user routes
    const paramUserId = req.params?.userId; // Get from params for admin routes
    const targetUserId = userId || paramUserId;
    const { addressId } = req.params;

    // Verify address exists
    const { data: address } = await supabase
      .from("addresses")
      .select("id")
      .eq("id", addressId)
      .eq("user_id", targetUserId)
      .single();

    if (!address) {
      return res.json({ success: false, message: "Address not found" });
    }

    // Unset all defaults
    await supabase
      .from("addresses")
      .update({ is_default: false })
      .eq("user_id", targetUserId);

    // Set new default
    await supabase
      .from("addresses")
      .update({ is_default: true })
      .eq("id", addressId);

    res.json({
      success: true,
      message: "Default address updated successfully",
    });
  } catch (error) {
    console.log("Set Default Address Error", error);
    res.json({ success: false, message: error.message });
  }
};

// Get user addresses
// Get user addresses
const getUserAddresses = async (req, res) => {
  try {
    const userId = req.user?.id; // Get from auth middleware for user routes
    const paramUserId = req.params?.userId; // Get from params for admin routes
    const targetUserId = userId || paramUserId;

    const { data: addresses } = await supabase
      .from("addresses")
      .select("*")
      .eq("user_id", targetUserId);

    res.json({
      success: true,
      addresses: addresses || [],
    });
  } catch (error) {
    console.log("Get Addresses Error", error);
    res.json({ success: false, message: error.message });
  }
};

// Avatar upload function
const uploadUserAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.json({ success: false, message: "No file uploaded" });
    }

    // Upload image to Cloudinary in the orebi/users folder
    const uploadResult = await cloudinary.uploader.upload(req.file.path, {
      folder: "orebi/users",
      resource_type: "image",
      transformation: [
        { width: 400, height: 400, crop: "fill", gravity: "face" },
        { quality: "auto", fetch_format: "auto" },
      ],
    });

    // Clean up temporary file
    cleanupTempFile(req.file.path);

    res.json({
      success: true,
      message: "Avatar uploaded successfully",
      avatarUrl: uploadResult.secure_url,
    });
  } catch (error) {
    console.log("Avatar upload error", error);

    // Clean up temporary file even on error
    if (req.file?.path) {
      cleanupTempFile(req.file.path);
    }

    res.json({ success: false, message: error.message });
  }
};

export {
  userLogin,
  userRegister,
  adminLogin,
  getUsers,
  removeUser,
  updateUser,
  getUserProfile,
  updateUserProfile,
  addToCart,
  updateCart,
  getUserCart,
  clearCart,
  createAdmin,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getUserAddresses,
  uploadUserAvatar,
};

// Get user profile
// Get user profile
const getUserProfile = async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("*, orders(*), addresses(*)")
      .eq("id", req.user.id)
      .single();

    if (error || !user) {
      return res.json({ success: false, message: "User not found" });
    }

    // Sort addresses to put default first if needed, though frontend might handle it
    const addresses = user.addresses || [];
    const defaultAddress = addresses.find(a => a.is_default) || addresses[0];

    // Remove password
    delete user.password;

    const userProfile = {
      id: user.id,
      _id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: defaultAddress ? defaultAddress.phone : "",
      address: defaultAddress ? defaultAddress.street : "",
      avatar: user.avatar,
      createdAt: user.created_at,
      lastLogin: user.last_login,
      isActive: user.is_active,
      orders: user.orders || [],
      addresses: addresses,
    };

    res.json({ success: true, user: userProfile });
  } catch (error) {
    console.log("Get Profile Error", error);
    res.json({ success: false, message: error.message });
  }
};

// Update user profile
// Update user profile
const updateUserProfile = async (req, res) => {
  try {
    const { name, email, phone, address } = req.body;
    const userId = req.user.id;

    // Fetch user
    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    const updates = {};
    if (name) updates.name = name;
    if (email) {
      if (!validator.isEmail(email)) {
        return res.json({
          success: false,
          message: "Please enter a valid email address",
        });
      }

      // Check if email is already taken by another user
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("email", email)
        .neq("id", userId)
        .single();

      if (existingUser) {
        return res.json({
          success: false,
          message: "Email is already taken by another user",
        });
      }

      updates.email = email;
    }

    // Update user
    if (Object.keys(updates).length > 0) {
      await supabase.from("users").update(updates).eq("id", userId);
    }

    // Handle phone and address - update the default address or create one
    if (phone || address) {
      // Find default address
      const { data: defaultAddr } = await supabase
        .from("addresses")
        .select("*")
        .eq("user_id", userId)
        .eq("is_default", true)
        .single();

      if (defaultAddr) {
        // Update existing default
        const addrUpdates = {};
        if (phone) addrUpdates.phone = phone;
        if (address) addrUpdates.street = address;

        await supabase.from("addresses").update(addrUpdates).eq("id", defaultAddr.id);
      } else {
        // Create new default
        await supabase.from("addresses").insert({
          user_id: userId,
          label: 'Primary',
          street: address || "",
          city: "",
          state: "",
          zip_code: "",
          country: "",
          phone: phone || "",
          is_default: true
        });
      }
    }

    // Fetch updated profile
    const { data: updatedUser } = await supabase
      .from("users")
      .select("*, addresses(*)")
      .eq("id", userId)
      .single();

    const addresses = updatedUser.addresses || [];
    const defaultAddress = addresses.find(a => a.is_default) || addresses[0];

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        phone: defaultAddress ? defaultAddress.phone : "",
        address: defaultAddress ? defaultAddress.street : "",
        avatar: updatedUser.avatar,
        createdAt: updatedUser.created_at,
      },
    });
  } catch (error) {
    console.log("Update Profile Error", error);
    res.json({ success: false, message: error.message });
  }
};

// Add item to cart
// Add item to cart
const addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1, size } = req.body;
    const userId = req.user.id;

    // Get current cart
    const { data: user } = await supabase
      .from("users")
      .select("user_cart")
      .eq("id", userId)
      .single();

    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    const userCart = user.user_cart || {};
    const cartKey = size ? `${productId}_${size}` : productId;

    if (userCart[cartKey]) {
      userCart[cartKey] += quantity;
    } else {
      userCart[cartKey] = quantity;
    }

    const { error } = await supabase
      .from("users")
      .update({ user_cart: userCart })
      .eq("id", userId);

    if (error) throw error;

    res.json({
      success: true,
      message: "Item added to cart",
      cart: userCart,
    });
  } catch (error) {
    console.log("Add to Cart Error", error);
    res.json({ success: false, message: error.message });
  }
};

// Update cart item
const updateCart = async (req, res) => {
  try {
    const { productId, quantity, size } = req.body;
    const userId = req.user.id;

    const { data: user } = await supabase
      .from("users")
      .select("user_cart")
      .eq("id", userId)
      .single();

    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    const userCart = user.user_cart || {};
    const cartKey = size ? `${productId}_${size}` : productId;

    if (quantity <= 0) {
      delete userCart[cartKey];
    } else {
      userCart[cartKey] = quantity;
    }

    await supabase
      .from("users")
      .update({ user_cart: userCart })
      .eq("id", userId);

    res.json({
      success: true,
      message: "Cart updated successfully",
      cart: userCart,
    });
  } catch (error) {
    console.log("Update Cart Error", error);
    res.json({ success: false, message: error.message });
  }
};

// Get user cart
const getUserCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: user } = await supabase
      .from("users")
      .select("user_cart")
      .eq("id", userId)
      .single();

    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      cart: user.user_cart || {},
    });
  } catch (error) {
    console.log("Get Cart Error", error);
    res.json({ success: false, message: error.message });
  }
};

// Clear user cart
// Clear user cart
const clearCart = async (req, res) => {
  try {
    const userId = req.user.id;

    const { error } = await supabase
      .from("users")
      .update({ user_cart: {} })
      .eq("id", userId);

    if (error) throw error;

    res.json({
      success: true,
      message: "Cart cleared successfully",
    });
  } catch (error) {
    console.log("Clear Cart Error", error);
    res.json({ success: false, message: error.message });
  }
};

// Create admin user (only accessible by existing admins)
// Create admin user (only accessible by existing admins)
const createAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if requesting user is admin
    if (req.user.role !== "admin") {
      return res.json({ success: false, message: "Admin access required" });
    }

    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .single();

    if (existingUser) {
      return res.json({ success: false, message: "User already exists" });
    }

    if (!validator.isEmail(email)) {
      return res.json({
        success: false,
        message: "Please enter a valid email address",
      });
    }

    if (password.length < 8) {
      return res.json({
        success: false,
        message: "Password length should be equal or greater than 8",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const { data: admin, error } = await supabase
      .from("users")
      .insert({
        name,
        email,
        password: hashedPassword,
        role: "admin",
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: "Admin created successfully!",
      admin: {
        id: admin.id, // Supabase uses id
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    console.log("Create Admin Error", error);
    res.json({ success: false, message: error.message });
  }
};
