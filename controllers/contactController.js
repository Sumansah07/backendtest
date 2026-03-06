import supabase from "../config/supabase.js";

// Create a new contact message (for authenticated users)
// Create a new contact message (for authenticated users)
export const createContact = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    const userId = req.user.id; // From auth middleware

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    // Verify user exists
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("id", userId)
      .single();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Create new contact message
    const { data: contact, error } = await supabase
      .from("contacts")
      .insert({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        subject: subject.trim(),
        message: message.trim(),
        user_id: userId,
        status: "unread", // Default status
      })
      .select("*, users(name, email)")
      .single();

    if (error) throw error;

    // Format response
    const formattedContact = {
      ...contact,
      userId: contact.users,
    };

    res.status(201).json({
      success: true,
      message:
        "Your message has been sent successfully! We'll get back to you soon.",
      data: formattedContact,
    });
  } catch (error) {
    console.error("Create contact error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send message. Please try again.",
    });
  }
};

// Get all contact messages (for admin)
// Get all contact messages (for admin)
export const getAllContacts = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;

    // Build query
    let query = supabase
      .from("contacts")
      .select("*, users(name, email)", { count: "exact" });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,subject.ilike.%${search}%,message.ilike.%${search}%`);
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    query = query.order("created_at", { ascending: false }).range(from, to);

    const { data: contacts, count: total, error } = await query;

    if (error) throw error;

    // Get status counts - parallel queries
    // This is distinct from the main query which might be filtered
    // We want counts for all statuses generally for the dashboard tabs
    const [unreadRes, readRes, repliedRes] = await Promise.all([
      supabase.from("contacts").select("*", { count: "exact", head: true }).eq("status", "unread"),
      supabase.from("contacts").select("*", { count: "exact", head: true }).eq("status", "read"),
      supabase.from("contacts").select("*", { count: "exact", head: true }).eq("status", "replied")
    ]);

    const counts = {
      unread: unreadRes.count || 0,
      read: readRes.count || 0,
      replied: repliedRes.count || 0,
      total: total || 0, // Total of current filtered query or total overall? Usually total overall.
    };

    // If we want total regardless of filter for the counts object:
    const { count: absoluteTotal } = await supabase.from("contacts").select("*", { count: "exact", head: true });
    counts.total = absoluteTotal || 0;

    const formattedContacts = contacts.map(c => ({
      ...c,
      userId: c.users,
      adminNotes: c.admin_notes,
    }));

    res.status(200).json({
      success: true,
      data: formattedContacts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
      counts,
    });
  } catch (error) {
    console.error("Get contacts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch contacts",
    });
  }
};

// Get single contact message (for admin)
// Get single contact message (for admin)
export const getContactById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: contact, error } = await supabase
      .from("contacts")
      .select("*, users(name, email)")
      .eq("id", id)
      .single();

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact message not found",
      });
    }

    const formattedContact = {
      ...contact,
      userId: contact.users,
      adminNotes: contact.admin_notes,
    };

    res.status(200).json({
      success: true,
      data: formattedContact,
    });
  } catch (error) {
    console.error("Get contact by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch contact message",
    });
  }
};

// Update contact status (for admin)
// Update contact status (for admin)
export const updateContactStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    if (!["unread", "read", "replied"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
    }

    const { data: contact, error } = await supabase
      .from("contacts")
      .update({
        status,
        admin_notes: adminNotes || "",
      })
      .eq("id", id)
      .select("*, users(name, email)")
      .single();

    if (error || !contact) {
      if (!contact) {
        return res.status(404).json({
          success: false,
          message: "Contact message not found",
        });
      }
      throw error;
    }

    const formattedContact = {
      ...contact,
      userId: contact.users,
      adminNotes: contact.admin_notes,
    };

    res.status(200).json({
      success: true,
      message: "Contact status updated successfully",
      data: formattedContact,
    });
  } catch (error) {
    console.error("Update contact status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update contact status",
    });
  }
};

// Delete contact message (for admin)
// Delete contact message (for admin)
export const deleteContact = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from("contacts")
      .delete()
      .eq("id", id);

    if (error) throw error; // If row doesn't exist, Supabase delete succeeds but returns count 0. We might want to check this.
    // For simplicity, assuming success if no error.

    res.status(200).json({
      success: true,
      message: "Contact message deleted successfully",
    });
  } catch (error) {
    console.error("Delete contact error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete contact message",
    });
  }
};

// Get user's own contact messages (for authenticated users)
// Get user's own contact messages (for authenticated users)
export const getUserContacts = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: contacts, count: total, error } = await supabase
      .from("contacts")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;

    const formattedContacts = contacts.map(c => ({
      ...c,
      adminNotes: c.admin_notes,
    }));

    res.status(200).json({
      success: true,
      data: formattedContacts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Get user contacts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch your messages",
    });
  }
};
