"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { APPLICATION_ERRORS, APPLICATION_STATUSES } from "./_lib/errors";
import { getCallerContext, checkEmployeeAccess } from "./_lib/caller";

// Lists leave applications. Members see their own; Admin/HR can see all.
export async function listLeaveApplicationAction(filters?: {
  status?: string;
  employeeId?: number;
}) {
  try {
    const db = await createClient();
    const ctx = await getCallerContext(db);
    if (!ctx) return { success: false, error: APPLICATION_ERRORS.notSignedIn };

    // Members are locked to their linked employee; Admin/HR can filter.
    let scopeEmployeeId: number | undefined;
    if (ctx.isAuthorized) {
      if (filters?.employeeId != null) scopeEmployeeId = Number(filters.employeeId);
    } else {
      if (ctx.employeeId === null) {
        return { success: false, error: APPLICATION_ERRORS.noLinkedEmployee };
      }
      scopeEmployeeId = Number(ctx.employeeId);
    }

    if (
      filters?.status &&
      !(APPLICATION_STATUSES as readonly string[]).includes(filters.status)
    ) {
      return { success: false, error: APPLICATION_ERRORS.invalidStatus };
    }

    const adminClient = await createAdminClient();

    let query = adminClient
      .from("employee_leaves")
      .select("id, employee_id, start_date, end_date, leave_type_id, note, status, created_at")
      .order("created_at", { ascending: false });
    if (scopeEmployeeId !== undefined) query = query.eq("employee_id", scopeEmployeeId);
    if (filters?.status) query = query.eq("status", filters.status);

    const { data: leaves, error } = await query;
    if (error) return { success: false, error: error.message };

    // Direct Set Leave rows have no form row, so only leaves with one are kept.
    const leaveIds = (leaves || []).map((l: { id: number }) => Number(l.id));
    if (leaveIds.length === 0) return { success: true, data: [] };

    const { data: apps, error: appsError } = await adminClient
      .from("leave_applications")
      .select("leave_id, applicant_name, date_filed, beginning_balance, leave_taken, allowable_leave")
      .in("leave_id", leaveIds);
    if (appsError) return { success: false, error: appsError.message };

    const appByLeaveId = new Map<number, Record<string, unknown>>(
      (apps || []).map((a: { leave_id: number }) => [Number(a.leave_id), a])
    );

    const { data: types } = await adminClient
      .from("leave_type_policies")
      .select("id, name");
    const typeName = new Map<number, string>(
      (types || []).map((t: { id: number; name: string }) => [Number(t.id), t.name])
    );

    const rows = (leaves || [])
      .filter((l: { id: number }) => appByLeaveId.has(Number(l.id)))
      .map((l: { id: number; leave_type_id: number }) => {
        const app = appByLeaveId.get(Number(l.id)) as {
          applicant_name: string;
          date_filed: string;
          beginning_balance: string | number;
          leave_taken: string | number;
          allowable_leave: string | number;
        };
        return {
          ...l,
          leave_type_name: typeName.get(Number(l.leave_type_id)) || "Unknown",
          applicant_name: app.applicant_name,
          date_filed: app.date_filed,
          beginning_balance: Number(app.beginning_balance),
          leave_taken: Number(app.leave_taken),
          allowable_leave: Number(app.allowable_leave),
        };
      });

    // Pending first. Within each group, newest stays first (sort keeps the query's order).
    rows.sort(
      (a: { status: string }, b: { status: string }) =>
        Number(b.status === "pending") - Number(a.status === "pending")
    );

    return { success: true, data: rows };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : APPLICATION_ERRORS.loadFailed,
    };
  }
}

// Loads one application's full details for the detail/print page.
export async function getLeaveApplicationDetailAction(leaveId: number) {
  try {
    const db = await createClient();
    const ctx = await getCallerContext(db);
    if (!ctx) return { success: false, error: APPLICATION_ERRORS.notSignedIn };

    const id = Number(leaveId);
    if (!Number.isInteger(id) || id <= 0) {
      return { success: false, error: APPLICATION_ERRORS.notFound };
    }

    const adminClient = await createAdminClient();

    const { data: leave } = await adminClient
      .from("employee_leaves")
      .select("id, employee_id, start_date, end_date, leave_type_id, note, status, created_by, created_at, reviewed_by, reviewed_at, review_note")
      .eq("id", id)
      .maybeSingle();

    // Not-yours is reported as "not found" so members can't probe for other IDs.
    if (!leave || checkEmployeeAccess(ctx, Number(leave.employee_id)) !== null) {
      return { success: false, error: APPLICATION_ERRORS.notFound };
    }

    // A direct Set Leave row has no form row, so it has no detail page.
    const { data: application } = await adminClient
      .from("leave_applications")
      .select("*")
      .eq("leave_id", id)
      .maybeSingle();
    if (!application) return { success: false, error: APPLICATION_ERRORS.notFound };

    const { data: days } = await adminClient
      .from("employee_leave_days")
      .select("leave_date, day_value")
      .eq("leave_id", id)
      .order("leave_date", { ascending: true });

    const { data: type } = await adminClient
      .from("leave_type_policies")
      .select("id, name")
      .eq("id", Number(leave.leave_type_id))
      .maybeSingle();

    const { data: settings } = await adminClient
      .from("system_settings")
      .select("company_name, company_address, company_phones, company_email, form_title, signatory_name, signatory_title")
      .eq("id", 1)
      .maybeSingle();

    return {
      success: true,
      data: {
        leave: { ...leave, leave_type_name: type?.name ?? "Unknown" },
        application: {
          ...application,
          beginning_balance: Number(application.beginning_balance),
          leave_taken: Number(application.leave_taken),
          allowable_leave: Number(application.allowable_leave),
        },
        days: (days || []).map((d: { leave_date: string; day_value: string | number }) => ({
          leave_date: d.leave_date,
          day_value: Number(d.day_value),
        })),
        // Print code applies the paper-form fallbacks when these are null.
        settings: settings ?? null,
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : APPLICATION_ERRORS.loadFailed,
    };
  }
}