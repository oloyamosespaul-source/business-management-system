
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Product = {
  id: string;
  name: string;
  sku: string | null;
  cost_price: number;
  selling_price: number;
  quantity: number;
  low_stock_level: number;
};

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [businessId, setBusinessId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [lowStock, setLowStock] = useState("5");

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);
    setMessage("");

    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError || !userData.user) {
        throw new Error("Please log in first.");
      }

      const { data: member, error: memberError } = await supabase
        .from("business_members")
        .select("business_id")
        .eq("user_id", userData.user.id)
        .limit(1)
        .maybeSingle();

      if (memberError) throw memberError;

      if (!member) {
        throw new Error("No registered business was found.");
      }

      setBusinessId(member.business_id);

      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("business_id", member.business_id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setProducts((data || []) as Product[]);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not load products."
      );
    } finally {
      setLoading(false);
    }
  }

  async function addProduct(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      if (!businessId) {
        throw new Error("Business information is not ready. Please refresh.");
      }

      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        throw new Error("Please log in first.");
      }

      const { error } = await supabase.from("products").insert({
        business_id: businessId,
        name: name.trim(),
        sku: sku.trim() || null,
        cost_price: Number(costPrice),
        selling_price: Number(sellingPrice),
        quantity: Number(quantity),
        low_stock_level: Number(lowStock),
      });

      if (error) throw error;

      setMessage("Product successfully added!");
      setName("");
      setSku("");
      setCostPrice("");
      setSellingPrice("");
      setQuantity("");
      setLowStock("5");

      await loadProducts();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not save product."
      );
    } finally {
      setSaving(false);
    }
  }

  function money(value: number) {
    return "UGX " + Number(value || 0).toLocaleString("en-UG");
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-800 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Inventory Management
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Register products and manage your business stock.
            </p>
          </div>

          <a
            href="/"
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
          >
            Back to Dashboard
          </a>
        </div>

        {message && (
          <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            {message}
          </div>
        )}

        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-xl font-bold">Register New Product</h2>

          <form onSubmit={addProduct} className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Product Name *
              </label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sugar"
                className="w-full rounded-lg border border-slate-300 p-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Product Code / SKU
              </label>
              <input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="e.g. PRD001"
                className="w-full rounded-lg border border-slate-300 p-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Buying Price (UGX) *
              </label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Selling Price (UGX) *
              </label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Available Quantity *
              </label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Low Stock Alert Level
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={lowStock}
                onChange={(e) => setLowStock(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-3"
              />
            </div>

            <button
              type="submit"
              disabled={saving || loading || !businessId}
              className="rounded-xl bg-blue-600 p-4 font-semibold text-white hover:bg-blue-700 disabled:opacity-50 sm:col-span-2"
            >
              {saving ? "Saving Product..." : "ADD PRODUCT"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Registered Products</h2>
              <p className="mt-1 text-sm text-slate-500">
                Products saved in your business database.
              </p>
            </div>

            <button
              onClick={loadProducts}
              className="rounded-lg bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <p className="py-8 text-center text-slate-500">
              Loading products...
            </p>
          ) : products.length === 0 ? (
            <p className="py-8 text-center text-slate-500">
              No products registered yet. Add your first product above.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-slate-500">
                    <th className="p-3">Product</th>
                    <th className="p-3">Code</th>
                    <th className="p-3">Buying Price</th>
                    <th className="p-3">Selling Price</th>
                    <th className="p-3">Quantity</th>
                    <th className="p-3">Stock Status</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id} className="border-b">
                      <td className="p-3 font-semibold">{product.name}</td>
                      <td className="p-3">{product.sku || "-"}</td>
                      <td className="p-3">{money(product.cost_price)}</td>
                      <td className="p-3">{money(product.selling_price)}</td>
                      <td className="p-3">{product.quantity}</td>
                      <td className="p-3">
                        {Number(product.quantity) <=
                        Number(product.low_stock_level) ? (
                          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                            Low Stock
                          </span>
                        ) : (
                          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                            In Stock
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
