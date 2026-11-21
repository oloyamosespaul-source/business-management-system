
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Sale = {
  id: string;
  business_id: string;
  debt_id: string | null;
  product_name: string | null;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  total_amount: number;
  payment_status: string | null;
  created_at: string;
};

type Business = {
  name: string;
  currency: string;
};

type Debt = {
  id: string;
  customer_name: string;
  phone: string | null;
  amount: number;
  amount_paid: number;
};

export default function ReceiptClient({ saleId }: { saleId: string }) {
  const [sale, setSale] = useState<Sale | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [debt, setDebt] = useState<Debt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadReceipt() {
      try {
        const { data: authData } = await supabase.auth.getUser();

        if (!authData.user) {
          throw new Error("Please log in to view this receipt.");
        }

        const { data: saleData, error: saleError } = await supabase
          .from("sales")
          .select(
            "id, business_id, debt_id, product_name, quantity, unit_price, unit_cost, total_amount, payment_status, created_at"
          )
          .eq("id", saleId)
          .single();

        if (saleError) throw saleError;

        const { data: membership, error: memberError } = await supabase
          .from("business_members")
          .select("business_id")
          .eq("user_id", authData.user.id)
          .eq("business_id", saleData.business_id)
          .maybeSingle();

        if (memberError) throw memberError;

        if (!membership) {
          throw new Error("You are not authorized to view this receipt.");
        }

        const { data: businessData, error: businessError } =
          await supabase
            .from("businesses")
            .select("name, currency")
            .eq("id", saleData.business_id)
            .single();

        if (businessError) throw businessError;

        let debtData: Debt | null = null;

        if (saleData.debt_id) {
          const { data, error: debtError } = await supabase
            .from("debts")
            .select("id, customer_name, phone, amount, amount_paid")
            .eq("id", saleData.debt_id)
            .eq("business_id", saleData.business_id)
            .maybeSingle();

          if (debtError) throw debtError;

          debtData = data as Debt | null;
        }

        setSale(saleData as Sale);
        setBusiness(businessData as Business);
        setDebt(debtData);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not load receipt."
        );
      } finally {
        setLoading(false);
      }
    }

    if (saleId) loadReceipt();
  }, [saleId]);

  function money(value: number) {
    return `${business?.currency || "UGX"} ${Number(value).toLocaleString(
      "en-UG",
      { maximumFractionDigits: 0 }
    )}`;
  }

  const total = Number(sale?.total_amount || 0);

  const amountPaid = debt
    ? Number(debt.amount_paid || 0)
    : sale?.payment_status === "paid"
      ? total
      : null;

  const balance =
    amountPaid === null ? null : Math.max(total - amountPaid, 0);

  const paymentLabel =
    balance === null
      ? "Payment details unavailable"
      : balance === 0
        ? "Paid in Full"
        : amountPaid !== null && amountPaid > 0
          ? "Partially Paid"
          : "Unpaid / Credit";

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-8 text-center">
        Loading your receipt...
      </main>
    );
  }

  if (error || !sale || !business) {
    return (
      <main className="min-h-screen bg-slate-100 p-8">
        <p className="text-red-600">
          {error || "Receipt not found."}
        </p>

        <a href="/" className="mt-4 inline-block text-blue-600">
          Back to Dashboard
        </a>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-5 sm:p-10">
      <style>{`
        @media print {
          body {
            background: white !important;
          }

          .no-print {
            display: none !important;
          }

          .receipt-paper {
            box-shadow: none !important;
            border: none !important;
            max-width: 100% !important;
            margin: 0 !important;
          }
        }
      `}</style>

      <div className="no-print mx-auto mb-5 flex max-w-2xl flex-wrap justify-between gap-3">
        <a
          href="/"
          className="rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow"
        >
          ← Dashboard
        </a>

        <button
          onClick={() => window.print()}
          className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white shadow hover:bg-blue-700"
        >
          PRINT RECEIPT
        </button>
      </div>

      <section className="receipt-paper mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow-lg sm:p-12">
        <div className="border-b-2 border-slate-800 pb-6 text-center">
          <img
            src="/business-management-app-logo.png"
            alt="Business Management App Logo"
            className="mx-auto mb-4 h-auto max-h-28 w-full max-w-xs object-contain"
          />

          <h1 className="text-2xl font-extrabold tracking-wide text-slate-900">
            BUSINESS MANAGEMENT APP
          </h1>

          <p className="mt-2 font-semibold text-slate-700">
            {business.name}
          </p>

          <p className="mt-1 text-sm text-slate-500">
            SALES RECEIPT
          </p>
        </div>

        <div className="mt-6 flex flex-wrap justify-between gap-4 text-sm">
          <div>
            <p className="text-slate-500">Receipt Number</p>
            <p className="mt-1 font-bold">
              SB-{sale.id.slice(0, 8).toUpperCase()}
            </p>
          </div>

          <div className="text-right">
            <p className="text-slate-500">Date and Time</p>
            <p className="mt-1 font-semibold">
              {new Date(sale.created_at).toLocaleString("en-GB")}
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-lg bg-slate-50 p-4">
          <h2 className="mb-3 font-bold text-slate-800">
            Customer Information
          </h2>

          {debt ? (
            <>
              <p>
                Customer: <strong>{debt.customer_name}</strong>
              </p>

              <p className="mt-2 text-sm text-slate-600">
                Phone: {debt.phone || "Not provided"}
              </p>
            </>
          ) : sale.payment_status === "paid" ? (
            <p className="text-sm text-slate-600">
              Cash / Direct Payment
            </p>
          ) : (
            <p className="text-sm text-amber-700">
              This older sale has no linked customer debt record.
            </p>
          )}
        </div>

        <div className="mt-8">
          <h2 className="mb-3 font-bold text-slate-800">
            Sale Details
          </h2>

          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-3">Product</th>
                  <th className="p-3 text-center">Qty</th>
                  <th className="p-3 text-right">Unit Price</th>
                  <th className="p-3 text-right">Total</th>
                </tr>
              </thead>

              <tbody>
                <tr>
                  <td className="p-3 font-medium">
                    {sale.product_name || "Product"}
                  </td>

                  <td className="p-3 text-center">
                    {sale.quantity}
                  </td>

                  <td className="p-3 text-right">
                    {money(Number(sale.unit_price))}
                  </td>

                  <td className="p-3 text-right font-semibold">
                    {money(total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="ml-auto mt-8 max-w-sm space-y-3">
          <div className="flex justify-between border-b pb-3">
            <span className="text-slate-600">Total Amount</span>
            <strong>{money(total)}</strong>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-600">Payment Status</span>
            <strong>{paymentLabel}</strong>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-600">Amount Paid</span>
            <strong>
              {amountPaid === null
                ? "Unavailable"
                : money(amountPaid)}
            </strong>
          </div>

          <div className="flex justify-between border-t pt-3 text-lg">
            <span className="font-bold">Balance Due</span>
            <strong className="text-blue-700">
              {balance === null ? "Unavailable" : money(balance)}
            </strong>
          </div>
        </div>

        <div className="mt-12 border-t border-dashed border-slate-300 pt-6 text-center">
          <h3 className="text-xl font-bold text-slate-900">
            Thank You!
          </h3>

          <p className="mt-2 text-sm text-slate-500">
            Thank you for doing business with us.
          </p>

          <p className="mt-5 text-xs text-slate-400">
            Powered by Business Management App
          </p>
        </div>
      </section>
    </main>
  );
}
