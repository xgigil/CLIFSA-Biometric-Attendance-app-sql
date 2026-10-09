import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type AppRole = "admin" | "hr" | "member";

export function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin";
}

export function isAdminOrHrRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "hr";
}

export function canManageLeaveandHolidays(role: string | null | undefined): boolean {
  return isAdminOrHrRole(role);
}

type Db = Awaited<ReturnType<typeof createClient>>;

async function getCurrentUserRole(db: Db): Promise<string | null | undefined> {
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;

  const { data: profile } = await db
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return profile?.role;
}

// Used by Admin only permissions
export async function checkIsAdmin(db: Db): Promise<boolean> {
  return isAdminRole(await getCurrentUserRole(db));
}

// Used by Admin and HR only permissions: leave / holiday management.
export async function checkIsAdminOrHr(db: Db): Promise<boolean> {
  return isAdminOrHrRole(await getCurrentUserRole(db));
}

export const ATTENDANCE_PATHS = [
  "/dashboard",
  "/dashboard/analytics",
  "/dashboard/calendar",
] as const;

export function revalidateAttendancePaths() {
  for (const path of ATTENDANCE_PATHS) {
    revalidatePath(path);
  }
}
