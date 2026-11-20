
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Product = {
  id: string;
  name: string;
  selling_price: number;
  cost_price: number;
  quantity: number;
};

type SaleResult = {
  success: boolean;
  sale_id: string;
  debt_id: string | null;
  total_amount: number;
  buying_price: number;
  remaining_stock: number;
};

export default function SalesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [receiptId, setReceiptId] = useState("");

  const selectedProduct = products.find((p) => p.id === productId);

  const soldQuantity = Number(quantity);
  const amount = selectedProduct
    ? soldQuantity * Number(selectedProduct.selling_price)
    : 0;

  const outstandingAmount =
    paymentStatus === "credit"
      ? amount
      : paymentStatus === "partial"
        ? amount - Number(amountPaid || 0)
        : 0;

  useEffect(() => {
    async function loadProducts() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;

      if (!user) {
        setMessage("Please log in first.");
        return;
      }

      const { data: membership, error: memberError } = await supabase
        .from("business_members")
        .select("business_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (memberError || !membership) {
        setMessage("Business not found. Please set up your business.");
        return;
      }

      setBusinessId(membership.business_id);

      const { data, error } = await supabase
        .from("products")
        .select("id, name, selling_price, cost_price, quantity")
        .eq("business_id", membership.business_id)
        .order("name");

      if (error) {
        setMessage("Could not load products: " + error.message);
        return;
      }

      setProducts(data || []);
    }

    loadProducts();
  }, []);

  async function recordSale() {
    setMessage("");
    setReceiptId("");

    if (!selectedProduct || !businessId) {
      setMessage("Please select a product.");
      return;
    }

    if (!Number.isFinite(soldQuantity) || soldQuantity <= 0) {
      setMessage("Enter a valid quantity greater than zero.");
      return;
    }

    if (soldQuantity > Number(selectedProduct.quantity)) {
      setMessage("Not enough stock available.");
      return;
    }

    if (
      !Number.isFinite(Number(selectedProduct.cost_price)) ||
      Number(selectedProduct.cost_price) <= 0
    ) {
      setMessage(
        "This product has no valid buying price. Please update its buying price in Inventory first."
      );
      return;
    }

    if (paymentStatus !== "paid" && !customerName.trim()) {
      setMessage("Please enter the customer's name for a credit sale.");
      return;
    }

    const initialPayment =
      paymentStatus === "partial" ? Number(amountPaid) : 0;

    if (
      paymentStatus === "partial" &&
      (!Number.isFinite(initialPayment) ||
        initialPayment <= 0 ||
        initialPayment >= amount)
    ) {
      setMessage(
        "Partial payment must be greater than zero and less than the total sale amount."
      );
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.rpc(
        "record_sale_with_debt",
        {
          p_business_id: businessId,
          p_product_id: selectedProduct.id,
          p_quantity: soldQuantity,
          p_payment_status: paymentStatus,
          p_customer_name:
            paymentStatus === "paid" ? null : customerName.trim(),
          p_phone:
            paymentStatus === "paid" ? null : phone.trim() || null,
          p_amount_paid: initialPayment,
        }
      );

      if (error) {
        setMessage("Sale could not be saved: " + error.message);
        return;
      }

      const result = data as SaleResult;

      setProducts((current) =>
        current.map((product) =>
          product.id === selectedProduct.id
            ? {
                ...product,
                quantity: Number(result.remaining_stock),
              }
            : product
        )
      );

      // Save the new sale ID for automatic receipt viewing.
      setReceiptId(result.sale_id);

      setQuantity("1");
      setCustomerName("");
      setPhone("");
      setAmountPaid("");
      setPaymentStatus("paid");

      if (paymentStatus === "paid") {
        setMessage(
          "Sale recorded successfully! Buying price saved and stock updated."
        );
      } else {
        setMessage(
          paymentStatus === "credit"
            ? "Credit sale recorded! Customer debt registered and stock updated."
            : "Partial payment recorded! Remaining customer balance registered and stock updated."
        );
      }
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f1f5f9", padding: 30 }}>
      <div style={{ maxWidth: 850, margin: "auto" }}>
        <a href="/" style={{ color: "#2563eb", textDecoration: "none" }}>
          ← Back to Dashboard
        </a>

        <h1 style={{ fontSize: 32, fontWeight: 800, marginTop: 20 }}>
          SMARTBIZ Sales & POS
        </h1>

        <p style={{ color: "#64748b", marginBottom: 25 }}>
          Record sales, receive payments and manage customer credit.
        </p>

        <section
          style={{
            background: "white",
            padding: 25,
            borderRadius: 14,
            boxShadow: "0 2px 10px #0000000d",
          }}
        >
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>
            New Sale
          </h2>

          <label style={{ display: "block", fontWeight: 600 }}>
            Select Product
          </label>

          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            style={{
              width: "100%",
              padding: 13,
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              margin: "8px 0 18px",
            }}
          >
            <option value="">Choose a product</option>

            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} — Stock: {product.quantity} — UGX{" "}
                {Number(product.selling_price).toLocaleString()}
              </option>
            ))}
          </select>

          {selectedProduct && (
            <div
              style={{
                background: "#f8fafc",
                padding: 15,
                borderRadius: 8,
                marginBottom: 18,
                color: "#475569",
              }}
            >
              <p>
                Available stock: <strong>{selectedProduct.quantity}</strong>
              </p>

              <p>
                Buying price:{" "}
                <strong>
                  UGX {Number(selectedProduct.cost_price).toLocaleString()}
                </strong>
              </p>

              <p>
                Selling price:{" "}
                <strong>
                  UGX {Number(selectedProduct.selling_price).toLocaleString()}
                </strong>
              </p>
            </div>
          )}

          <label style={{ display: "block", fontWeight: 600 }}>
            Quantity Sold
          </label>

          <input
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            style={{
              width: "100%",
              padding: 13,
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              margin: "8px 0 18px",
            }}
          />

          <label style={{ display: "block", fontWeight: 600 }}>
            Payment Status
          </label>

          <select
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
            style={{
              width: "100%",
              padding: 13,
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              margin: "8px 0 18px",
            }}
          >
            <option value="paid">Paid</option>
            <option value="credit">Unpaid / Credit</option>
            <option value="partial">Partial Payment</option>
          </select>

          {paymentStatus !== "paid" && (
            <div
              style={{
                background: "#f8fafc",
                padding: 18,
                borderRadius: 10,
                marginBottom: 20,
              }}
            >
              <h3 style={{ fontWeight: 700, marginBottom: 15 }}>
                Customer Information
              </h3>

              <label style={{ display: "block", fontWeight: 600 }}>
                Customer Name
              </label>

              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter customer's name"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: 13,
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  margin: "8px 0 18px",
                }}
              />

              <label style={{ display: "block", fontWeight: 600 }}>
                Phone Number
              </label>

              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter customer's phone number"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: 13,
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  margin: "8px 0 18px",
                }}
              />

              {paymentStatus === "partial" && (
                <>
                  <label style={{ display: "block", fontWeight: 600 }}>
                    Amount Paid Now (UGX)
                  </label>

                  <input
                    type="number"
                    min="1"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    placeholder="Enter amount received"
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: 13,
                      border: "1px solid #cbd5e1",
                      borderRadius: 8,
                      margin: "8px 0 18px",
                    }}
                  />
                </>
              )}

              <p style={{ color: "#475569", fontSize: 14 }}>
                Outstanding customer balance:
                <strong style={{ display: "block", fontSize: 20, marginTop: 5 }}>
                  UGX {Math.max(outstandingAmount, 0).toLocaleString()}
                </strong>
              </p>
            </div>
          )}

          <div
            style={{
              background: "#eff6ff",
              padding: 18,
              borderRadius: 10,
              marginBottom: 20,
            }}
          >
            <p style={{ color: "#475569" }}>Total Sale Amount</p>

            <h2 style={{ fontSize: 28, fontWeight: 800, color: "#1d4ed8" }}>
              UGX {amount.toLocaleString()}
            </h2>
          </div>

          <button
            onClick={recordSale}
            disabled={loading || products.length === 0}
            style={{
              width: "100%",
              padding: 15,
              background: loading ? "#94a3b8" : "#2563eb",
              color: "white",
              border: "none",
              borderRadius: 9,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {loading ? "Processing Sale..." : "RECORD SALE"}
          </button>

          {message && (
            <div
              style={{
                marginTop: 18,
                padding: 15,
                borderRadius: 9,
                background: receiptId ? "#f0fdf4" : "#f8fafc",
                color: receiptId ? "#166534" : "#334155",
                fontWeight: 600,
              }}
            >
              <p>{message}</p>

              {receiptId && (
                <a
                  href={`/receipt/${receiptId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-block",
                    marginTop: 12,
                    padding: "11px 18px",
                    background: "#2563eb",
                    color: "white",
                    borderRadius: 8,
                    textDecoration: "none",
                    fontWeight: 700,
                  }}
                >
                  VIEW / PRINT RECEIPT
                </a>
              )}
            </div>
          )}

          {products.length === 0 && !message && (
            <p style={{ marginTop: 15, color: "#64748b" }}>
              No products found. Add products to your inventory first.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
