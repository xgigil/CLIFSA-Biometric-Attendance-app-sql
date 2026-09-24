import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function checkIsAdmin(
  db: Awaited<ReturnType<typeof createClient>>
): Promise<boolean> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return false;

  const { data: profile } = await db
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return profile?.role === "admin";
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
