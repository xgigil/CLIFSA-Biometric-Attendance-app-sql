import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { isAdminOrHrRole } from "@/app/dashboard/attendance/roles";
import { EmployeeAnalyticsSkeleton } from "@/components/skeletons/employee-analytics-skeleton";
import { listLeaveApplicationAction } from "./read-actions";
import { ApplicationsTable, type ApplicationRow } from "./applications-table";

const VALID_STATUSES = ["pending", "approved", "denied", "cancelled"];

async function LeaveApplicationsContainer({
  statuses,
  employeeId,
}: {
  statuses?: string[];
  employeeId?: number;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id || "")
    .maybeSingle();

  const isAuthorized = isAdminOrHrRole(profile?.role);

  // Members are scoped to their own employee inside the action, so the
  // employeeId filter is ignored for them. Only Admin or HR need the employee list.
  const [res] = await Promise.all([
    listLeaveApplicationAction({ status: statuses, employeeId }),
  ]);

  if (!res.success) {
    return <div className="p-6 text-red-500">{res.error}</div>;
  }

  return (
	<ApplicationsTable rows={(res.data || []) as ApplicationRow[]} />
  );
}

interface PageProps {
  searchParams: Promise<{ status?: string; employee_id?: string }>;
}

export default async function LeaveApplicationPage({ searchParams }: PageProps) {
  const { status, employee_id } = await searchParams;

  const parsedStatuses = status
    ? [...new Set(status.split(",").map((s) => s.trim()))].filter((s) =>
        VALID_STATUSES.includes(s)
      )
    : [];
  const validStatuses = parsedStatuses.length > 0 ? parsedStatuses : undefined;

  const parsedEmp = employee_id ? parseInt(employee_id, 10) : NaN;
  const validEmpId = Number.isNaN(parsedEmp) ? undefined : parsedEmp;

  return (
    <div className="w-full h-auto my-6 px-6">
      <Suspense fallback={<EmployeeAnalyticsSkeleton />}>
        <LeaveApplicationsContainer statuses={validStatuses} employeeId={validEmpId} />
      </Suspense>
    </div>
  );
}