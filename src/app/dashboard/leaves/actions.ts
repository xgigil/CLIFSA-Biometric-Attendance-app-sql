"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { validDateRange } from "@/app/dashboard/attendance/date-range";
import {
  checkIsAdmin,
  revalidateAttendancePaths,
} from "@/app/dashboard/attendance/admin";

const LEAVE_ERRORS = {
  unauthorized: "Unauthorized access. Admin privileges required.",
  overlap: "This employee already has a leave covering part of that range.",
  holidayConflict: "Cannot set leave on a holiday.",
  setFailed: "Failed to set leave",
  setAllFailed: "Failed to set leave for all employees",
  invalidLeaveType: "Invalid or inactive leave type.",
} as const;

type LeaveWritePayload = {
  employee_id: number;
  start_date: string;
  end_date: string;
  leave_type_id?: number;
  note?: string;
  created_by?: string | null;
};

async function hasLeaveOverlap(
  adminClient: Awaited<ReturnType<typeof createAdminClient>>,
  employee_id: number,
  start_date: string,
  end_date: string
): Promise<boolean> {
  const { data: existing } = await adminClient
    .from("employee_leaves")
    .select("id")
    .eq("employee_id", employee_id)
    .eq("status", "approved")
    .lte("start_date", end_date)
    .gte("end_date", start_date);

  return existing && existing.length > 0;
}

async function hasCompanyHolidayOverlap(
    adminClient: Awaited<ReturnType<typeof createAdminClient>>,
    start_date: string,
    end_date: string
): Promise<boolean> {
    const { data: existing } = await adminClient
    .from("company_holidays")
    .select("id")
    .lte("start_date", end_date)
    .gte("end_date", start_date);

    return !!(existing && existing.length > 0);
}

async function resolveDefaultLeaveTypeId(
  adminClient: Awaited<ReturnType<typeof createAdminClient>>
): Promise<number | null> {
  const { data, error } = await adminClient
    .from("leave_type_policies")
    .select("id")
    .eq("name", "Vacation")
    .eq("is_active", true);

  if (error || !data?.length) return null;
  return Number(data[0].id);
}

async function insertLeaveRow(
  adminClient: Awaited<ReturnType<typeof createAdminClient>>,
  payload: LeaveWritePayload
) {
  return adminClient.from("employee_leaves").insert({
    employee_id: payload.employee_id,
    start_date: payload.start_date,
    end_date: payload.end_date,
    leave_type_id: payload.leave_type_id,
    note: payload.note?.trim() || "",
    status: "approved",
    created_by: payload.created_by || null,
  });
}

export async function getLeavesForRangedAction(
  startDate: string,
  endDate: string,
  employeeId?: number
) {
  try {
    const db = await createClient();
    let query = db
      .from("employee_leaves")
      .select("id, employee_id, start_date, end_date, leave_type_id, note")
      .eq("status", "approved")
      .lte("start_date", endDate)
      .gte("end_date", startDate);

    if (employeeId) query = query.eq("employee_id", employeeId);

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };

    const { data: types, error: typesError } = await db
      .from("leave_type_policies")
      .select("id, name");

    if (typesError) return { success: false, error: typesError.message };

    const nameById = new Map<number, string>(
      (types || []).map((t: { id: number; name: string }) => [
        Number(t.id),
        t.name,
      ])
    );

    const rows = (data || []).map(
      (row: {
        id: number;
        employee_id: number;
        start_date: string;
        end_date: string;
        leave_type_id: number;
        note: string | null;
      }) => ({
        ...row,
        leave_type_name: nameById.get(Number(row.leave_type_id)) || "Unknown",
      })
    );

    return { success: true, data: rows };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch leaves" };
  }
}

