"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  checkIsAdmin,
  revalidateAttendancePaths,
} from "@/app/dashboard/attendance/admin";

export async function getEmployeesAction() {
  try {
    const db = await createClient();
    const { data, error } = await db
      .from("employees")
      .select("employee_id, employee_name")
      .eq("is_active", true)
      .neq("employee_id", 1111)
      .order("employee_name", { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch employees" };
  }
}

export async function createAttendanceLogAction(payload: {
  employee_id: number;
  employee_name: string;
  log_date: string;
  log_time: string;
}) {
  try {
    const db = await createClient();
    const isAdmin = await checkIsAdmin(db);
    if (!isAdmin) {
      return { success: false, error: "Unauthorized. Admin role required." };
    }

    const { employee_id, employee_name, log_date, log_time } = payload;
    const timeWithSec = log_time.length === 5 ? `${log_time}:00` : log_time;
    const log_date_time = `${log_date} ${timeWithSec}`;

    const adminClient = await createAdminClient();
    const { error } = await adminClient.from("hik_biometric_logs").insert({
      employee_id,
      employee_name,
      log_date,
      log_time: timeWithSec,
      log_date_time,
    });

    if (error) return { success: false, error: error.message };

    revalidateAttendancePaths();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create attendance log" };
  }
}

export async function updateAttendanceLogAction(
  id: number,
  payload: { log_date: string; log_time: string }
) {
  try {
    const db = await createClient();
    const isAdmin = await checkIsAdmin(db);
    if (!isAdmin) {
      return { success: false, error: "Unauthorized. Admin role required." };
    }

    const { log_date, log_time } = payload;
    const timeWithSec = log_time.length === 5 ? `${log_time}:00` : log_time;
    const log_date_time = `${log_date} ${timeWithSec}`;

    const adminClient = await createAdminClient();
    const { error } = await adminClient
      .from("hik_biometric_logs")
      .update({
        log_date,
        log_time: timeWithSec,
        log_date_time,
      })
      .eq("id", id);

    if (error) return { success: false, error: error.message };

    revalidateAttendancePaths();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update attendance log" };
  }
}

export async function deleteAttendanceLogAction(id: number) {
  try {
    const db = await createClient();
    const isAdmin = await checkIsAdmin(db);
    if (!isAdmin) {
      return { success: false, error: "Unauthorized. Admin role required." };
    }

    const adminClient = await createAdminClient();
    const { error } = await adminClient
      .from("hik_biometric_logs")
      .delete()
      .eq("id", id);

    if (error) return { success: false, error: error.message };

    revalidateAttendancePaths();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete attendance log" };
  }
}
