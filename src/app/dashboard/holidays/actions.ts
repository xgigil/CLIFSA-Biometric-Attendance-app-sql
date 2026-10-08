"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { validDateRange } from "@/app/dashboard/attendance/date-range";
import {
  checkIsAdmin,
  revalidateAttendancePaths,
} from "@/app/dashboard/attendance/admin";

const HOLIDAY_ERRORS = {
  unauthorized: "Unauthorized access. Admin privileges required.",
  holidayOverlap: "A company holiday already covers part of that range.",
  noteRequired: "Note is required to identify this holiday.",
  setFailed: "Failed to set holiday",
  removeFailed: "Failed to remove holiday",
  fetchFailed: "Failed to fetch holidays",
  invalidId: "Invalid holiday id.",
} as const;

async function hasHolidayOverlap(
  adminClient: Awaited<ReturnType<typeof createAdminClient>>,
  startDate: string,
  endDate: string
): Promise<boolean> {
  const { data: existing, error } = await adminClient
    .from("company_holidays")
    .select("id")
    .lte("start_date", endDate)
    .gte("end_date", startDate);

  if (error) throw new Error(error.message);
  return !!(existing && existing.length > 0);
}

type ConflictingLeave = {
  id: number;
  employee_id: number;
  employee_name: string | null;
  start_date: string;
  end_date: string;
  status: string;
};

async function findConflictingLeavesForHolidayRange(
  adminClient: Awaited<ReturnType<typeof createAdminClient>>,
  startDate: string,
  endDate: string
): Promise<ConflictingLeave[]> {
  const { data: leaves, error } = await adminClient
    .from("employee_leaves")
    .select("id, employee_id, start_date, end_date, status")
    .in("status", ["pending", "approved"])
    .lte("start_date", endDate)
    .gte("end_date", startDate);

  if (error) throw new Error(error.message);
  if (!leaves?.length) return [];

  const empIds = [...new Set(leaves.map((l: any) => l.employee_id))];
  const { data: employees, error: empError } = await adminClient
    .from("employees")
    .select("employee_id, employee_name")
    .in("employee_id", empIds);

    if (empError) throw new Error(empError.message);

  const nameById = new Map<number, string | null>(
    (employees || []).map((e: any) => [Number(e.employee_id), e.employee_name])
  );

  return leaves
    .map((l: any) => ({
      id: Number(l.id),
      employee_id: Number(l.employee_id),
      employee_name: nameById.get(Number(l.employee_id)) ?? null,
      start_date: String(l.start_date).substring(0, 10),
      end_date: String(l.end_date).substring(0, 10),
      status: String(l.status),
    }))
    .sort((a, b) => {
      const an = a.employee_name || "";
      const bn = b.employee_name || "";
      if (an !== bn) return an.localeCompare(bn);
      return a.start_date.localeCompare(b.start_date);
    });
}

function formatLeaveConflictMessage(conflicts: ConflictingLeave[]): string {
  const max = 5;
  const parts = conflicts.slice(0, max).map((c) => {
    const name = c.employee_name || `Employee #${c.employee_id}`;
    return `${name} leave ${c.start_date}–${c.end_date} (${c.status})`;
  });
  let msg = `Cannot set holiday: conflicts with ${parts.join("; ")}.`;
  const extra = conflicts.length - max;
  if (extra > 0) msg = msg.replace(/\.$/, ` and ${extra} more.`);
  return msg;
}

export async function getHolidaysForRangeAction(
  startDate: string,
  endDate: string
) {
  try {
    const dateError = validDateRange(startDate, endDate);
    if (dateError) return { success: false, error: dateError };

    const db = await createClient();
    const { data, error } = await db
      .from("company_holidays")
      .select("id, start_date, end_date, note")
      .lte("start_date", endDate)
      .gte("end_date", startDate)
      .order("start_date", { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || HOLIDAY_ERRORS.fetchFailed,
    };
  }
}

export async function setHolidayAction(payload: {
  start_date: string;
  end_date: string;
  note: string;
}) {
  try {
    const db = await createClient();
    if (!(await checkIsAdmin(db))) {
      return { success: false, error: HOLIDAY_ERRORS.unauthorized };
    }

    const dateError = validDateRange(payload.start_date, payload.end_date);
    if (dateError) return { success: false, error: dateError };

    const note = payload.note?.trim() || "";
    if (!note) {
      return { success: false, error: HOLIDAY_ERRORS.noteRequired };
    }

    const {
      data: { user },
    } = await db.auth.getUser();
    const adminClient = await createAdminClient();

    if (
      await hasHolidayOverlap(
        adminClient,
        payload.start_date,
        payload.end_date
      )
    ) {
      return { success: false, error: HOLIDAY_ERRORS.holidayOverlap };
    }

    const conflicts = await findConflictingLeavesForHolidayRange(
      adminClient,
      payload.start_date,
      payload.end_date
    );
    if (conflicts.length > 0) {
      return { success: false, error: formatLeaveConflictMessage(conflicts) };
    }

    const { error } = await adminClient.from("company_holidays").insert({
      start_date: payload.start_date,
      end_date: payload.end_date,
      note,
      created_by: user?.id || null,
    });

    if (error) return { success: false, error: error.message };

    revalidateAttendancePaths();
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || HOLIDAY_ERRORS.setFailed,
    };
  }
}

export async function removeHolidayAction(id: number) {
  try {
    if (!Number.isFinite(id) || id <= 0) {
      return { success: false, error: HOLIDAY_ERRORS.invalidId };
    }

    const db = await createClient();
    if (!(await checkIsAdmin(db))) {
      return { success: false, error: HOLIDAY_ERRORS.unauthorized };
    }

    const adminClient = await createAdminClient();
    const { error } = await adminClient
      .from("company_holidays")
      .delete()
      .eq("id", id);

    if (error) return { success: false, error: error.message };

    revalidateAttendancePaths();
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || HOLIDAY_ERRORS.removeFailed,
    };
  }
}
