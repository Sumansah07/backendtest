import Stripe from "stripe";
import supabase from "../config/supabase.js";

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Create payment intent for Stripe
// Create payment intent for Stripe
export const createPaymentIntent = async (req, res) => {
  try {
    const { orderId } = req.body;
    const userId = req.user.id;

    // Find the order
    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (!order) {
      return res.json({ success: false, message: "Order not found" });
    }

    // Verify order belongs to user
    if (order.user_id !== userId) {
      return res.json({
        success: false,
        message: "Unauthorized access to order",
      });
    }

    // Check if order is already paid
    if (order.payment_status === "paid") {
      return res.json({ success: false, message: "Order is already paid" });
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(order.amount * 100), // Convert to cents
      currency: "usd",
      metadata: {
        orderId: order.id,
        userId: userId,
      },
    });

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      amount: order.amount,
    });
  } catch (error) {
    console.error("Create Payment Intent Error:", error);
    res.json({ success: false, message: error.message });
  }
};

// Confirm payment and update order status
// Confirm payment and update order status
export const confirmPayment = async (req, res) => {
  try {
    const { paymentIntentId, orderId } = req.body;
    const userId = req.user.id;

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status === "succeeded") {
      // Update order payment status
      const { data: order } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();

      if (!order) {
        return res.json({ success: false, message: "Order not found" });
      }

      // Verify order belongs to user
      if (order.user_id !== userId) {
        return res.json({
          success: false,
          message: "Unauthorized access to order",
        });
      }

      const { data: updatedOrder, error } = await supabase
        .from("orders")
        .update({
          payment_status: "paid",
          payment_method: "stripe",
          status: "confirmed",
          updated_at: new Date()
        })
        .eq("id", orderId)
        .select()
        .single();

      if (error) throw error;

      const formattedOrder = {
        ...updatedOrder,
        paymentStatus: updatedOrder.payment_status,
        paymentMethod: updatedOrder.payment_method
      };

      res.json({
        success: true,
        message: "Payment confirmed successfully",
        order: formattedOrder,
      });
    } else {
      res.json({
        success: false,
        message: "Payment not completed",
      });
    }
  } catch (error) {
    console.error("Confirm Payment Error:", error);
    res.json({ success: false, message: error.message });
  }
};

// Handle Stripe webhook for payment updates
// Handle Stripe webhook for payment updates
export const handleStripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case "payment_intent.succeeded":
      const paymentIntent = event.data.object;
      const orderId = paymentIntent.metadata.orderId;

      // Update order status
      await supabase
        .from("orders")
        .update({
          payment_status: "paid",
          status: "confirmed",
          updated_at: new Date()
        })
        .eq("id", orderId);
      break;

    case "payment_intent.payment_failed":
      const failedPayment = event.data.object;
      const failedOrderId = failedPayment.metadata.orderId;

      // Update order status
      await supabase
        .from("orders")
        .update({
          payment_status: "failed",
          updated_at: new Date()
        })
        .eq("id", failedOrderId);
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
};

// Create order with payment method selection
// Create order with payment method selection
export const createOrder = async (req, res) => {
  try {
    const { items, address, paymentMethod = "cod" } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.json({ success: false, message: "Order items are required" });
    }

    if (!address) {
      return res.json({
        success: false,
        message: "Delivery address is required",
      });
    }

    // Validate address required fields
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
      const value =
        address[field] || address[field === "zipcode" ? "zipCode" : field];
      return !value || value.trim() === "";
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

    // Calculate total amount
    const totalAmount = items.reduce((total, item) => {
      return total + item.price * item.quantity;
    }, 0);

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
      amount: totalAmount,
      address: {
        firstName: address.firstName || address.name?.split(" ")[0] || "",
        lastName:
          address.lastName || address.name?.split(" ").slice(1).join(" ") || "",
        email: address.email || "",
        street: address.street || "",
        city: address.city || "",
        state: address.state || "",
        zipcode: address.zipcode || address.zipCode || "",
        country: address.country || "",
        phone: address.phone || "",
      },
      payment_method: paymentMethod,
      payment_status: paymentMethod === "cod" ? "pending" : "pending", // Or 'awaiting_payment'
      status: "pending",
    };

    const { data: order, error } = await supabase
      .from("orders")
      .insert(orderData)
      .select()
      .single();

    if (error) throw error;

    // Add orderId for response compatibility
    const formattedOrder = {
      ...order,
      _id: order.id,
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status
    };

    res.json({
      success: true,
      message: "Order created successfully",
      orderId: order.id,
      order: formattedOrder,
    });
  } catch (error) {
    console.error("Create Order Error:", error);
    res.json({ success: false, message: error.message });
  }
};
