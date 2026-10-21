export type AppRole = "admin" | "hr" | "member";

export function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin";
}

export function isAdminOrHrRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "hr";
}

export function canManageLeaveandHolidays(
  role: string | null | undefined
): boolean {
  return isAdminOrHrRole(role);
}