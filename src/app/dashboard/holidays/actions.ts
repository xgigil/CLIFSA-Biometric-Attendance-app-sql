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
  leaveConflict:
    "Cannot set holiday: one or more employees already have approved leave in this range. Remove those leaves first.",
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
  const { data: existing } = await adminClient
    .from("company_holidays")
    .select("id")
    .lte("start_date", endDate)
    .gte("end_date", startDate);

  return !!(existing && existing.length > 0);
}

async function hasApprovedLeaveOverlappingRange(
  adminClient: Awaited<ReturnType<typeof createAdminClient>>,
  startDate: string,
  endDate: string
): Promise<boolean> {
  const { data: existing } = await adminClient
    .from("employee_leaves")
    .select("id")
    .eq("status", "approved")
    .lte("start_date", endDate)
    .gte("end_date", startDate);

  return !!(existing && existing.length > 0);
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

    if (
      await hasApprovedLeaveOverlappingRange(
        adminClient,
        payload.start_date,
        payload.end_date
      )
    ) {
      return { success: false, error: HOLIDAY_ERRORS.leaveConflict };
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
