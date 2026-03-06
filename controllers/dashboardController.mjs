import supabase from "../config/supabase.js";

// Get dashboard statistics
// Get dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    // Verify admin role (additional check even though middleware handles it)
    if (req.user.role !== "admin") {
      return res.json({
        success: false,
        message: "Admin access required for dashboard statistics",
      });
    }

    // Get counts in parallel
    const [
      { count: totalUsers },
      { count: totalProducts },
      { count: totalOrders },
    ] = await Promise.all([
      supabase.from("users").select("*", { count: "exact", head: true }),
      supabase.from("products").select("*", { count: "exact", head: true }),
      supabase.from("orders").select("*", { count: "exact", head: true }),
    ]);

    // Calculate total revenue from delivered/shipped orders
    const { data: revenueOrders } = await supabase
      .from("orders")
      .select("amount")
      .in("status", ["delivered", "shipped", "confirmed"]);

    const totalRevenue = revenueOrders
      ? revenueOrders.reduce((sum, order) => sum + Number(order.amount), 0)
      : 0;

    // Get recent orders (last 5)
    const { data: recentOrdersData } = await supabase
      .from("orders")
      .select("*, users(name, email)")
      .order("date", { ascending: false })
      .limit(5);

    const recentOrders = recentOrdersData.map(order => ({
      ...order,
      userId: order.users,
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status,
    }));

    // Get top products (mock logic for now - or complex query)
    // Supabase can't easily do "top selling products" from orders jsonb without RPC.
    // We'll just fetch latest products as a placeholder like the original code did somewhat.
    // Original code: sort({ createdAt: -1 }).limit(5)
    const { data: topProductsData } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);

    const topProducts = topProductsData.map(p => ({
      ...p,
      discountedPercentage: p.discounted_percentage,
      soldQuantity: p.sold_quantity,
      image: p.images && p.images[0]
    }));

    // Get orders by status
    const { data: allOrdersStatus } = await supabase.from("orders").select("status");
    let ordersByStatus = [];
    if (allOrdersStatus) {
      const statusMap = allOrdersStatus.reduce((acc, curr) => {
        acc[curr.status] = (acc[curr.status] || 0) + 1;
        return acc;
      }, {});
      ordersByStatus = Object.keys(statusMap).map(status => ({
        _id: status,
        count: statusMap[status]
      }));
    }

    // Get recent users (last 5)
    const { data: recentUsers } = await supabase
      .from("users")
      .select("name, email, created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    // Calculate growth percentages (mock data - you can implement real calculation)
    const stats = {
      totalProducts,
      totalOrders,
      totalUsers,
      totalRevenue,
      recentOrders,
      topProducts,
      recentUsers: recentUsers.map(u => ({ ...u, createdAt: u.created_at })),
      ordersByStatus,
      growth: {
        products: 12, // +12%
        orders: 8, // +8%
        users: 15, // +15%
        revenue: 23, // +23%
      },
    };

    res.json({
      success: true,
      stats,
      message: "Dashboard statistics fetched successfully",
    });
  } catch (error) {
    console.log("Get Dashboard Stats Error:", error);
    res.json({
      success: false,
      message: error.message,
    });
  }
};

// Get analytics data for charts
// Get analytics data for charts
const getAnalytics = async (req, res) => {
  try {
    // Verify admin role (additional check even though middleware handles it)
    if (req.user.role !== "admin") {
      return res.json({
        success: false,
        message: "Admin access required for analytics data",
      });
    }

    const { period = "6months" } = req.query;

    let dateFilter = new Date();
    if (period === "6months") {
      dateFilter.setMonth(dateFilter.getMonth() - 6);
    } else if (period === "1year") {
      dateFilter.setFullYear(dateFilter.getFullYear() - 1);
    } else {
      dateFilter.setMonth(dateFilter.getMonth() - 3); // 3 months default
    }

    // Monthly orders and revenue
    const { data: orders } = await supabase
      .from("orders")
      .select("date, amount")
      .gte("date", dateFilter.toISOString());

    const monthlyDataMap = {};
    if (orders) {
      orders.forEach(o => {
        const d = new Date(o.date);
        const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
        if (!monthlyDataMap[key]) {
          monthlyDataMap[key] = {
            _id: { year: d.getFullYear(), month: d.getMonth() + 1 },
            orders: 0,
            revenue: 0
          };
        }
        monthlyDataMap[key].orders++;
        monthlyDataMap[key].revenue += Number(o.amount);
      });
    }
    const monthlyData = Object.values(monthlyDataMap).sort((a, b) => {
      if (a._id.year !== b._id.year) return a._id.year - b._id.year;
      return a._id.month - b._id.month;
    });

    // User registrations over time
    const { data: users } = await supabase
      .from("users")
      .select("created_at")
      .gte("created_at", dateFilter.toISOString());

    const userRegMap = {};
    if (users) {
      users.forEach(u => {
        const d = new Date(u.created_at);
        const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
        if (!userRegMap[key]) {
          userRegMap[key] = {
            _id: { year: d.getFullYear(), month: d.getMonth() + 1 },
            users: 0
          };
        }
        userRegMap[key].users++;
      });
    }
    const userRegistrations = Object.values(userRegMap).sort((a, b) => {
      if (a._id.year !== b._id.year) return a._id.year - b._id.year;
      return a._id.month - b._id.month;
    });

    res.json({
      success: true,
      analytics: {
        monthlyData,
        userRegistrations,
        period,
      },
      message: "Analytics data fetched successfully",
    });
  } catch (error) {
    console.log("Get Analytics Error:", error);
    res.json({
      success: false,
      message: error.message,
    });
  }
};

// Get quick stats for sidebar
// Get quick stats for sidebar
const getQuickStats = async (req, res) => {
  try {
    // Verify admin role
    if (req.user.role !== "admin") {
      return res.json({
        success: false,
        message: "Admin access required for quick statistics",
      });
    }

    const today = new Date();
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const endOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1
    );

    // Today's sales (sum of today's order amounts)
    const { data: todaysOrdersData } = await supabase
      .from("orders")
      .select("amount")
      .gte("date", startOfDay.toISOString())
      .lt("date", endOfDay.toISOString())
      .in("status", ["delivered", "shipped", "confirmed", "pending"]);

    const todaysSales = todaysOrdersData
      ? todaysOrdersData.reduce((sum, o) => sum + Number(o.amount), 0)
      : 0;

    // Today's new orders count
    const { count: todaysOrders } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .gte("date", startOfDay.toISOString())
      .lt("date", endOfDay.toISOString());

    res.json({
      success: true,
      quickStats: {
        todaysSales,
        todaysOrders: todaysOrders || 0,
      },
      message: "Quick statistics fetched successfully",
    });
  } catch (error) {
    console.log("Get Quick Stats Error:", error);
    res.json({
      success: false,
      message: error.message,
    });
  }
};

export { getDashboardStats, getAnalytics, getQuickStats };
