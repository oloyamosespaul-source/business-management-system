
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Sale = {
  id: string;
  product_name: string | null;
  quantity: number;
  total_amount: number;
  payment_status: string | null;
  created_at: string;
};

type DashboardData = {
  businessName: string;
  currency: string;
  sales: Sale[];
  totalSales: number;
  totalExpenses: number;
  totalStock: number;
  totalDebts: number;
};

const navigation = [
  { label: "Dashboard", href: "/" },
  { label: "Sales", href: "/sales" },
  { label: "Inventory", href: "/inventory" },
  { label: "Expenses", href: "/expenses" },
  { label: "Customers", href: "/customers" },
  { label: "Customers & Debts", href: "/debts" },
  { label: "Reports", href: "/reports" },
];

export default function Home() {
  const router = useRouter();

  const [active, setActive] = useState("Dashboard");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");
  const [lastSevenDays, setLastSevenDays] = useState<
    { day: string; amount: number }[]
  >([]);

  async function handleLogout() {
    setLoggingOut(true);
    setError("");

    const { error } = await supabase.auth.signOut();

    if (error) {
      setError(error.message);
      setLoggingOut(false);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  async function loadDashboard() {
    setLoading(true);
    setError("");

    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError || !userData.user) {
        router.replace("/login");
        return;
      }

      const { data: member, error: memberError } = await supabase
        .from("business_members")
        .select("business_id")
        .eq("user_id", userData.user.id)
        .limit(1)
        .maybeSingle();

      if (memberError) throw memberError;

      if (!member) {
        throw new Error(
          "No business found. Please register your business first."
        );
      }

      const { data: business, error: businessError } = await supabase
        .from("businesses")
        .select("name, currency")
        .eq("id", member.business_id)
        .single();

      if (businessError) throw businessError;

      const [
        salesResult,
        expensesResult,
        productsResult,
        debtsResult,
      ] = await Promise.all([
        supabase
          .from("sales")
          .select(
            "id, product_name, quantity, total_amount, payment_status, created_at"
          )
          .eq("business_id", member.business_id)
          .order("created_at", { ascending: false }),

        supabase
          .from("expenses")
          .select("amount")
          .eq("business_id", member.business_id),

        supabase
          .from("products")
          .select("quantity")
          .eq("business_id", member.business_id),

        supabase
          .from("debts")
          .select("amount, amount_paid")
          .eq("business_id", member.business_id),
      ]);

      if (salesResult.error) throw salesResult.error;
      if (expensesResult.error) throw expensesResult.error;
      if (productsResult.error) throw productsResult.error;
      if (debtsResult.error) throw debtsResult.error;

      const sales = (salesResult.data || []) as Sale[];

      setDashboard({
        businessName: business.name,
        currency: business.currency || "UGX",
        sales,

        totalSales: sales.reduce(
          (sum, sale) => sum + Number(sale.total_amount || 0),
          0
        ),

        totalExpenses: (expensesResult.data || []).reduce(
          (sum, item) => sum + Number(item.amount || 0),
          0
        ),

        totalStock: (productsResult.data || []).reduce(
          (sum, item) => sum + Number(item.quantity || 0),
          0
        ),

        totalDebts: (debtsResult.data || []).reduce(
          (sum, item) =>
            sum +
            Number(item.amount || 0) -
            Number(item.amount_paid || 0),
          0
        ),
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load dashboard."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();

      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));

      const amount = (dashboard?.sales || [])
        .filter((sale) => {
          const saleDate = new Date(sale.created_at);
          return saleDate.toDateString() === date.toDateString();
        })
        .reduce(
          (sum, sale) => sum + Number(sale.total_amount || 0),
          0
        );

      return {
        day: date.toLocaleDateString("en", {
          weekday: "short",
        }),
        amount,
      };
    });

    setLastSevenDays(days);
  }, [dashboard]);

  function money(amount: number) {
    return `${dashboard?.currency || "UGX"} ${amount.toLocaleString(
      "en-UG",
      {
        maximumFractionDigits: 0,
      }
    )}`;
  }

  const highestSale = Math.max(
    ...lastSevenDays.map((day) => day.amount),
    1
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 md:flex">
      <aside className="w-full bg-slate-950 text-white md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col">
        <div className="border-b border-slate-800 px-5 py-5">
          <a href="/" className="block">
            <img
              src="/business-management-app-logo.png"
              alt="Business Management App Logo"
              className="mx-auto h-auto max-h-24 w-full object-contain"
            />
          </a>

          <p className="mt-3 text-center text-xs font-semibold text-slate-400">
            BUSINESS MANAGEMENT APP
          </p>
        </div>

        <div className="px-5 py-6">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Main Menu
          </p>

          <nav className="grid grid-cols-2 gap-2 md:block md:space-y-2">
            {navigation.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setActive(item.label)}
                className={`block w-full rounded-xl px-4 py-3 text-left text-sm ${
                  active === item.label
                    ? "bg-blue-600 font-semibold text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-5">
          <div className="rounded-2xl bg-slate-900 p-4">
            <p className="font-semibold">Business App Support</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              Manage your business confidently with Business Management App.
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-slate-500">
            Business Management App © 2026
          </p>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 sm:p-6 md:ml-64 lg:p-9">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">
              Business Management App / {active}
            </p>

            <h2 className="mt-1 text-2xl font-bold text-slate-900 md:text-3xl">
              Business Overview
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              {dashboard?.businessName || "Your business workspace"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={loadDashboard}
              disabled={loading || loggingOut}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Refresh Data"}
            </button>

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {loggingOut ? "Logging out..." : "Logout"}
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && (
          <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 p-5 text-blue-800">
            Loading your business information from Supabase...
          </div>
        )}

        <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Total Sales",
              value: money(dashboard?.totalSales || 0),
              icon: "↗",
              color: "bg-blue-100 text-blue-700",
            },
            {
              label: "Total Expenses",
              value: money(dashboard?.totalExpenses || 0),
              icon: "↙",
              color: "bg-orange-100 text-orange-700",
            },
            {
              label: "Available Stock",
              value: (dashboard?.totalStock || 0).toLocaleString(),
              icon: "▤",
              color: "bg-purple-100 text-purple-700",
            },
            {
              label: "Outstanding Debts",
              value: money(dashboard?.totalDebts || 0),
              icon: "◷",
              color: "bg-red-100 text-red-700",
            },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">
                  {card.label}
                </p>

                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-xl text-xl ${card.color}`}
                >
                  {card.icon}
                </span>
              </div>

              <h3 className="mt-4 text-2xl font-bold text-slate-900">
                {loading ? "..." : card.value}
              </h3>

              <p className="mt-2 text-xs text-slate-500">
                Live business records
              </p>
            </div>
          ))}
        </section>

        <section className="mb-8 grid gap-6 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
            <h3 className="font-bold text-slate-900">
              Sales Performance
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Sales recorded over the last seven days
            </p>

            <div className="mt-8 flex h-52 items-end justify-between gap-3 border-b border-l border-slate-200 px-2">
              {lastSevenDays.map((day, index) => (
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

                  <span className="mt-2 text-center text-xs text-slate-400">
                    {day.day}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-blue-700 p-6 text-white shadow-sm">
            <p className="text-sm text-blue-100">
              BUSINESS MANAGEMENT TOOLS
            </p>

            <h3 className="mt-3 text-2xl font-bold">
              Manage your business smarter.
            </h3>

            <p className="mt-3 text-sm leading-6 text-blue-100">
              Monitor sales, track stock, manage customers and understand
              your business performance in one place.
            </p>

            <div className="mt-8 rounded-xl bg-blue-600 p-4">
              <p className="text-sm text-blue-100">
                Your business workspace
              </p>

              <p className="mt-1 text-lg font-semibold">
                All in one platform
              </p>
            </div>
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="font-bold text-slate-900">
            Recent Transactions
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Your latest recorded sales
          </p>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
                  <th className="pb-4">Product</th>
                  <th className="pb-4">Quantity</th>
                  <th className="pb-4">Date</th>
                  <th className="pb-4">Amount</th>
                  <th className="pb-4">Status</th>
                </tr>
              </thead>

              <tbody>
                {(dashboard?.sales || []).slice(0, 5).map((sale) => (
                  <tr
                    key={sale.id}
                    className="border-b border-slate-50"
                  >
                    <td className="py-4 font-medium">
                      {sale.product_name || "Sale"}
                    </td>

                    <td className="py-4">{sale.quantity}</td>

                    <td className="py-4 text-slate-500">
                      {new Date(sale.created_at).toLocaleDateString(
                        "en-GB"
                      )}
                    </td>

                    <td className="py-4 font-semibold">
                      {money(Number(sale.total_amount || 0))}
                    </td>

                    <td className="py-4">
                      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                        {sale.payment_status || "Recorded"}
                      </span>
                    </td>
                  </tr>
                ))}

                {!loading && (dashboard?.sales.length || 0) === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-8 text-center text-slate-400"
                    >
                      No sales have been recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="pb-5 text-center text-xs text-slate-400">
          Business Management App · Development Version 1.0
        </footer>
      </main>
    </div>
  );
}
