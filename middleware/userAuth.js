import jwt from "jsonwebtoken";
import supabase from "../config/supabase.js";

const userAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token =
      authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : req.headers.token;

    if (!token) {
      return res.json({
        success: false,
        message: "Not Authorized, login required",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user by ID from token
    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("id", decoded.id)
      .single();

    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    if (!user.is_active) {
      return res.json({ success: false, message: "Account is deactivated" });
    }

    // Add user info to request object
    req.user = user;
    next();
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Invalid token" });
  }
};

export default userAuth;
