"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { APPLICATION_ERRORS, APPLICATION_STATUSES } from "./_lib/errors";
import { getCallerContext, checkEmployeeAccess } from "./_lib/caller";
import { getLeaveBalance } from "@/utils/leave-balance";

// Lists leave applications. Members see their own; Admin/HR can see all.
export async function listLeaveApplicationAction(filters?: {
  status?: string | string[];
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

    // Turn whatever we received into a clean list of statuses.
    // Examples: "pending" -> ["pending"], "pending,denied" -> ["pending", "denied"],
    // nothing -> [] (which means "show every status").
    const rawStatuses = Array.isArray(filters?.status)
      ? filters.status
      : filters?.status
        ? filters.status.split(",")
        : [];
    const requestedStatuses = [
      ...new Set(rawStatuses.map((s) => s.trim()).filter(Boolean)),
    ];

    const hasInvalidStatus = requestedStatuses.some(
      (s) => !(APPLICATION_STATUSES as readonly string[]).includes(s)
    );
    if (hasInvalidStatus) {
      return { success: false, error: APPLICATION_ERRORS.invalidStatus };
    }

    const adminClient = await createAdminClient();

    let query = adminClient
      .from("employee_leaves")
      .select("id, employee_id, start_date, end_date, leave_type_id, note, status, created_at")
      .order("created_at", { ascending: false });
    if (scopeEmployeeId !== undefined) query = query.eq("employee_id", scopeEmployeeId);

    if (
      requestedStatuses.length > 0 &&
      requestedStatuses.length < APPLICATION_STATUSES.length
    ) {
      query = query.in("status", requestedStatuses);
    }

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

    let reviewedByName: string | null = null;
    if (leave.reviewed_by) {
      const { data: reviewer } = await adminClient
        .from("profiles")
        .select("name")
        .eq("id", leave.reviewed_by)
        .maybeSingle();
      reviewedByName = reviewer?.name?.trim() || null;
    }

    return {
      success: true,
      data: {
        leave: { ...leave, leave_type_name: type?.name ?? "Unknown", reviewed_by_name: reviewedByName },
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

// Retrieves an employee’s leave balances for a given year across all leave pools, 
// based on approved leave days and access permissions.
export async function getEmployeeLeaveBalancesAction(
  employeeId: number,
  year?: number
) {
  try {
    const db = await createClient();
    const ctx = await getCallerContext(db);
    if (!ctx) return { success: false, error: APPLICATION_ERRORS.notSignedIn };

    // The id must be a real positive whole number.
    const empId = Number(employeeId);
    if (!Number.isInteger(empId) || empId <= 0) {
      return { success: false, error: APPLICATION_ERRORS.notOwnEmployee };
    }

    // Same permission rule as the rest of this file: a member can only see
    // their own employee, Admin/HR can see anyone.
    const accessError = checkEmployeeAccess(ctx, empId);
    if (accessError) return { success: false, error: accessError };

    // No year given means "this calendar year".
    const targetYear = year ?? new Date().getFullYear();
    if (!Number.isInteger(targetYear) || targetYear < 1900 || targetYear > 9999) {
      return { success: false, error: APPLICATION_ERRORS.loadFailed };
    }

    // List the pools. Only need the id and name here, because
    // getLeaveBalance reads the allotment itself.
    const adminClient = await createAdminClient();
    const { data: pools, error: poolsError } = await adminClient
      .from("leave_balance_pools")
      .select("id, pool_name")
      .order("id", { ascending: true });
    if (poolsError) return { success: false, error: poolsError.message };

    // One balance per pool, all asked at the same time.
    const balances = await Promise.all(
      (pools || []).map(async (pool: { id: number; pool_name: string }) => {
        const balance = await getLeaveBalance({
          employeeId: empId,
          year: targetYear,
          poolId: Number(pool.id),
        });
        return {
          poolId: Number(pool.id),
          poolName: pool.pool_name,
          annualAllotment: balance.annualAllotment,
          usedApproved: balance.usedApproved,
          // Can be negative on purpose, so over-use stays visible.
          remainingBalance: balance.remainingBalance,
          year: balance.year,
        };
      })
    );

    return { success: true, data: balances };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : APPLICATION_ERRORS.loadFailed,
    };
  }
}