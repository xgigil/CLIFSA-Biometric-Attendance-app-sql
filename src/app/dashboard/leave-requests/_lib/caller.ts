import type { createClient } from "@/lib/supabase/server";
import { isAdminOrHrRole } from "@/app/dashboard/attendance/roles";
import { APPLICATION_ERRORS } from "./errors";

export type Db = Awaited<ReturnType<typeof createClient>>;

export type CallerContext = {
  userId: string;
  role: string | null;
  employeeId: string | null;
  isAuthorized: boolean; // Admin or HR
};

// Gets the signed-in user, their role, and linked employee id.
export async function getCallerContext(db: Db): Promise<CallerContext | null> {
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;

  const { data: profile } = await db
    .from("profiles")
    .select("role, employee_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return null;

  const role: string | null = profile.role ?? null;
  return {
    userId: user.id,
    role,
    employeeId: profile.employee_id == null ? null : String(profile.employee_id),
    isAuthorized: isAdminOrHrRole(role),
  };
}

// Members can only use their own employee id. Admin/HR can use any.
export function checkEmployeeAccess(ctx: CallerContext, employeeId: number): string | null {
  if (ctx.isAuthorized) return null;
  if (ctx.employeeId === null) return APPLICATION_ERRORS.noLinkedEmployee;
  if (String(employeeId) !== ctx.employeeId) return APPLICATION_ERRORS.notOwnEmployee;
  return null;
}