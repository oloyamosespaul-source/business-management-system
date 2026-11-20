
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Customer = {
  id: string;
  business_id: string;
  name: string;
  phone: string;
  created_at: string;
};

type Sale = {
  id: string;
  customer_id: string | null;
  debt_id: string | null;
  product_name: string | null;
  quantity: number;
  total_amount: number;
  payment_status: string | null;
  created_at: string;
};

type Debt = {
  id: string;
  customer_id: string | null;
  customer_name: string;
  phone: string | null;
  amount: number;
  amount_paid: number;
  created_at: string;
};

export default function CustomersPage() {
  const [businessId, setBusinessId] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);

  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [search, setSearch] = useState("");

  const [selectedCustomer, setSelectedCustomer] =
    useState<Customer | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadRecords(id: string) {
    setLoading(true);
    setMessage("");

    try {
      const [customersResult, salesResult, debtsResult] =
        await Promise.all([
          supabase
            .from("customers")
            .select("id, business_id, name, phone, created_at")
            .eq("business_id", id)
            .order("name"),

          supabase
            .from("sales")
            .select(
              "id, customer_id, debt_id, product_name, quantity, total_amount, payment_status, created_at"
            )
            .eq("business_id", id)
            .order("created_at", { ascending: false }),

          supabase
            .from("debts")
            .select(
              "id, customer_id, customer_name, phone, amount, amount_paid, created_at"
            )
            .eq("business_id", id)
            .order("created_at", { ascending: false }),
        ]);

      if (customersResult.error) throw customersResult.error;
      if (salesResult.error) throw salesResult.error;
      if (debtsResult.error) throw debtsResult.error;

      const customerRows = [...(customersResult.data || [])] as Customer[];
      const saleRows = [...(salesResult.data || [])] as Sale[];
      const debtRows = [...(debtsResult.data || [])] as Debt[];

      // Automatically create customer profiles for new credit customers.
      for (const debt of debtRows) {
        if (debt.customer_id) continue;

        const normalizedName = debt.customer_name.trim().toLowerCase();
        const customerPhone = (debt.phone || "").trim();

        let customer = customerRows.find(
          (item) =>
            item.name.trim().toLowerCase() === normalizedName &&
            (item.phone || "").trim() === customerPhone
        );

        if (!customer) {
          const { data: newCustomer, error: insertError } =
            await supabase
              .from("customers")
              .insert({
                business_id: id,
                name: debt.customer_name.trim(),
                phone: customerPhone,
              })
              .select("id, business_id, name, phone, created_at")
              .single();

          if (insertError) {
            if (insertError.code === "23505") {
              const { data: existing, error: lookupError } =
                await supabase
                  .from("customers")
                  .select("id, business_id, name, phone, created_at")
                  .eq("business_id", id)
                  .eq("normalized_name", normalizedName)
                  .eq("phone", customerPhone)
                  .single();

              if (lookupError || !existing) {
                throw lookupError || insertError;
              }

              customer = existing as Customer;
            } else {
              throw insertError;
            }
          } else if (newCustomer) {
            customer = newCustomer as Customer;
            customerRows.push(customer);
          }
        }

        if (!customer) {
          throw new Error("Could not identify the customer profile.");
        }

        // Link the debt to its customer profile.
        const { error: debtUpdateError } = await supabase
          .from("debts")
          .update({ customer_id: customer.id })
          .eq("id", debt.id)
          .eq("business_id", id);

        if (debtUpdateError) throw debtUpdateError;

        debt.customer_id = customer.id;
      }

      // Link the sale to the same customer as its debt.
      for (const sale of saleRows) {
        if (sale.customer_id || !sale.debt_id) continue;

        const linkedDebt = debtRows.find(
          (debt) => debt.id === sale.debt_id
        );

        if (!linkedDebt?.customer_id) continue;

        const { error: saleUpdateError } = await supabase
          .from("sales")
          .update({ customer_id: linkedDebt.customer_id })
          .eq("id", sale.id)
          .eq("business_id", id);

        if (saleUpdateError) throw saleUpdateError;

        sale.customer_id = linkedDebt.customer_id;
      }

      setCustomers(customerRows);
      setSales(saleRows);
      setDebts(debtRows);

    } catch (err) {
      setMessage(
        err instanceof Error
          ? "Could not load records: " + err.message
          : "An unexpected error occurred."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function initialize() {
      const { data: authData } = await supabase.auth.getUser();

      if (!authData.user) {
        setMessage("Please log in first.");
        setLoading(false);
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
        setLoading(false);
        return;
      }

      setBusinessId(membership.business_id);
      await loadRecords(membership.business_id);
    }

    initialize();
  }, []);

  async function registerCustomer() {
    setMessage("");

    const name = customerName.trim();
    const customerPhone = phone.trim();

    if (!name) {
      setMessage("Please enter the customer's name.");
      return;
    }

    if (!businessId) {
      setMessage("Business account not found.");
      return;
    }

    setSaving(true);

    try {
      const { data: existing, error: findError } = await supabase
        .from("customers")
        .select("id")
        .eq("business_id", businessId)
        .eq("normalized_name", name.toLowerCase())
        .eq("phone", customerPhone)
        .maybeSingle();

      if (findError) throw findError;

      if (existing) {
        setMessage("This customer is already registered.");
        return;
      }

      const { data, error } = await supabase
        .from("customers")
        .insert({
          business_id: businessId,
          name,
          phone: customerPhone,
        })
        .select("id, business_id, name, phone, created_at")
        .single();

      if (error) throw error;

      setCustomerName("");
      setPhone("");

      await loadRecords(businessId);

      setSelectedCustomer(data as Customer);
      setMessage("Customer registered successfully!");

    } catch (err) {
      setMessage(
        err instanceof Error
          ? "Customer could not be saved: " + err.message
          : "An unexpected error occurred."
      );
    } finally {
      setSaving(false);
    }
  }

  const filteredCustomers = customers.filter((customer) =>
    `${customer.name} ${customer.phone}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const selectedDebts = selectedCustomer
    ? debts.filter(
        (debt) => debt.customer_id === selectedCustomer.id
      )
    : [];

  const selectedSales = selectedCustomer
    ? sales.filter(
        (sale) =>
          sale.customer_id === selectedCustomer.id ||
          selectedDebts.some((debt) => debt.id === sale.debt_id)
      )
    : [];

  const totalPurchases = selectedSales.reduce(
    (sum, sale) => sum + Number(sale.total_amount || 0),
    0
  );

  const totalOwed = selectedDebts.reduce(
    (sum, debt) =>
      sum +
      Number(debt.amount || 0) -
      Number(debt.amount_paid || 0),
    0
  );

  const totalPaid = selectedDebts.reduce(
    (sum, debt) => sum + Number(debt.amount_paid || 0),
    0
  );

  const businessOutstanding = debts.reduce(
    (sum, debt) =>
      sum +
      Number(debt.amount || 0) -
      Number(debt.amount_paid || 0),
    0
  );

  function money(amount: number) {
    return `UGX ${Number(amount).toLocaleString("en-UG", {
      maximumFractionDigits: 0,
    })}`;
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-800 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <a
          href="/"
          className="text-sm font-semibold text-blue-600 hover:underline"
        >
          ← Back to Dashboard
        </a>

        <div className="mb-8 mt-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900">
              Business Management App
            </h1>
            <p className="mt-2 text-slate-500">
              Customer Management & Directory
            </p>
          </div>

          <button
            onClick={() => loadRecords(businessId)}
            disabled={loading || !businessId}
            className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Refresh Records
          </button>
        </div>

        {message && (
          <div className="mb-6 rounded-xl bg-blue-50 p-4 text-sm font-semibold text-blue-800">
            {message}
          </div>
        )}

        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Registered Customers
            </p>
            <h2 className="mt-3 text-3xl font-bold">
              {customers.length}
            </h2>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Recorded Purchases
            </p>
            <h2 className="mt-3 text-3xl font-bold">
              {sales.length}
            </h2>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Customer Outstanding Debts
            </p>
            <h2 className="mt-3 text-2xl font-bold text-red-600">
              {money(businessOutstanding)}
            </h2>
          </div>
        </section>

        <section className="mb-8 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-xl font-bold">
            Register New Customer
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold">
                Customer Full Name
              </label>

              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter customer name"
                className="w-full rounded-lg border border-slate-300 p-3 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">
                Phone Number
              </label>

              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter phone number"
                className="w-full rounded-lg border border-slate-300 p-3 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <button
            onClick={registerCustomer}
            disabled={saving || loading}
            className="mt-5 w-full rounded-xl bg-blue-600 p-4 font-bold text-white hover:bg-blue-700 disabled:opacity-50 sm:w-auto sm:px-8"
          >
            {saving ? "Saving Customer..." : "REGISTER CUSTOMER"}
          </button>
        </section>

        <section className="mb-8 rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-xl font-bold">
              Customer Directory
            </h2>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or phone..."
              className="w-full rounded-lg border border-slate-300 p-3 sm:w-72"
            />
          </div>

          {loading ? (
            <p className="py-8 text-center text-slate-500">
              Loading customer records...
            </p>
          ) : filteredCustomers.length === 0 ? (
            <p className="py-8 text-center text-slate-500">
              No customers found. Register your first customer above.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-slate-500">
                    <th className="p-3">Customer Name</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Purchases</th>
                    <th className="p-3">Outstanding</th>
                    <th className="p-3">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredCustomers.map((customer) => {
                    const customerDebts = debts.filter(
                      (debt) => debt.customer_id === customer.id
                    );

                    const customerPurchase = sales
                      .filter(
                        (sale) =>
                          sale.customer_id === customer.id ||
                          customerDebts.some(
                            (debt) => debt.id === sale.debt_id
                          )
                      )
                      .reduce(
                        (sum, sale) =>
                          sum + Number(sale.total_amount || 0),
                        0
                      );

                    const customerBalance = customerDebts.reduce(
                      (sum, debt) =>
                        sum +
                        Number(debt.amount || 0) -
                        Number(debt.amount_paid || 0),
                      0
                    );

                    return (
                      <tr
                        key={customer.id}
                        className="border-b border-slate-100 hover:bg-slate-50"
                      >
                        <td className="p-3 font-semibold">
                          {customer.name}
                        </td>

                        <td className="p-3 text-slate-500">
                          {customer.phone || "Not provided"}
                        </td>

                        <td className="p-3">
                          {money(customerPurchase)}
                        </td>

                        <td className="p-3 font-semibold text-red-600">
                          {money(customerBalance)}
                        </td>

                        <td className="p-3">
                          <button
                            onClick={() =>
                              setSelectedCustomer(customer)
                            }
                            className="rounded-lg bg-blue-50 px-4 py-2 font-semibold text-blue-700 hover:bg-blue-100"
                          >
                            View Profile
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {selectedCustomer && (
          <section className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-blue-600">
                  CUSTOMER PROFILE
                </p>

                <h2 className="mt-1 text-2xl font-bold">
                  {selectedCustomer.name}
                </h2>

                <p className="mt-1 text-slate-500">
                  {selectedCustomer.phone || "No phone number recorded"}
                </p>
              </div>

              <button
                onClick={() => setSelectedCustomer(null)}
                className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold hover:bg-slate-200"
              >
                Close Profile
              </button>
            </div>

            <div className="mb-7 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-blue-50 p-4">
                <p className="text-sm text-slate-500">
                  Total Purchases
                </p>
                <h3 className="mt-2 text-xl font-bold text-blue-700">
                  {money(totalPurchases)}
                </h3>
              </div>

              <div className="rounded-xl bg-green-50 p-4">
                <p className="text-sm text-slate-500">
                  Credit Payments Recorded
                </p>
                <h3 className="mt-2 text-xl font-bold text-green-700">
                  {money(totalPaid)}
                </h3>
              </div>

              <div className="rounded-xl bg-red-50 p-4">
                <p className="text-sm text-slate-500">
                  Outstanding Balance
                </p>
                <h3 className="mt-2 text-xl font-bold text-red-700">
                  {money(totalOwed)}
                </h3>
              </div>
            </div>

            <h3 className="mb-4 text-lg font-bold">
              Purchase History
            </h3>

            {selectedSales.length === 0 ? (
              <p className="mb-6 text-sm text-slate-500">
                No linked purchase records found for this customer.
              </p>
            ) : (
              <div className="mb-7 overflow-x-auto">
                <table className="w-full min-w-[550px] text-left text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-slate-500">
                      <th className="p-3">Product</th>
                      <th className="p-3">Quantity</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Payment</th>
                      <th className="p-3">Date</th>
                    </tr>
                  </thead>

                  <tbody>
                    {selectedSales.map((sale) => (
                      <tr key={sale.id} className="border-b">
                        <td className="p-3 font-medium">
                          {sale.product_name || "Sale"}
                        </td>

                        <td className="p-3">
                          {sale.quantity}
                        </td>

                        <td className="p-3">
                          {money(Number(sale.total_amount))}
                        </td>

                        <td className="p-3 capitalize">
                          {sale.payment_status || "Recorded"}
                        </td>

                        <td className="p-3 text-slate-500">
                          {new Date(sale.created_at).toLocaleDateString(
                            "en-GB"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h3 className="mb-4 text-lg font-bold">
              Credit Accounts & Payments
            </h3>

            {selectedDebts.length === 0 ? (
              <p className="text-sm text-slate-500">
                This customer has no credit accounts.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px] text-left text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-slate-500">
                      <th className="p-3">Original Debt</th>
                      <th className="p-3">Total Paid</th>
                      <th className="p-3">Balance</th>
                      <th className="p-3">Date</th>
                    </tr>
                  </thead>

                  <tbody>
                    {selectedDebts.map((debt) => {
                      const balance =
                        Number(debt.amount) -
                        Number(debt.amount_paid || 0);

                      return (
                        <tr key={debt.id} className="border-b">
                          <td className="p-3">
                            {money(Number(debt.amount))}
                          </td>

                          <td className="p-3 text-green-700">
                            {money(Number(debt.amount_paid || 0))}
                          </td>

                          <td className="p-3 font-semibold text-red-600">
                            {money(balance)}
                          </td>

                          <td className="p-3 text-slate-500">
                            {new Date(debt.created_at).toLocaleDateString(
                              "en-GB"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <p className="mt-4 text-xs text-slate-400">
              Payment totals are based on cumulative amounts recorded
              in each credit account.
            </p>
          </section>
        )}

        <footer className="mt-8 pb-5 text-center text-xs text-slate-400">
          Business Management App · Customer Management
        </footer>
      </div>
    </main>
  );
}