export async function setLeaveAction(payload: {
  employee_id: number;
  start_date: string;
  end_date: string;
  leave_type_id?: number;
  note?: string;
}) {
  try {
    const db = await createClient();
    if (!(await checkIsAdmin(db))) {
      return { success: false, error: LEAVE_ERRORS.unauthorized };
    }

    const dateError = validDateRange(payload.start_date, payload.end_date);
    if (dateError) return { success: false, error: dateError };
    
    const { data: { user }, } = await db.auth.getUser();
    const adminClient = await createAdminClient();

    const leaveTypeId =
      payload.leave_type_id ?? (await resolveDefaultLeaveTypeId(adminClient));
  
    if (!leaveTypeId) {
      return { success: false, error: LEAVE_ERRORS.invalidLeaveType };
    }

    if (await hasCompanyHolidayOverlap(adminClient, payload.start_date, payload.end_date)) {
        return { success: false, error: LEAVE_ERRORS.holidayConflict };
    }

    if (
      await hasLeaveOverlap(
        adminClient,
        payload.employee_id,
        payload.start_date,
        payload.end_date
      )
    ) {
      return { success: false, error: LEAVE_ERRORS.overlap };
    }

    const { error } = await insertLeaveRow(
      adminClient,
      { ...payload, leave_type_id: leaveTypeId,created_by: user?.id || null }
    );
    if (error) return { success: false, error: error.message };

    revalidateAttendancePaths();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || LEAVE_ERRORS.setFailed };
  }
}

export async function setLeaveForAllAction(payload: {
  start_date: string;
  end_date: string;
  leave_type_id?: number;
  note?: string;
}) {
  try {
    const db = await createClient();
    if (!(await checkIsAdmin(db))) {
      return { success: false, error: LEAVE_ERRORS.unauthorized };
    }

    const dateError = validDateRange(payload.start_date, payload.end_date);
    if (dateError) return { success: false, error: dateError };

    const {
      data: { user },
    } = await db.auth.getUser();
    const adminClient = await createAdminClient();

    const leaveTypeId =
      payload.leave_type_id ?? (await resolveDefaultLeaveTypeId(adminClient));

    if (!leaveTypeId) {
      return { success: false, error: LEAVE_ERRORS.invalidLeaveType };
    }

    const { data: employees, error: empError } = await adminClient
      .from("employees")
      .select("employee_id")
      .eq("is_active", true)
      .neq("employee_id", 1111);

    if (empError) return { success: false, error: empError.message };


    if (await hasCompanyHolidayOverlap(adminClient, payload.start_date, payload.end_date)) {
        return { success: false, error: LEAVE_ERRORS.holidayConflict };
    }

    let created = 0;
    let skipped = 0;

    for (const emp of employees || []) {
      if (
        await hasLeaveOverlap(
          adminClient,
          emp.employee_id,
          payload.start_date,
          payload.end_date
        )
      ) {
        skipped++;
        continue;
      }

      const { error } = await insertLeaveRow(adminClient, {
        employee_id: emp.employee_id,
        start_date: payload.start_date,
        end_date: payload.end_date,
        leave_type_id: leaveTypeId,
        note: payload.note,
        created_by: user?.id || null,
      });

      if (error) {
        return { success: false, error: error.message, created, skipped };
      }
      created++;
    }

    revalidateAttendancePaths();
    return { success: true, created, skipped };
  } catch (err: any) {
    return { success: false, error: err.message || LEAVE_ERRORS.setFailed };
  }
}

export async function removeLeaveAction(id: number) {
  try {
    const db = await createClient();
    if (!(await checkIsAdmin(db))) {
      return { success: false, error: LEAVE_ERRORS.unauthorized };
    }

    const adminClient = await createAdminClient();
    const { error } = await adminClient
      .from("employee_leaves")
      .delete()
      .eq("id", id);

    if (error) return { success: false, error: error.message };

    revalidateAttendancePaths();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to remove leave" };
  }
}

export async function getActiveLeaveTypesAction() {
  try {
    const db = await createClient();
    const { data, error } = await db
      .from("leave_type_policies")
      .select("id, name, pool_id, is_active")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to fetch leave types",
    };
  }
}