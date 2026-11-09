"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { validDateRange } from "@/app/dashboard/attendance/date-range";
import {
  checkIsAdminOrHr,
  revalidateAttendancePaths,
} from "@/app/dashboard/attendance/admin";
import { getPool } from "@/lib/db";
import { buildLeaveDayRows, sumDayValues } from "@/utils/leave-day-calculator";
import {
  getLeaveBalanceForLeaveType,
  computeApplicationSnapshots,
} from "@/utils/leave-balance";
import { revalidatePath } from "next/cache";
import { APPLICATION_ERRORS } from "./_lib/errors";
import { getCallerContext, checkEmployeeAccess } from "./_lib/caller";
import {
  hasApplicationOverlap,
  loadHolidayDateSet,
  isActiveLeaveType,
} from "./_lib/queries";
import { insertPendingApplicationWithDays } from "./_lib/insert-application";

// Submits a leave application. Members apply for themselves; Admin/HR can apply for anyone.
export async function submitLeaveApplicationAction(payload: {
  employee_id: number;
  start_date: string;
  end_date: string;
  leave_type_id: number;
  note: string;
  applicant_name: string;
  position?: string | null;
  department?: string | null;
  halfDayDates?: string[];
}) {
  try {
    const db = await createClient();

    const ctx = await getCallerContext(db);
    if (!ctx) return { success: false, error: APPLICATION_ERRORS.notSignedIn };

    const employeeId = Number(payload.employee_id);
    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      return { success: false, error: APPLICATION_ERRORS.notOwnEmployee };
    }
    const accessError = checkEmployeeAccess(ctx, employeeId);
    if (accessError) return { success: false, error: accessError };

    const dateError = validDateRange(payload.start_date, payload.end_date);
    if (dateError) return { success: false, error: dateError };

    // The insert helper assumes already-trimmed values.
    const note = payload.note?.trim() ?? "";
    if (!note) return { success: false, error: APPLICATION_ERRORS.noteRequired };

    const applicantName = payload.applicant_name?.trim() ?? "";
    if (!applicantName) {
      return { success: false, error: APPLICATION_ERRORS.nameRequired };
    }

    const adminClient = await createAdminClient();

    if (!(await isActiveLeaveType(adminClient, payload.leave_type_id))) {
      return { success: false, error: APPLICATION_ERRORS.invalidLeaveType };
    }

    // Fast early exit. The transaction re-checks this under a row lock.
    if (
      await hasApplicationOverlap(
        adminClient,
        employeeId,
        payload.start_date,
        payload.end_date
      )
    ) {
      return { success: false, error: APPLICATION_ERRORS.overlap };
    }

    // Holidays are loaded (not rejected), then the transaction runs.
    const holidayDates = await loadHolidayDateSet(
      adminClient,
      payload.start_date,
      payload.end_date
    );

    const { error, leaveId } = await insertPendingApplicationWithDays({
      employee_id: employeeId,
      start_date: payload.start_date,
      end_date: payload.end_date,
      leave_type_id: payload.leave_type_id,
      note,
      created_by: ctx.userId,
      applicant_name: applicantName,
      position: payload.position?.trim() || null,
      department: payload.department?.trim() || null,
      halfDayDates: (payload.halfDayDates ?? []).map((d) => d.substring(0, 10)),
      holidayDates,
    });
    if (error) return { success: false, error };

    revalidateAttendancePaths();
    revalidatePath("/dashboard/leave-requests");
    return { success: true, leaveId };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : APPLICATION_ERRORS.submitFailed,
    };
  }
}

// Admin/HR only. Deletes a pending application (and its related rows).
export async function deletePendingApplicationAction(leaveId: number) {
  try {
    const db = await createClient();

    if (!(await checkIsAdminOrHr(db))) {
      return { success: false, error: APPLICATION_ERRORS.deleteUnauthorized };
    }

    const id = Number(leaveId);
    if (!Number.isInteger(id) || id <= 0) {
      return { success: false, error: APPLICATION_ERRORS.notFound };
    }

    const adminClient = await createAdminClient();
    const { data: leave } = await adminClient
      .from("employee_leaves")
      .select("id, status")
      .eq("id", id)
      .maybeSingle();
    if (!leave) return { success: false, error: APPLICATION_ERRORS.notFound };
    if (leave.status !== "pending") {
      return { success: false, error: APPLICATION_ERRORS.notPending };
    }

    // The status condition is repeated in the DELETE, so an approval between
    // the check and this line deletes nothing. CASCADE removes day and form rows.
    const [result] = await getPool().query(
      "DELETE FROM employee_leaves WHERE id = ? AND status = 'pending'",
      [id]
    );
    if ((result as { affectedRows: number }).affectedRows === 0) {
      return { success: false, error: APPLICATION_ERRORS.notPending };
    }

    revalidateAttendancePaths();
    revalidatePath("/dashboard/leave-requests");
    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : APPLICATION_ERRORS.deleteFailed,
    };
  }
}

// Calculates days and balances for the form before submit. Does not save anything.
export async function previewLeaveDaysAction(payload: {
  employee_id: number;
  start_date: string;
  end_date: string;
  leave_type_id: number;
  halfDayDates?: string[];
}) {
  try {
    const db = await createClient();
    const ctx = await getCallerContext(db);
    if (!ctx) return { success: false, error: APPLICATION_ERRORS.notSignedIn };

    const employeeId = Number(payload.employee_id);
    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      return { success: false, error: APPLICATION_ERRORS.notOwnEmployee };
    }
    const accessError = checkEmployeeAccess(ctx, employeeId);
    if (accessError) return { success: false, error: accessError };

    const dateError = validDateRange(payload.start_date, payload.end_date);
    if (dateError) return { success: false, error: dateError };

    const adminClient = await createAdminClient();
    if (!(await isActiveLeaveType(adminClient, payload.leave_type_id))) {
      return { success: false, error: APPLICATION_ERRORS.invalidLeaveType };
    }

    const holidayDates = await loadHolidayDateSet(
      adminClient,
      payload.start_date,
      payload.end_date
    );

    const rows = buildLeaveDayRows({
      startDate: payload.start_date,
      endDate: payload.end_date,
      halfDayDates: (payload.halfDayDates ?? []).map((d) => d.substring(0, 10)),
      holidayDates,
    });

    // Same rule as submit, so the form can't show a total that submit would reject.
    if (rows.length === 0) {
      return { success: false, error: APPLICATION_ERRORS.noWorkdays };
    }

    const leaveTaken = sumDayValues(rows);
    const balance = await getLeaveBalanceForLeaveType({
      employeeId,
      year: Number(payload.start_date.slice(0, 4)), // start year, same as submit
      leaveTypeId: payload.leave_type_id,
    });
    const snapshots = computeApplicationSnapshots({
      beginningBalance: balance.remainingBalance,
      leaveTaken,
    });

    return {
      success: true,
      data: {
        rows,
        totalDays: leaveTaken,
        halfDayCandidates: rows.map((r) => r.leave_date),
        beginning_balance: snapshots.beginning_balance,
        leave_taken: snapshots.leave_taken,
        allowable_leave: snapshots.allowable_leave,
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : APPLICATION_ERRORS.previewFailed,
    };
  }
}