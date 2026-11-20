
import "server-only";

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../lib/supabaseServer";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

const allowedRoles = ["manager", "cashier", "accountant", "viewer"];

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();

    // Verify the logged-in user.
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Please log in first." },
        { status: 401 }
      );
    }

    const body = await request.json();

    const { action, business_id, email, role, user_id } = body;

    if (!business_id || typeof business_id !== "string") {
      return NextResponse.json(
        { error: "Business information is missing." },
        { status: 400 }
      );
    }

    // Confirm that the logged-in user owns this business.
    const { data: owner, error: ownerError } = await supabase
      .from("business_members")
      .select("user_id")
      .eq("business_id", business_id)
      .eq("user_id", user.id)
      .eq("role", "owner")
      .maybeSingle();

    if (ownerError || !owner) {
      return NextResponse.json(
        { error: "Only business owners can manage staff." },
        { status: 403 }
      );
    }

    // ADD STAFF
    if (action === "add") {
      const staffEmail =
        typeof email === "string"
          ? email.trim().toLowerCase()
          : "";

      if (!staffEmail || !staffEmail.includes("@")) {
        return NextResponse.json(
          { error: "Enter a valid staff email address." },
          { status: 400 }
        );
      }

      if (!allowedRoles.includes(role)) {
        return NextResponse.json(
          { error: "Invalid staff role." },
          { status: 400 }
        );
      }

      let matchingUser = null;
      let page = 1;

      while (true) {
        const { data, error } =
          await supabaseAdmin.auth.admin.listUsers({
            page,
            perPage: 1000,
          });

        if (error) {
          return NextResponse.json(
            { error: error.message },
            { status: 500 }
          );
        }

        matchingUser = data.users.find(
          (item) => item.email?.toLowerCase() === staffEmail
        );

        if (matchingUser || data.users.length < 1000) {
          break;
        }

        page++;
      }

      if (!matchingUser) {
        return NextResponse.json(
          {
            error:
              "Staff account not found. The staff member must register first.",
          },
          { status: 404 }
        );
      }

      const { error: insertError } = await supabaseAdmin
        .from("business_members")
        .insert({
          business_id,
          user_id: matchingUser.id,
          role,
        });

      if (insertError) {
        return NextResponse.json(
          { error: insertError.message },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Staff member added successfully.",
      });
    }

    // UPDATE STAFF ROLE
    if (action === "update") {
      if (!user_id || typeof user_id !== "string") {
        return NextResponse.json(
          { error: "Staff member information is missing." },
          { status: 400 }
        );
      }

      if (!allowedRoles.includes(role)) {
        return NextResponse.json(
          { error: "Invalid staff role." },
          { status: 400 }
        );
      }

      if (user_id === user.id) {
        return NextResponse.json(
          { error: "You cannot change your own owner role." },
          { status: 400 }
        );
      }

      const { data, error } = await supabaseAdmin
        .from("business_members")
        .update({ role })
        .eq("business_id", business_id)
        .eq("user_id", user_id)
        .neq("role", "owner")
        .select("user_id")
        .maybeSingle();

      if (error || !data) {
        return NextResponse.json(
          { error: error?.message || "Staff member not found or protected." },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Staff role updated successfully.",
      });
    }

    // REMOVE STAFF
    if (action === "remove") {
      if (!user_id || typeof user_id !== "string") {
        return NextResponse.json(
          { error: "Staff member information is missing." },
          { status: 400 }
        );
      }

      if (user_id === user.id) {
        return NextResponse.json(
          { error: "You cannot remove your own owner account." },
          { status: 400 }
        );
      }

      const { data, error } = await supabaseAdmin
        .from("business_members")
        .delete()
        .eq("business_id", business_id)
        .eq("user_id", user_id)
        .neq("role", "owner")
        .select("user_id")
        .maybeSingle();

      if (error || !data) {
        return NextResponse.json(
          { error: error?.message || "Staff member not found or protected." },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Staff member removed successfully.",
      });
    }

    return NextResponse.json(
      { error: "Invalid staff management action." },
      { status: 400 }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "An unexpected error occurred.";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
