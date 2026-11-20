
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function SetupBusiness() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [currency, setCurrency] = useState("UGX");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function registerBusiness(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError || !sessionData.session) {
      setMessage("Please log in before registering your business.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.rpc(
      "create_business_for_current_user",
      {
        p_name: businessName,
        p_currency: currency,
      }
    );

    if (error) {
      setMessage("Registration failed: " + error.message);
      setLoading(false);
      return;
    }

    setMessage("Business registered successfully!");
    setLoading(false);

    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-5">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-3xl font-bold text-blue-800">
          SMARTBIZ
        </h1>

        <h2 className="mt-5 text-2xl font-bold text-slate-900">
          Register Your Business
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Enter your business information to get started.
        </p>

        <form onSubmit={registerBusiness} className="mt-7 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-semibold">
              Business Name
            </label>

            <input
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Enter your business name"
              className="w-full rounded-lg border border-slate-300 p-3 outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">
              Business Currency
            </label>

            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-3"
            >
              <option value="UGX">Ugandan Shilling (UGX)</option>
              <option value="USD">US Dollar (USD)</option>
              <option value="KES">Kenyan Shilling (KES)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-700 p-3 font-bold text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {loading ? "Registering..." : "REGISTER BUSINESS"}
          </button>
        </form>

        {message && (
          <p className="mt-5 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
            {message}
          </p>
        )}
      </div>
    </main>
  );
}
