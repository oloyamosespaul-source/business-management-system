
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Expense = {
  id: string;
  category: string;
  description: string | null;
  amount: number;
  created_at: string;
};

export default function ExpensesPage() {
  const [businessId, setBusinessId] = useState("");
  const [category, setCategory] = useState("Transport");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function loadExpenses(id: string) {
    const { data, error } = await supabase
      .from("expenses")
      .select("id, category, description, amount, created_at")
      .eq("business_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage("Could not load expenses: " + error.message);
      return;
    }

    setExpenses(data || []);
  }

  useEffect(() => {
    async function initialize() {
      const { data: authData } = await supabase.auth.getUser();

      if (!authData.user) {
        setMessage("Please log in first.");
        return;
      }

      const { data: membership, error } = await supabase
        .from("business_members")
        .select("business_id")
        .eq("user_id", authData.user.id)
        .limit(1)
        .single();

      if (error || !membership) {
        setMessage("Business not found. Please set up your business.");
        return;
      }

      setBusinessId(membership.business_id);
      await loadExpenses(membership.business_id);
    }

    initialize();
  }, []);

  async function addExpense() {
    setMessage("");

    const expenseAmount = Number(amount);

    if (!category || !Number.isFinite(expenseAmount) || expenseAmount <= 0) {
      setMessage("Please enter a valid expense amount.");
      return;
    }

    setLoading(true);

    const { data: authData } = await supabase.auth.getUser();

    if (!authData.user || !businessId) {
      setMessage("Please log in and make sure your business is set up.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("expenses").insert({
      business_id: businessId,
      category,
      description: description.trim() || null,
      amount: expenseAmount,
      created_by: authData.user.id,
    });

    if (error) {
      setMessage("Expense could not be saved: " + error.message);
      setLoading(false);
      return;
    }

    setAmount("");
    setDescription("");
    setMessage("Expense recorded successfully!");

    await loadExpenses(businessId);
    setLoading(false);
  }

  const totalExpenses = expenses.reduce(
    (total, expense) => total + Number(expense.amount),
    0
  );

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f1f5f9",
        padding: 30,
      }}
    >
      <div style={{ maxWidth: 900, margin: "auto" }}>
        <a
          href="/"
          style={{ color: "#2563eb", textDecoration: "none" }}
        >
          ← Back to Dashboard
        </a>

        <h1 style={{ fontSize: 32, fontWeight: 800, marginTop: 20 }}>
          SMARTBIZ Expense Management
        </h1>

        <p style={{ color: "#64748b", marginBottom: 25 }}>
          Record and monitor your business expenses.
        </p>

        <section
          style={{
            background: "white",
            padding: 25,
            borderRadius: 14,
            marginBottom: 25,
            boxShadow: "0 2px 10px #0000000d",
          }}
        >
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>
            Record New Expense
          </h2>

          <label style={{ display: "block", fontWeight: 600 }}>
            Expense Category
          </label>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{
              width: "100%",
              padding: 13,
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              margin: "8px 0 18px",
            }}
          >
            <option>Transport</option>
            <option>Rent</option>
            <option>Electricity</option>
            <option>Water</option>
            <option>Wages</option>
            <option>Internet</option>
            <option>Purchases</option>
            <option>Maintenance</option>
            <option>Other</option>
          </select>

          <label style={{ display: "block", fontWeight: 600 }}>
            Description
          </label>

          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Example: Transport to supplier"
            style={{
              width: "100%",
              padding: 13,
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              margin: "8px 0 18px",
              boxSizing: "border-box",
            }}
          />

          <label style={{ display: "block", fontWeight: 600 }}>
            Amount (UGX)
          </label>

          <input
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter expense amount"
            style={{
              width: "100%",
              padding: 13,
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              margin: "8px 0 20px",
              boxSizing: "border-box",
            }}
          />

          <button
            onClick={addExpense}
            disabled={loading || !businessId}
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
            {loading ? "Saving Expense..." : "SAVE EXPENSE"}
          </button>

          {message && (
            <p style={{ marginTop: 18, fontWeight: 600, color: "#334155" }}>
              {message}
            </p>
          )}
        </section>

        <section
          style={{
            background: "white",
            padding: 25,
            borderRadius: 14,
            boxShadow: "0 2px 10px #0000000d",
          }}
        >
          <h2 style={{ fontSize: 22, fontWeight: 700 }}>
            Expense History
          </h2>

          <p style={{ color: "#64748b", marginTop: 8 }}>
            Total Recorded Expenses
          </p>

          <h2 style={{ fontSize: 28, fontWeight: 800, color: "#1d4ed8" }}>
            UGX {totalExpenses.toLocaleString()}
          </h2>

          <div style={{ overflowX: "auto", marginTop: 20 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                  <th style={{ padding: 12 }}>Category</th>
                  <th style={{ padding: 12 }}>Description</th>
                  <th style={{ padding: 12 }}>Amount</th>
                  <th style={{ padding: 12 }}>Date</th>
                </tr>
              </thead>

              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td style={{ padding: 12, borderTop: "1px solid #e2e8f0" }}>
                      {expense.category}
                    </td>
                    <td style={{ padding: 12, borderTop: "1px solid #e2e8f0" }}>
                      {expense.description || "—"}
                    </td>
                    <td style={{ padding: 12, borderTop: "1px solid #e2e8f0" }}>
                      UGX {Number(expense.amount).toLocaleString()}
                    </td>
                    <td style={{ padding: 12, borderTop: "1px solid #e2e8f0" }}>
                      {new Date(expense.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}

                {expenses.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: 20, textAlign: "center", color: "#64748b" }}>
                      No expenses recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
