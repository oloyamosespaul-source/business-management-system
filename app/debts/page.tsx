
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Debt = {
  id: string;
  customer_name: string;
  phone: string | null;
  amount: number;
  amount_paid: number;
  created_at: string;
};

export default function DebtsPage() {
  const [businessId, setBusinessId] = useState("");
  const [debts, setDebts] = useState<Debt[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [debtAmount, setDebtAmount] = useState("");
  const [payments, setPayments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function loadDebts(id: string) {
    const { data, error } = await supabase
      .from("debts")
      .select("id, customer_name, phone, amount, amount_paid, created_at")
      .eq("business_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage("Could not load customer debts: " + error.message);
      return;
    }

    setDebts(data || []);
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
      await loadDebts(membership.business_id);
    }

    initialize();
  }, []);

  async function addDebt() {
    setMessage("");

    const amount = Number(debtAmount);

    if (!customerName.trim()) {
      setMessage("Please enter the customer's name.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage("Please enter a valid debt amount.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("debts").insert({
      business_id: businessId,
      customer_name: customerName.trim(),
      phone: phone.trim() || null,
      amount,
      amount_paid: 0,
    });

    if (error) {
      setMessage("Customer debt could not be saved: " + error.message);
      setLoading(false);
      return;
    }

    setCustomerName("");
    setPhone("");
    setDebtAmount("");
    setMessage("Customer debt recorded successfully!");

    await loadDebts(businessId);
    setLoading(false);
  }

  async function recordPayment(debt: Debt) {
    setMessage("");

    const payment = Number(payments[debt.id]);
    const alreadyPaid = Number(debt.amount_paid || 0);
    const outstanding = Number(debt.amount) - alreadyPaid;

    if (!Number.isFinite(payment) || payment <= 0) {
      setMessage("Please enter a valid payment amount.");
      return;
    }

    if (payment > outstanding) {
      setMessage("Payment cannot be greater than the outstanding balance.");
      return;
    }

    setLoading(true);

    const { error } = await supabase
      .from("debts")
      .update({ amount_paid: alreadyPaid + payment })
      .eq("id", debt.id)
      .eq("business_id", businessId)
      .eq("amount_paid", alreadyPaid);

    if (error) {
      setMessage("Payment could not be recorded: " + error.message);
      setLoading(false);
      return;
    }

    setPayments((current) => ({ ...current, [debt.id]: "" }));
    setMessage("Customer payment recorded successfully!");

    await loadDebts(businessId);
    setLoading(false);
  }

  const totalDebt = debts.reduce(
    (sum, debt) => sum + Number(debt.amount),
    0
  );

  const totalPaid = debts.reduce(
    (sum, debt) => sum + Number(debt.amount_paid || 0),
    0
  );

  const outstandingBalance = totalDebt - totalPaid;

  return (
    <main style={{ minHeight: "100vh", background: "#f1f5f9", padding: 30 }}>
      <div style={{ maxWidth: 1050, margin: "auto" }}>
        <a href="/" style={{ color: "#2563eb", textDecoration: "none" }}>
          ← Back to Dashboard
        </a>

        <h1 style={{ fontSize: 32, fontWeight: 800, marginTop: 20 }}>
          SMARTBIZ Customer Debts
        </h1>

        <p style={{ color: "#64748b", marginBottom: 25 }}>
          Manage credit sales, customer payments and outstanding balances.
        </p>

        <section style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: 15,
          marginBottom: 25
        }}>
          {[
            { title: "Total Credit", value: totalDebt },
            { title: "Total Payments", value: totalPaid },
            { title: "Outstanding Balance", value: outstandingBalance }
          ].map((item) => (
            <div key={item.title} style={{
              background: "white",
              padding: 20,
              borderRadius: 12,
              boxShadow: "0 2px 10px #0000000d"
            }}>
              <p style={{ color: "#64748b", fontSize: 14 }}>{item.title}</p>
              <h2 style={{ fontSize: 23, fontWeight: 800, marginTop: 8 }}>
                UGX {item.value.toLocaleString()}
              </h2>
            </div>
          ))}
        </section>

        <section style={{
          background: "white",
          padding: 25,
          borderRadius: 14,
          marginBottom: 25,
          boxShadow: "0 2px 10px #0000000d"
        }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>
            Register Customer Debt
          </h2>

          <label style={{ display: "block", fontWeight: 600 }}>
            Customer Name
          </label>
          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Enter customer's full name"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: 13,
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              margin: "8px 0 18px"
            }}
          />

          <label style={{ display: "block", fontWeight: 600 }}>
            Phone Number
          </label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Enter phone number (optional)"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: 13,
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              margin: "8px 0 18px"
            }}
          />

          <label style={{ display: "block", fontWeight: 600 }}>
            Amount Owed (UGX)
          </label>
          <input
            type="number"
            min="1"
            value={debtAmount}
            onChange={(e) => setDebtAmount(e.target.value)}
            placeholder="Enter amount owed"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: 13,
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              margin: "8px 0 20px"
            }}
          />

          <button
            onClick={addDebt}
            disabled={loading || !businessId}
            style={{
              width: "100%",
              padding: 15,
              background: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: 9,
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            {loading ? "Saving..." : "REGISTER CUSTOMER DEBT"}
          </button>

          {message && (
            <p style={{ marginTop: 18, fontWeight: 600 }}>
              {message}
            </p>
          )}
        </section>

        <section style={{
          background: "white",
          padding: 25,
          borderRadius: 14,
          boxShadow: "0 2px 10px #0000000d"
        }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>
            Customer Debt Records
          </h2>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
              <thead>
                <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                  <th style={{ padding: 12 }}>Customer</th>
                  <th style={{ padding: 12 }}>Amount</th>
                  <th style={{ padding: 12 }}>Paid</th>
                  <th style={{ padding: 12 }}>Balance</th>
                  <th style={{ padding: 12 }}>Record Payment</th>
                </tr>
              </thead>

              <tbody>
                {debts.map((debt) => {
                  const balance = Number(debt.amount) - Number(debt.amount_paid || 0);

                  return (
                    <tr key={debt.id}>
                      <td style={{ padding: 12, borderTop: "1px solid #e2e8f0" }}>
                        <strong>{debt.customer_name}</strong>
                        <br />
                        <span style={{ color: "#64748b", fontSize: 13 }}>
                          {debt.phone || "No phone number"}
                        </span>
                      </td>

                      <td style={{ padding: 12, borderTop: "1px solid #e2e8f0" }}>
                        UGX {Number(debt.amount).toLocaleString()}
                      </td>

                      <td style={{ padding: 12, borderTop: "1px solid #e2e8f0" }}>
                        UGX {Number(debt.amount_paid || 0).toLocaleString()}
                      </td>

                      <td style={{
                        padding: 12,
                        borderTop: "1px solid #e2e8f0",
                        fontWeight: 700
                      }}>
                        UGX {balance.toLocaleString()}
                        {balance === 0 && (
                          <span style={{ display: "block", color: "green", fontSize: 12 }}>
                            Fully paid
                          </span>
                        )}
                      </td>

                      <td style={{ padding: 12, borderTop: "1px solid #e2e8f0" }}>
                        {balance > 0 ? (
                          <div style={{ display: "flex", gap: 6 }}>
                            <input
                              type="number"
                              min="1"
                              placeholder="Amount"
                              value={payments[debt.id] || ""}
                              onChange={(e) =>
                                setPayments((current) => ({
                                  ...current,
                                  [debt.id]: e.target.value
                                }))
                              }
                              style={{
                                width: 100,
                                padding: 8,
                                border: "1px solid #cbd5e1",
                                borderRadius: 6
                              }}
                            />
                            <button
                              onClick={() => recordPayment(debt)}
                              disabled={loading}
                              style={{
                                padding: 9,
                                background: "#2563eb",
                                color: "white",
                                border: "none",
                                borderRadius: 6,
                                cursor: "pointer"
                              }}
                            >
                              Pay
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: "green" }}>Completed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {debts.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{
                      padding: 25,
                      textAlign: "center",
                      color: "#64748b"
                    }}>
                      No customer debts recorded yet.
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
