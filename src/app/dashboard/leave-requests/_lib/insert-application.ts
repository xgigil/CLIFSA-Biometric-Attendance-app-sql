import { getPool } from "@/lib/db";
import { buildLeaveDayRows, sumDayValues } from "@/utils/leave-day-calculator";
import {
  getLeaveBalanceForLeaveType,
  computeApplicationSnapshots,
  type QueryExecutor,
} from "@/utils/leave-balance";
import { APPLICATION_ERRORS } from "./errors";

export type PendingApplicationPayload = {
  employee_id: number;
  start_date: string;
  end_date: string;
  leave_type_id: number;
  note: string;
  created_by: string | null;
  applicant_name: string;
  position: string | null;
  department: string | null;
  halfDayDates: string[];
  holidayDates: Set<string>;
};

// Saves a pending leave, its day rows, and the form snapshot in one DB transaction.
export async function insertPendingApplicationWithDays(
  payload: PendingApplicationPayload
): Promise<{ error: string | null; leaveId?: number }> {
  const rows = buildLeaveDayRows({
    startDate: payload.start_date,
    endDate: payload.end_date,
    halfDayDates: payload.halfDayDates,
    holidayDates: payload.holidayDates,
  });

  // Reject only when nothing would be charged.
  if (rows.length === 0) return { error: APPLICATION_ERRORS.noWorkdays };

  const leaveTaken = sumDayValues(rows);
  // Year-spanning leaves: beginning_balance uses the START year while
  // leave_taken covers all days. Intentional. Do not "fix" it here.
  const year = Number(payload.start_date.slice(0, 4));

  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();

    // Serialize concurrent submits for the same employee.
    await conn.query(
      "SELECT employee_id FROM employees WHERE employee_id = ? FOR UPDATE",
      [payload.employee_id]
    );
    const [overlapRows] = await conn.query(
      `SELECT id FROM employee_leaves
        WHERE employee_id = ? AND status IN ('pending', 'approved')
          AND start_date <= ? AND end_date >= ?
        LIMIT 1`,
      [payload.employee_id, payload.end_date, payload.start_date]
    );
    if ((overlapRows as unknown[]).length > 0) {
      await conn.rollback();
      return { error: APPLICATION_ERRORS.overlap };
    }

    const balance = await getLeaveBalanceForLeaveType({
      employeeId: payload.employee_id,
      year,
      leaveTypeId: payload.leave_type_id,
      executor: conn as unknown as QueryExecutor,
    });
    const snapshots = computeApplicationSnapshots({
      beginningBalance: balance.remainingBalance,
      leaveTaken,
    });

    const [result] = await conn.query(
      `INSERT INTO employee_leaves
         (employee_id, start_date, end_date, leave_type_id, note, status, created_by)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      [
        payload.employee_id,
        payload.start_date,
        payload.end_date,
        payload.leave_type_id,
        payload.note,
        payload.created_by,
      ]
    );
    const leaveId = Number((result as { insertId: number }).insertId);

    await conn.query(
      `INSERT INTO employee_leave_days (leave_id, leave_date, day_value) VALUES ?`,
      [rows.map((r) => [leaveId, r.leave_date, r.day_value])]
    );
    await conn.query(
      `INSERT INTO leave_applications
         (leave_id, applicant_name, date_filed, position, department,
          beginning_balance, leave_taken, allowable_leave)
       VALUES (?, ?, NOW(), ?, ?, ?, ?, ?)`,
      [
        leaveId,
        payload.applicant_name,
        payload.position,
        payload.department,
        snapshots.beginning_balance,
        snapshots.leave_taken,
        snapshots.allowable_leave,
      ]
    );

    await conn.commit();
    return { error: null, leaveId };
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // ignore rollback errors
    }
    return { error: err instanceof Error ? err.message : String(err) };
  } finally {
    conn.release();
  }
}