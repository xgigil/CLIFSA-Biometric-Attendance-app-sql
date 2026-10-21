import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { isAdminOrHrRole } from "@/app/dashboard/attendance/roles";
import { getEmployeesAction } from "@/app/dashboard/analytics/actions";
import { EmployeeAnalyticsSkeleton } from "@/components/skeletons/employee-analytics-skeleton";
import { listLeaveApplicationAction } from "./read-actions";
import { ApplicationsTable, type ApplicationRow } from "./applications-table";

const VALID_STATUSES = [ "pending", "approved", "denied", "cancelled" ];

async function LeaveApplicationsContainer({
	status,
	employeeId,
}: {
	status?: string;
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
	const [res, employeesRes] = await Promise.all([
			listLeaveApplicationAction({ status, employeeId }),
			isAuthorized ? getEmployeesAction() : Promise.resolve(null),
	]);

	if (!res.success) {
			return <div className="p-6 text-red-500">{res.error}</div>;
	}

	const employees = employeesRes && employeesRes.success && employeesRes.data
			? (employeesRes.data as { employee_id: number; employee_name: string }[])
			: [];

	return (
			<ApplicationsTable
					rows={(res.data || []) as ApplicationRow[]}
					isAuthorized={isAuthorized}
					employees={employees}
					selectedStatus={status ?? "all"}
					selectedEmployeeId={employeeId ? String(employeeId): "all"}
			/>
	);
}

interface PageProps {
	searchParams: Promise<{ status?: string; employee_id?: string }>;
}

export default async function LeaveApplicationPage({ searchParams }: PageProps) {
	const { status, employee_id } = await searchParams;

	// ignore junk values in the URL instead of showing an error
	const validStatus = status && VALID_STATUSES.includes(status) ? status : undefined;
	const parsedEmp = employee_id ? parseInt(employee_id, 10) : NaN;
  const validEmpId = Number.isNaN(parsedEmp) ? undefined : parsedEmp;

	return (
    <div className="w-full h-auto my-6 px-6">
      <Suspense fallback={<EmployeeAnalyticsSkeleton />}>
        <LeaveApplicationsContainer status={validStatus} employeeId={validEmpId} />
      </Suspense>
    </div>
  );
}