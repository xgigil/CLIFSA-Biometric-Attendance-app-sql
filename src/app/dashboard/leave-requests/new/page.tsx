import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdminOrHrRole } from "@/app/dashboard/attendance/roles";
import { getEmployeesAction } from "@/app/dashboard/analytics/actions";
import { getActiveLeaveTypesAction } from "@/app/dashboard/leaves/actions";
import { ApplyForm } from "./apply-form";

export default async function NewLeaveApplicationPage() {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();

	const { data: profile } = await supabase
			.from("profiles")
			.select("role, employee_id")
			.eq("id", user?.id || "")
			.maybeSingle();

	const isAuthorized = isAdminOrHrRole(profile?.role);
	const linkedEmployeeId = profile?.employee_id == null 
			? null : Number(profile.employee_id);

	// Admin/HR get the full picker. A Member gets ONLY their own employee row.
	let employees: { employee_id: number; employee_name: string }[] = [];
	if (isAuthorized) {
		const res = await getEmployeesAction();
		if (res.success && res.data) employees = res.data;
	} else if (linkedEmployeeId != null) {
		const { data: emp } = await supabase
				.from("employees")
				.select("employee_id, employee_name")
				.eq("employee_id", linkedEmployeeId)
				.maybeSingle();
		if (emp) {
			employees = [
				{ employee_id: Number(emp.employee_id), employee_name: emp.employee_name ?? "" }
			];
		}
	}

	const typeRes = await getActiveLeaveTypesAction();
	const leaveTypes = (typeRes.success && typeRes.data ? typeRes.data : []).map(
		(t: { id: number; name: string}) => ({ id: Number(t.id), name: t.name })
	);

	if (!isAuthorized && employees.length === 0) {
    return (
      <div className="w-full my-6 px-6 space-y-3">
        <p className="text-sm text-red-500">
          Your account is not linked to an employee record. Please ask HR to link it.
        </p>
        <Link href="/dashboard/leave-requests" className="text-sm underline">
          Back to applications
        </Link>
      </div>
    );
  }

	return (
    <div className="w-full my-6 px-6">
      <ApplyForm
        isAuthorized={isAuthorized}
        employees={employees}
        defaultEmployeeId={isAuthorized ? null : linkedEmployeeId}
        leaveTypes={leaveTypes}
      />
    </div>
  );
}