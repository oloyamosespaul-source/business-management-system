
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Staff = {
  business_id: string;
  user_id: string;
  role: string;
  created_at: string;
};

const roles = ["manager", "cashier", "accountant", "viewer"];

export default function StaffPage() {
  const [businessId, setBusinessId] = useState("");
  const [staff, setStaff] = useState<Staff[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("cashier");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isOwner, setIsOwner] = useState(false);

  async function initialize() {
    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      setMessage("Please log in first.");
      return;
    }

    const { data: membership, error } = await supabase
      .from("business_members")
      .select("business_id, role")
      .eq("user_id", auth.user.id)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();

    if (error || !membership) {
      setMessage("Only business owners can manage staff.");
      return;
    }

    setBusinessId(membership.business_id);
    setIsOwner(true);
    await loadStaff(membership.business_id);
  }

  async function loadStaff(id: string) {
    const { data, error } = await supabase
      .from("business_members")
      .select("*")
      .eq("business_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      setMessage("Could not load staff: " + error.message);
      return;
    }

    setStaff(data || []);
  }

  useEffect(() => {
    initialize();
  }, []);

  async function performStaffAction(body: {
    action: string;
    business_id: string;
    email?: string;
    role?: string;
    user_id?: string;
  }) {
    const response = await fetch("/api/staff", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Staff operation failed.");
    }

    return result;
  }

  async function addStaff() {
    setMessage("");

    if (!email.trim() || !email.includes("@")) {
      setMessage("Please enter a valid staff email address.");
      return;
    }

    setLoading(true);

    try {
      const result = await performStaffAction({
        action: "add",
        business_id: businessId,
        email: email.trim().toLowerCase(),
        role,
      });

      setEmail("");
      setMessage(result.message);
      await loadStaff(businessId);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not add staff."
      );
    }

    setLoading(false);
  }

  async function changeRole(member: Staff, newRole: string) {
    if (member.role === "owner") return;

    setLoading(true);
    setMessage("");

    try {
      const result = await performStaffAction({
        action: "update",
        business_id: businessId,
        user_id: member.user_id,
        role: newRole,
      });

      setMessage(result.message);
      await loadStaff(businessId);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not update role."
      );
    }

    setLoading(false);
  }

  async function removeStaff(member: Staff) {
    if (member.role === "owner") return;

    const confirmed = window.confirm(
      "Are you sure you want to remove this staff member?"
    );

    if (!confirmed) return;

    setLoading(true);
    setMessage("");

    try {
      const result = await performStaffAction({
        action: "remove",
        business_id: businessId,
        user_id: member.user_id,
      });

      setMessage(result.message);
      await loadStaff(businessId);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not remove staff."
      );
    }

    setLoading(false);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f1f5f9",
        padding: 30,
      }}
    >
      <div style={{ maxWidth: 1000, margin: "auto" }}>
        <a href="/" style={{ color: "#2563eb" }}>
          ← Back to Dashboard
        </a>

        <h1 style={{ fontSize: 32, fontWeight: 800, marginTop: 20 }}>
          SMARTBIZ Staff Management
        </h1>

        <p style={{ color: "#64748b", marginBottom: 25 }}>
          Manage employees, business roles and staff access.
        </p>

        {message && (
          <div
            style={{
              background: "white",
              padding: 15,
              borderRadius: 8,
              marginBottom: 20,
            }}
          >
            {message}
          </div>
        )}

        {isOwner && (
          <>
            <section
              style={{
                background: "white",
                padding: 25,
                borderRadius: 12,
                marginBottom: 25,
              }}
            >
              <h2 style={{ fontSize: 22, fontWeight: 700 }}>
                Add Staff Member
              </h2>

              <label style={{ display: "block", marginTop: 18 }}>
                Staff Email Address
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter registered staff email"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: 13,
                  marginTop: 8,
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                }}
              />

              <label style={{ display: "block", marginTop: 18 }}>
                Assign Role
              </label>

              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={{
                  width: "100%",
                  padding: 13,
                  marginTop: 8,
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                }}
              >
                {roles.map((item) => (
                  <option key={item} value={item}>
                    {item.charAt(0).toUpperCase() + item.slice(1)}
                  </option>
                ))}
              </select>

              <button
                onClick={addStaff}
                disabled={loading || !businessId}
                style={{
                  width: "100%",
                  padding: 15,
                  marginTop: 20,
                  background: "#2563eb",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {loading ? "Processing..." : "ADD STAFF MEMBER"}
              </button>
            </section>

            <section
              style={{
                background: "white",
                padding: 25,
                borderRadius: 12,
              }}
            >
              <h2 style={{ fontSize: 22, fontWeight: 700 }}>
                Business Staff
              </h2>

              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    marginTop: 20,
                    minWidth: 550,
                  }}
                >
                  <thead>
                    <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                      <th style={{ padding: 12 }}>User ID</th>
                      <th style={{ padding: 12 }}>Role</th>
                      <th style={{ padding: 12 }}>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {staff.map((member) => (
                      <tr key={member.user_id}>
                        <td
                          style={{
                            padding: 12,
                            borderTop: "1px solid #e2e8f0",
                            fontSize: 12,
                          }}
                        >
                          {member.user_id}
                        </td>

                        <td
                          style={{
                            padding: 12,
                            borderTop: "1px solid #e2e8f0",
                          }}
                        >
                          {member.role}
                        </td>

                        <td
                          style={{
                            padding: 12,
                            borderTop: "1px solid #e2e8f0",
                          }}
                        >
                          {member.role !== "owner" ? (
                            <div
                              style={{
                                display: "flex",
                                gap: 8,
                                flexWrap: "wrap",
                              }}
                            >
                              <select
                                value={member.role}
                                disabled={loading}
                                onChange={(e) =>
                                  changeRole(member, e.target.value)
                                }
                                style={{ padding: 8, borderRadius: 6 }}
                              >
                                {roles.map((item) => (
                                  <option key={item} value={item}>
                                    {item}
                                  </option>
                                ))}
                              </select>

                              <button
                                disabled={loading}
                                onClick={() => removeStaff(member)}
                                style={{
                                  background: "#dc2626",
                                  color: "white",
                                  border: "none",
                                  padding: 8,
                                  borderRadius: 6,
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          ) : (
                            "Protected"
                          )}
                        </td>
                      </tr>
                    ))}

                    {staff.length === 0 && (
                      <tr>
                        <td colSpan={3} style={{ padding: 20 }}>
                          No staff members found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
