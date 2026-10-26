"use server"

import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
checkIsAdminOrHr,
revalidateAttendancePaths,
} from "@/app/dashboard/attendance/admin";
import { getPool } from "@/lib/db";
import { getLeaveBalanceForLeaveType } from "@/utils/leave-balance";
import { revalidatePath } from "next/cache";
import { APPLICATION_ERRORS } from "./_lib/errors";
import { getCallerContext } from "./_lib/caller";
import { hasApprovedOverlap } from "./_lib/queries";

const NOTE_MAX = 255;

// mysql2 can return DATE columns as Date objects or strings; normalize to YYYY-MM-DD.
function toDateString(value: unknown): string {
	if (value instanceof Date) {
			const y = value.getFullYear();
			const m = String(value.getMonth() + 1).padStart(2, "0");
			const d = String(value.getDate()).padStart(2, "0");
			return `${y}-${m}-${d}`;
	}
	return String(value).substring(0, 10);
}

// Admin/HR only. Approves or denies a pending application.
// Only employee_leaves is updated: no day rows or form rows are touched.
export async function reviewLeaveRequestAction(payload: {
	leaveId: number;
	decision: "approved" | "denied";
	review_note?: string;
}) {
	try {
		const db = await createClient();

		if (!(await checkIsAdminOrHr(db))) {
			return { success: false, error: APPLICATION_ERRORS.reviewUnauthorized };
		}

		// UserId is needed for reviewed_by
		const ctx = await getCallerContext(db);
		if (!ctx) {
			return { success: false, error: APPLICATION_ERRORS.reviewUnauthorized };
		}

		const decision = payload.decision;
		if (decision !== "approved" && decision !== "denied") {
			return { success: false, error: APPLICATION_ERRORS.invalidDecision };
		}

		const note = payload.review_note?.trim() || null;
		if (note && note.length > NOTE_MAX) {
			return { success: false, error: APPLICATION_ERRORS.noteTooLong };
		}

		const id = Number(payload.leaveId);
		if (!Number.isInteger(id) || id <= 0) {
			return { success: false, error: APPLICATION_ERRORS.notFound };
		}

		const adminClient = await createAdminClient();

		const { data: leave } = await adminClient
			.from("employee_leaves")
			.select("id, employee_id, start_date, end_date, leave_type_id, status")
			.eq("id", id)
			.maybeSingle();
		if (!leave) {
			return { success: false, error: APPLICATION_ERRORS.notFound };
		}

		const { data: application } = await adminClient
			.from("leave_applications")
			.select("id, leave_taken")
			.eq("leave_id", id)
			.maybeSingle();
		if (!application) {
			return { success: false, error: APPLICATION_ERRORS.notFound };
		}

		if (leave.status !== "pending") {
			return { success: false, error: APPLICATION_ERRORS.reviewNotPending };
		}

		let balanceWarning: string | undefined;

		if (decision === "approved") {
			const startDate = toDateString(leave.start_date);
			const endDate = toDateString(leave.end_date);

			if (await hasApprovedOverlap(adminClient, Number(leave.employee_id), startDate, endDate, id)) {
				return { success: false, error: APPLICATION_ERRORS.approvedOverlap };
			}

			// Check the balance BEFORE approving, or this leave's days get counted twice.
			// A low balance only shows a warning; it never stops the approval.
			const balance = await getLeaveBalanceForLeaveType({
        employeeId: Number(leave.employee_id),
        year: Number(startDate.slice(0, 4)), // start year, same as submit
        leaveTypeId: Number(leave.leave_type_id),
			});

			const leaveTaken = Number(application.leave_taken);
      if (balance.remainingBalance < leaveTaken) {
        balanceWarning = `Approved, but the remaining balance (${balance.remainingBalance}) is lower than the days taken (${leaveTaken}).`;
      }
		}

		// Checks "pending" again in the UPDATE, in case someone else
		// already approved, denied, or deleted this leave. If so, nothing changes.
    const [result] = await getPool().query(
      "UPDATE employee_leaves SET status = ?, reviewed_by = ?, reviewed_at = NOW(), review_note = ? WHERE id = ? AND status = 'pending'",
      [decision, ctx.userId, note, id]
    );
    if ((result as { affectedRows: number }).affectedRows === 0) {
      return { success: false, error: APPLICATION_ERRORS.reviewNotPending };
    }
 
    revalidateAttendancePaths();
    revalidatePath("/dashboard/leave-requests");
    return { success: true, balanceWarning };

	} catch (err: unknown) {
		return {
      success: false,
      error:
        err instanceof Error ? err.message : APPLICATION_ERRORS.reviewFailed,
    };
	}
}