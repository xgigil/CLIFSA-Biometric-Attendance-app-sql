import type { createAdminClient } from "@/lib/supabase/server";
import { expandHolidayRanges } from "@/utils/leave-day-calculator";

export type AdminDb = Awaited<ReturnType<typeof createAdminClient>>;

// Pending or approved leave already covering part of the range?
export async function hasApplicationOverlap(
  adminClient: AdminDb,
  employee_id: number,
  start_date: string,
  end_date: string
): Promise<boolean> {
  const { data: existing } = await adminClient
    .from("employee_leaves")
    .select("id")
    .eq("employee_id", employee_id)
    .in("status", ["pending", "approved"])
    .lte("start_date", end_date)
    .gte("end_date", start_date);
  return !!(existing && existing.length > 0);
}

// Loads holiday dates in the range so workdays can skip them.
export async function loadHolidayDateSet(
  adminClient: AdminDb,
  start_date: string,
  end_date: string
): Promise<Set<string>> {
  const { data: holidays } = await adminClient
    .from("company_holidays")
    .select("start_date, end_date")
    .lte("start_date", end_date)
    .gte("end_date", start_date);
  return expandHolidayRanges(holidays || []);
}

// Does this leave type exist and is it still active?
export async function isActiveLeaveType(
  adminClient: AdminDb,
  leaveTypeId: number
): Promise<boolean> {
  if (!Number.isInteger(leaveTypeId) || leaveTypeId <= 0) return false;
  const { data, error } = await adminClient
    .from("leave_type_policies")
    .select("id")
    .eq("id", leaveTypeId)
    .eq("is_active", true);
  return !error && !!data && data.length > 0;
}