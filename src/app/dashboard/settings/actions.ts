"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { AuthUser } from "@/lib/db-client";


export type MemberProfile = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  status: "pending" | "approved" | "rejected";
  employee_id: number | null;
}

async function requireAdmin() {
  const db = await createClient();
  const { data: { user }, } = await db.auth.getUser();
  if (!user) 
    return { db, user: null, error: "Unauthorized: Please log in." as const };

  const { data: profile } = await db.from("profiles").select("role, status").eq("id", user.id).single();

    if (!profile || (profile as { role: string, status: string}).role !=="admin" || (profile as { status: string }).status !== "approved") {
      return { db, user, error: "Forbidden: Only approved administrators can perform this action." as const };
    }
    return { db, user, error: null}
}

export async function getSettingsPageData(): Promise<{
  user: AuthUser | null;
  role: "admin" | "member";
  profiles: MemberProfile[];
  employees: { employee_id: number; employee_name: string }[];
  sysSettings: { work_start_time: string; grace_period: number } | null;
}> {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user) {
    return { user: null, role: "member", profiles: [], employees: [], sysSettings: null };
  }

  const { data: selfProfile } = await db.from("profiles").select("role, name").eq("id", user.id).single();
  const role = ((selfProfile as { role?: string } | null)?.role === "admin" ? "admin" : "member") as "admin" | "member";
  const profileName = (selfProfile as { name?: string | null } | null)?.name;
  const hydratedUser = profileName
    ? { ...user, user_metadata: { ...user.user_metadata, name: profileName, full_name: profileName } }
    : user;

  let profiles: MemberProfile[] = [];
  let employees: { employee_id: number; employee_name: string }[] = [];

  if (role === "admin") {
    const [profilesRes, empsRes] = await Promise.all([
      db.from("profiles").select("id, name, email, role, status, employee_id").order("email"),
      db.from("employees").select("employee_id, employee_name").eq("is_active", true).order("employee_name"),
    ]);
    profiles = (profilesRes.data as MemberProfile[]) || [];
    employees = (empsRes.data as { employee_id: number; employee_name: string }[]) || [];
  }

  const { data: sysSettings } = await db
    .from("system_settings")
    .select("work_start_time, grace_period")
    .eq("id", 1)
    .maybeSingle();

  return {
    user: hydratedUser,
    role,
    profiles,
    employees,
    sysSettings: sysSettings as { work_start_time: string; grace_period: number } | null,
  };
}

export async function updateDisplayNameAction(name: string) {
  const db = await createClient();
  const { data, error } = await db.auth.updateUser({ data: { name, full_name: name }});
  if (error) return { success: false as const, error: error.message, user: null};
  return { success: true as const, user: data.user };
}

export async function updateSystemSettingsAction(workStartTime: string, gracePeriod: number) {
  const { error: authError } = await requireAdmin();
  if (authError) return { success: false as const, error: authError };

  const db = await createClient();
  const { error } = await db.from("system_settings").update({ work_start_time: workStartTime, grace_period: gracePeriod}).eq("id", 1);

  if (error) return { success: false as const, error: error.message};
  return { success: true as const};
}

export async function updateUserRoleAction(userId: string, newRole: "admin" | "member") {
  const { user, error: authError } = await requireAdmin();
  if (authError) return { success: false as const, error: authError };
  if (userId === user?.id) return { success: false as const, error: "You cannot change your own role"}

  const db = await createClient();
  const { error } = await db.from("profiles").update({ role: newRole}).eq("id", userId);

  if (error) return { success: false as const, error: error.message};
  return { success: true as const};
}

export async function updateUserEmployeeAction(userId: string, employeeId: number | null) {
  const { error: authError } = await requireAdmin();
  if (authError) return { success: false as const, error: authError };

  const db = await createClient();
  const { error } = await db.from("profiles").update({ employee_id: employeeId }).eq("id", userId);

  if (error) return { success: false as const, error: error.message };
  return { success: true as const };
}

export async function updateUserStatusAction(userId: string, newStatus: "pending" | "approved" | "rejected") {
  const { user, error: authError } = await requireAdmin();
  if (authError) return { success: false as const, error: authError };
  if (userId === user?.id) return { success: false as const, error: "You cannot change your own status."};

  const db = await createClient();
  const { error } = await db.from("profiles").update({ status: newStatus }).eq("id", userId);

  if (error) return { success: false as const, error: error.message };
  return { success: true as const };
}


export async function deleteUserAction(targetUserId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await createClient();

    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) {
      return { success: false, error: "Unauthorized: Please log in." };
    }

    const { data: profile } = await db
      .from("profiles")
      .select("role, status")
      .eq("id", user.id)
      .single();

    if (!profile || (profile as { role: string }).role !== "admin" || (profile as { status: string }).status !== "approved") {
      return { success: false, error: "Forbidden: Only approved administrators can delete users." };
    }

    if (targetUserId === user.id) {
      return { success: false, error: "Forbidden: You cannot delete your own account." };
    }

    const adminClient = await createAdminClient();
    const { error } = await adminClient.auth.admin.deleteUser(targetUserId);
    if (error) {
      console.error("Admin deletion failed:", error);
      return { success: false, error: `Failed to delete user: ${error.message}` };
    }

    return { success: true };
  } catch (e) {
    console.error("deleteUserAction caught error:", e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return { success: false, error: errorMessage };
  }
}