
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Sale = {
  id: string;
  product_name: string | null;
  quantity: number;
  total_amount: number;
  unit_cost: number;
  created_at: string;
  payment_status: string | null;
};

type Expense = {
  id: string;
  category: string;
  amount: number;
  created_at: string;
};

type Debt = {
  amount: number;
  amount_paid: number;
};

type ReportData = {
  businessName: string;
  currency: string;
  sales: Sale[];
  expenses: Expense[];
  totalSales: number;
  totalExpenses: number;
  totalDebts: number;
  salesToday: number;
  salesThisMonth: number;
  expensesThisMonth: number;
  unitsSold: number;
  costOfGoodsSold: number;
  profitAvailable: boolean;
};

type DailySale = {
  day: string;
  amount: number;
};

export default function ReportsPage() {
  const [report, setReport] = useState<ReportData | null>(null);
  const [dailySales, setDailySales] = useState<DailySale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function money(amount: number) {
    return `${report?.currency || "UGX"} ${amount.toLocaleString("en-UG", {
      maximumFractionDigits: 0,
    })}`;
  }

  async function loadReports() {
    setLoading(true);
    setError("");

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error("Please log in to view business reports.");
      }

      const { data: membership, error: memberError } = await supabase
        .from("business_members")
        .select("business_id")
        .eq("user_id", authData.user.id)
        .limit(1)
        .single();

      if (memberError || !membership) {
        throw new Error("Your business account could not be found.");
      }

      const [businessResult, salesResult, expensesResult, debtsResult] =
        await Promise.all([
          supabase
            .from("businesses")
            .select("name, currency")
            .eq("id", membership.business_id)
            .single(),

          supabase
            .from("sales")
            .select(
              "id, product_name, quantity, total_amount, unit_cost, created_at, payment_status"
            )
            .eq("business_id", membership.business_id)
            .order("created_at", { ascending: false }),

          supabase
            .from("expenses")
            .select("id, category, amount, created_at")
            .eq("business_id", membership.business_id)
            .order("created_at", { ascending: false }),

          supabase
            .from("debts")
            .select("amount, amount_paid")
            .eq("business_id", membership.business_id),
        ]);

      if (businessResult.error) throw businessResult.error;
      if (salesResult.error) throw salesResult.error;
      if (expensesResult.error) throw expensesResult.error;
      if (debtsResult.error) throw debtsResult.error;

      const sales = (salesResult.data || []) as Sale[];
      const expenses = (expensesResult.data || []) as Expense[];
      const debts = (debtsResult.data || []) as Debt[];

      const now = new Date();

      const isToday = (dateString: string) =>
        new Date(dateString).toDateString() === now.toDateString();

      const isThisMonth = (dateString: string) => {
        const date = new Date(dateString);
        return (
          date.getMonth() === now.getMonth() &&
          date.getFullYear() === now.getFullYear()
        );
      };

      const totalSales = sales.reduce(
        (sum, sale) => sum + Number(sale.total_amount || 0),
        0
      );

      const totalExpenses = expenses.reduce(
        (sum, expense) => sum + Number(expense.amount || 0),
        0
      );

      const totalDebts = debts.reduce(
        (sum, debt) =>
          sum +
          Number(debt.amount || 0) -
          Number(debt.amount_paid || 0),
        0
      );

      const salesToday = sales
        .filter((sale) => isToday(sale.created_at))
        .reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0);

      const salesThisMonth = sales
        .filter((sale) => isThisMonth(sale.created_at))
        .reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0);

      const expensesThisMonth = expenses
        .filter((expense) => isThisMonth(expense.created_at))
        .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

      const costOfGoodsSold = sales.reduce(
        (sum, sale) =>
          sum +
          Number(sale.unit_cost || 0) * Number(sale.quantity || 0),
        0
      );

      const profitAvailable =
        sales.length > 0 &&
        sales.every(
          (sale) =>
            Number.isFinite(Number(sale.unit_cost)) &&
            Number(sale.unit_cost) > 0
        );

      setReport({
        businessName: businessResult.data.name,
        currency: businessResult.data.currency || "UGX",
        sales,
        expenses,
        totalSales,
        totalExpenses,
        totalDebts,
        salesToday,
        salesThisMonth,
        expensesThisMonth,
        unitsSold: sales.reduce(
          (sum, sale) => sum + Number(sale.quantity || 0),
          0
        ),
        costOfGoodsSold,
        profitAvailable,
      });

      const sevenDays = Array.from({ length: 7 }, (_, index) => {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() - (6 - index));

        const amount = sales
          .filter(
            (sale) =>
              new Date(sale.created_at).toDateString() ===
              date.toDateString()
          )
          .reduce(
            (sum, sale) => sum + Number(sale.total_amount || 0),
            0
          );

        return {
          day: date.toLocaleDateString("en", { weekday: "short" }),
          amount,
        };
      });

      setDailySales(sevenDays);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load reports."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, []);

  const highestSale = Math.max(
    ...dailySales.map((day) => day.amount),
    1
  );

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-800 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <a href="/" className="text-blue-600 hover:underline">
          ← Back to Dashboard
        </a>

        <div className="mb-8 mt-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              SMARTBIZ Reports & Analytics
            </h1>
            <p className="mt-2 text-slate-500">
              {report?.businessName || "Your Business"} — Business performance
              overview
            </p>
          </div>

          <button
            onClick={loadReports}
            disabled={loading}
            className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Refresh Reports"}
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-xl bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {loading && (
          <div className="mb-6 rounded-xl bg-blue-50 p-4 text-blue-800">
            Loading your business reports...
          </div>
        )}

        {report && (
          <>
            <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Total Sales",
                  value: money(report.totalSales),
                  color: "text-blue-700",
                },
                {
                  label: "Total Expenses",
                  value: money(report.totalExpenses),
                  color: "text-orange-700",
                },
                {
                  label: "Outstanding Debts",
                  value: money(report.totalDebts),
                  color: "text-red-700",
                },
                {
                  label: "Units Sold",
                  value: report.unitsSold.toLocaleString(),
                  color: "text-purple-700",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <p className="text-sm text-slate-500">{item.label}</p>
                  <h2 className={`mt-3 text-2xl font-bold ${item.color}`}>
                    {item.value}
                  </h2>
                </div>
              ))}
            </section>

            <section className="mb-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Today's Sales</p>
                <h2 className="mt-3 text-2xl font-bold">
                  {money(report.salesToday)}
                </h2>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">This Month's Sales</p>
                <h2 className="mt-3 text-2xl font-bold">
                  {money(report.salesThisMonth)}
                </h2>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">
                  This Month's Expenses
                </p>
                <h2 className="mt-3 text-2xl font-bold">
                  {money(report.expensesThisMonth)}
                </h2>
              </div>
            </section>

            <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold">Seven-Day Sales Report</h2>
              <p className="mt-1 text-sm text-slate-500">
                Daily sales performance for the last seven days
              </p>

              <div className="mt-8 flex h-56 items-end justify-between gap-3 border-b border-l border-slate-200 px-2">
                {dailySales.map((day, index) => (
                  <div
                    key={index}
                    className="flex h-full flex-1 flex-col justify-end"
                  >
                    <div
                      title={money(day.amount)}
                      style={{
                        height: `${Math.max(
                          (day.amount / highestSale) * 90,
                          2
                        )}%`,
                      }}
                      className="w-full rounded-t-lg bg-blue-500"
                    />

                    <span className="mt-2 text-center text-xs text-slate-500">
                      {day.day}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold">
                Profit & Loss Overview
              </h2>

              {report.profitAvailable ? (
                <>
                  <div className="mt-5 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-sm text-slate-500">
                        Cost of Goods Sold
                      </p>
                      <p className="mt-2 text-xl font-bold">
                        {money(report.costOfGoodsSold)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-green-50 p-4">
                      <p className="text-sm text-slate-500">
                        Gross Profit
                      </p>
                      <p className="mt-2 text-xl font-bold text-green-700">
                        {money(
                          report.totalSales - report.costOfGoodsSold
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl bg-blue-50 p-4">
                      <p className="text-sm text-slate-500">
                        Net Profit
                      </p>
                      <p className="mt-2 text-xl font-bold text-blue-700">
                        {money(
                          report.totalSales -
                            report.costOfGoodsSold -
                            report.totalExpenses
                        )}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-xs text-slate-500">
                    Calculated from recorded sales costs and all recorded
                    expenses.
                  </p>
                </>
              ) : (
                <div className="mt-5 rounded-xl bg-amber-50 p-5 text-sm text-amber-900">
                  Profit figures are not yet available. Some sales do not
                  have a recorded product cost. We will update the Sales
                  section to save the actual buying price with each sale
                  before showing profit figures.
                </div>
              )}
            </section>

            <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-5 text-xl font-bold">Recent Sales</h2>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead>
                    <tr className="border-b text-slate-500">
                      <th className="pb-3">Product</th>
                      <th className="pb-3">Quantity</th>
                      <th className="pb-3">Amount</th>
                      <th className="pb-3">Payment</th>
                      <th className="pb-3">Date</th>
                    </tr>
                  </thead>

                  <tbody>
                    {report.sales.slice(0, 10).map((sale) => (
                      <tr key={sale.id} className="border-b border-slate-100">
                        <td className="py-3">
                          {sale.product_name || "Sale"}
                        </td>
                        <td className="py-3">{sale.quantity}</td>
                        <td className="py-3 font-semibold">
                          {money(Number(sale.total_amount || 0))}
                        </td>
                        <td className="py-3">
                          {sale.payment_status || "Recorded"}
                        </td>
                        <td className="py-3 text-slate-500">
                          {new Date(sale.created_at).toLocaleDateString(
                            "en-GB"
                          )}
                        </td>
                      </tr>
                    ))}

                    {report.sales.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-6 text-center text-slate-500"
                        >
                          No sales records yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-5 text-xl font-bold">Recent Expenses</h2>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px] text-left text-sm">
                  <thead>
                    <tr className="border-b text-slate-500">
                      <th className="pb-3">Category</th>
                      <th className="pb-3">Amount</th>
                      <th className="pb-3">Date</th>
                    </tr>
                  </thead>

                  <tbody>
                    {report.expenses.slice(0, 10).map((expense) => (
                      <tr
                        key={expense.id}
                        className="border-b border-slate-100"
                      >
                        <td className="py-3">{expense.category}</td>
                        <td className="py-3 font-semibold">
                          {money(Number(expense.amount || 0))}
                        </td>
                        <td className="py-3 text-slate-500">
                          {new Date(expense.created_at).toLocaleDateString(
                            "en-GB"
                          )}
                        </td>
                      </tr>
                    ))}

                    {report.expenses.length === 0 && (
                      <tr>
                        <td
                          colSpan={3}
                          className="py-6 text-center text-slate-500"
                        >
                          No expense records yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        <footer className="pb-5 text-center text-xs text-slate-400">
          SMARTBIZ Reports · Development Version 0.3.0
        </footer>
      </div>
    </main>
  );
}
