import supabase from "../config/supabase.js";

// Process checkout and update stock
const processCheckout = async (req, res) => {
  try {
    const { items } = req.body; // Array of {productId, quantity}

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart items are required",
      });
    }

    const stockCheckErrors = [];

    // First, check stock availability for all items
    for (const item of items) {
      const { productId, quantity } = item;

      if (!productId || !quantity || quantity <= 0) {
        stockCheckErrors.push("Invalid product or quantity");
        continue;
      }

      const { data: product } = await supabase
        .from("products")
        .select("name, stock")
        .eq("id", productId)
        .single();

      if (!product) {
        stockCheckErrors.push(`Product not found: ${productId}`);
        continue;
      }

      if (product.stock < quantity) {
        stockCheckErrors.push(
          `Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${quantity}`
        );
        continue;
      }
    }

    if (stockCheckErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Stock validation failed",
        errors: stockCheckErrors,
      });
    }

    // If all checks pass, update stock for all items
    const updatePromises = items.map(async (item) => {
      const { productId, quantity } = item;

      // Fetch current state again to be safe (though race condition still exists without RPC)
      const { data: product } = await supabase
        .from("products")
        .select("stock, sold_quantity, name")
        .eq("id", productId)
        .single();

      if (!product) return null;

      const newStock = product.stock - quantity;
      const newSoldQuantity = (product.sold_quantity || 0) + quantity;
      const isAvailable = newStock > 0;

      const { data: updatedProduct, error } = await supabase
        .from("products")
        .update({
          stock: newStock,
          sold_quantity: newSoldQuantity,
          is_available: isAvailable,
        })
        .eq("id", productId)
        .select()
        .single();

      if (error) throw error;

      return updatedProduct;
    });

    const updatedProducts = await Promise.all(updatePromises);

    // Filter out nulls if any products weren't found during update
    const validUpdatedProducts = updatedProducts.filter(p => p !== null);

    res.json({
      success: true,
      message: "Checkout processed successfully",
      updatedProducts: validUpdatedProducts.map((product) => ({
        _id: product.id,
        name: product.name,
        stock: product.stock,
        soldQuantity: product.sold_quantity,
        isAvailable: product.is_available,
      })),
    });
  } catch (error) {
    console.log("Checkout processing error:", error);
    res.status(500).json({
      success: false,
      message: "Error processing checkout",
      error: error.message,
    });
  }
};

export { processCheckout };
