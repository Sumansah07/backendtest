import supabase from "../config/supabase.js";

// Create a new order
const createOrder = async (req, res) => {
  try {
    const { items, amount, address } = req.body;
    const userId = req.user?.id;

    // Validate authentication
    if (!userId) {
      return res.json({
        success: false,
        message: "User not authenticated",
      });
    }

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.json({ success: false, message: "Order items are required" });
    }

    if (!amount) {
      return res.json({ success: false, message: "Order amount is required" });
    }

    if (!address) {
      return res.json({
        success: false,
        message: "Delivery address is required",
      });
    }

    // Validate address required fields with flexible field mapping
    const getAddressValue = (field) => {
      switch (field) {
        case "firstName":
          return (
            address.firstName ||
            address.first_name ||
            address.name?.split(" ")[0] ||
            ""
          );
        case "lastName":
          return (
            address.lastName ||
            address.last_name ||
            address.name?.split(" ").slice(1).join(" ") ||
            ""
          );
        case "zipcode":
          return (
            address.zipcode ||
            address.zipCode ||
            address.zip_code ||
            address.postal_code ||
            ""
          );
        default:
          return address[field] || "";
      }
    };

    const requiredAddressFields = [
      "firstName",
      "email",
      "street",
      "city",
      "state",
      "zipcode",
      "country",
      "phone",
    ];

    const missingFields = requiredAddressFields.filter((field) => {
      const value = getAddressValue(field);
      return !value || value.toString().trim() === "";
    });

    if (missingFields.length > 0) {
      return res.json({
        success: false,
        message: `Missing required address fields: ${missingFields.join(", ")}`,
      });
    }

    // Validate items have productId
    const itemsWithoutProductId = items.filter(
      (item) => !item._id && !item.productId
    );
    if (itemsWithoutProductId.length > 0) {
      return res.json({
        success: false,
        message: "All items must have a valid product ID",
      });
    }

    // Verify user exists
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("id", userId)
      .single();

    if (!user) {
      return res.json({
        success: false,
        message: "User not found",
      });
    }

    // Prepare order data
    const orderData = {
      user_id: userId,
      items: items.map((item) => ({
        productId: item._id || item.productId,
        name: item.name || item.title,
        price: item.price,
        quantity: item.quantity,
        image: item.images?.[0] || item.image,
      })),
      amount,
      address: {
        firstName: getAddressValue("firstName"),
        lastName: getAddressValue("lastName"),
        email: address.email || "",
        street: address.street || address.address || "",
        city: address.city || "",
        state: address.state || address.province || "",
        zipcode: getAddressValue("zipcode"),
        country: address.country || "",
        phone: address.phone || address.phoneNumber || "",
      },
      payment_method: "cod",
      status: "pending",
      payment_status: "pending",
    };

    const { data: newOrder, error } = await supabase
      .from("orders")
      .insert(orderData)
      .select()
      .single();

    if (error) throw error;

    // Note: We don't need to push to user.orders because SQL relation handles it via user_id

    res.json({
      success: true,
      message: "Order created successfully",
      order: newOrder,
      orderId: newOrder.id,
    });
  } catch (error) {
    console.log("Create Order Error:", error);
    res.json({
      success: false,
      message: error.message,
    });
  }
};

// Get all orders (Admin)
// Get all orders (Admin)
const getAllOrders = async (req, res) => {
  try {
    const { data: orders, error } = await supabase
      .from("orders")
      .select("*, users(name, email)")
      .order("date", { ascending: false });

    if (error) throw error;

    // Format for compatibility
    const formattedOrders = orders.map(order => ({
      ...order,
      _id: order.id,
      userId: order.users, // Populate simulation
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status,
      // Items are already in order.items
    }));

    res.json({
      success: true,
      orders: formattedOrders,
      total: orders.length,
      message: "Orders fetched successfully",
    });
  } catch (error) {
    console.log("Get All Orders Error:", error);
    res.json({
      success: false,
      message: error.message,
    });
  }
};

// Get orders by user ID
// Get orders by user ID
const getUserOrders = async (req, res) => {
  try {
    // Check if it's an admin request with userId param
    const { userId } = req.params;
    const requestUserId = userId || req.user?.id; // Use param for admin, auth user for regular users

    if (!requestUserId) {
      return res.json({
        success: false,
        message: "User ID not provided",
      });
    }

    const { data: orders, error } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", requestUserId)
      .order("date", { ascending: false });

    if (error) throw error;

    const formattedOrders = orders.map(order => ({
      ...order,
      _id: order.id,
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status,
    }));

    res.json({
      success: true,
      orders: formattedOrders,
      total: orders.length,
      message: "User orders fetched successfully",
    });
  } catch (error) {
    console.log("Get User Orders Error:", error);
    res.json({
      success: false,
      message: error.message,
    });
  }
};

// Get single order by user ID and order ID
// Get single order by user ID and order ID
const getUserOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id; // From auth middleware

    const { data: order, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .eq("user_id", userId)
      .single();

    if (!order) {
      return res.json({
        success: false,
        message: "Order not found",
      });
    }

    const formattedOrder = {
      ...order,
      _id: order.id,
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status,
    };

    res.json({
      success: true,
      order: formattedOrder,
      message: "Order fetched successfully",
    });
  } catch (error) {
    console.log("Get User Order By ID Error:", error);
    res.json({
      success: false,
      message: error.message,
    });
  }
};

// Update order status (Admin)
// Update order status (Admin)
const updateOrderStatus = async (req, res) => {
  try {
    const { orderId, status, paymentStatus } = req.body;

    if (!orderId || !status) {
      return res.json({
        success: false,
        message: "Order ID and status are required",
      });
    }

    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (!order) {
      return res.json({
        success: false,
        message: "Order not found",
      });
    }

    const updates = {
      status,
      updated_at: new Date()
    };

    if (paymentStatus) {
      updates.payment_status = paymentStatus;
    }

    const { data: updatedOrder, error } = await supabase
      .from("orders")
      .update(updates)
      .eq("id", orderId)
      .select()
      .single();

    if (error) throw error;

    // Format response
    const formattedOrder = {
      ...updatedOrder,
      _id: updatedOrder.id,
      paymentMethod: updatedOrder.payment_method,
      paymentStatus: updatedOrder.payment_status,
    };

    res.json({
      success: true,
      message: "Order updated successfully",
      order: formattedOrder,
    });
  } catch (error) {
    console.log("Update Order Status Error:", error);
    res.json({
      success: false,
      message: error.message,
    });
  }
};

// Get order statistics (Admin Dashboard)
// Get order statistics (Admin Dashboard)
const getOrderStats = async (req, res) => {
  try {
    // Counts
    const { count: totalOrders } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true });

    const { count: pendingOrders } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    const { count: deliveredOrders } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "delivered");

    // Calculate total revenue from delivered/shipped/confirmed orders
    const { data: revenueOrders } = await supabase
      .from("orders")
      .select("amount")
      .in("status", ["delivered", "shipped", "confirmed"]);

    const totalRevenue = revenueOrders
      ? revenueOrders.reduce((sum, order) => sum + Number(order.amount), 0)
      : 0;

    // Get recent orders
    const { data: recentOrdersData } = await supabase
      .from("orders")
      .select("*, users(name, email)")
      .order("date", { ascending: false })
      .limit(10);

    const recentOrders = recentOrdersData.map(order => ({
      ...order,
      _id: order.id,
      userId: order.users,
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status,
    }));

    // Monthly orders
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Fetch all orders from last 6 months to aggregate in code
    const { data: recentPeriodOrders } = await supabase
      .from("orders")
      .select("date, amount")
      .gte("date", sixMonthsAgo.toISOString());

    // Group by month
    const monthlyStats = {};
    if (recentPeriodOrders) {
      recentPeriodOrders.forEach(order => {
        const d = new Date(order.date);
        const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
        if (!monthlyStats[key]) {
          monthlyStats[key] = {
            _id: { year: d.getFullYear(), month: d.getMonth() + 1 },
            count: 0,
            revenue: 0,
          };
        }
        monthlyStats[key].count++;
        monthlyStats[key].revenue += Number(order.amount);
      });
    }

    const monthlyOrders = Object.values(monthlyStats).sort((a, b) => {
      if (a._id.year !== b._id.year) return a._id.year - b._id.year;
      return a._id.month - b._id.month;
    });

    res.json({
      success: true,
      stats: {
        totalOrders,
        pendingOrders,
        deliveredOrders,
        totalRevenue,
        recentOrders,
        monthlyOrders,
      },
      message: "Order statistics fetched successfully",
    });
  } catch (error) {
    console.log("Get Order Stats Error:", error);
    res.json({
      success: false,
      message: error.message,
    });
  }
};

// Delete order (Admin)
// Delete order (Admin)
const deleteOrder = async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.json({
        success: false,
        message: "Order ID is required",
      });
    }

    const { error } = await supabase
      .from("orders")
      .delete()
      .eq("id", orderId);

    if (error) throw error;

    res.json({
      success: true,
      message: "Order deleted successfully",
    });
  } catch (error) {
    console.log("Delete Order Error:", error);
    res.json({
      success: false,
      message: error.message,
    });
  }
};

export {
  createOrder,
  getAllOrders,
  getUserOrders,
  getUserOrderById,
  updateOrderStatus,
  getOrderStats,
  deleteOrder,
};
