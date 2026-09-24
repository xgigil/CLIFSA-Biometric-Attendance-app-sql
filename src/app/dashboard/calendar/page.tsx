import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { CalendarView } from "./calendar-view";
import { EmployeeAnalyticsSkeleton } from "@/components/skeletons/employee-analytics-skeleton";

interface CalendarContainerProps {
  selectedDate: string;
  requestedEmpId?: number;
}

async function CalendarContainer({
  selectedDate,
  requestedEmpId,
}: CalendarContainerProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, employee_id")
    .eq("id", user?.id || "")
    .single();

  const isAdmin = profile?.role === "admin";
  const userEmpId = profile?.employee_id || 0;

  let employeesList: { employee_id: number; employee_name: string | null }[] =
    [];
  if (isAdmin) {
    const { data: empData, error: empError } = await supabase
      .from("employees")
      .select("employee_id, employee_name")
      .eq("is_active", true)
      .neq("employee_id", 1111)
      .order("employee_name", { ascending: true });

    if (empError) {
      console.error("Employees fetch error:", empError);
    } else {
      employeesList = empData || [];
    }
  }

  let selectedEmployeeId = userEmpId;
  if (isAdmin) {
    if (
      requestedEmpId &&
      employeesList.some((e) => e.employee_id === requestedEmpId)
    ) {
      selectedEmployeeId = requestedEmpId;
    } else if (employeesList.length > 0) {
      selectedEmployeeId = employeesList[0].employee_id;
    } else if (requestedEmpId) {
      selectedEmployeeId = requestedEmpId;
    }
  }

  const [yearStr, monthStr] = selectedDate.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  const startDate = `${yearStr}-${monthStr}-01`;
  const lastDayNum = new Date(year, month, 0).getDate();
  const endDate = `${yearStr}-${monthStr}-${String(lastDayNum).padStart(2, "0")}`;

  const [logsRes, sysSettingsRes, leavesRes, holidaysRes] = await Promise.all([
    supabase
      .from("hik_biometric_logs")
      .select("*")
      .eq("employee_id", selectedEmployeeId)
      .gte("log_date", startDate)
      .lte("log_date", endDate)
      .order("log_date_time", { ascending: true }),
    supabase
      .from("system_settings")
      .select("work_start_time, grace_period")
      .eq("id", 1)
      .maybeSingle(),
    supabase
      .from("employee_leaves")
      .select("employee_id, start_date, end_date")
      .eq("status", "approved")
      .eq("employee_id", selectedEmployeeId)
      .lte("start_date", endDate)
      .gte("end_date", startDate),
    supabase
      .from("company_holidays")
      .select("start_date, end_date")
      .lte("start_date", endDate)
      .gte("end_date", startDate),
  ]);

  if (logsRes.error) {
    console.error("Biometric logs fetch error:", logsRes.error);
  }

  if (sysSettingsRes.error) {
    console.error("System settings fetch error:", sysSettingsRes.error);
  }

  if (leavesRes.error) {
    console.error("Leaves fetch error:", leavesRes.error);
  }

  if (holidaysRes.error) {
    console.error("Holidays fetch error:", holidaysRes.error);
  }

  const logs = logsRes.data || [];
  const leaves = leavesRes.data || [];
  const holidays = holidaysRes.data || [];
  const workStartTime = sysSettingsRes.data?.work_start_time || "09:00";
  const gracePeriod = sysSettingsRes.data?.grace_period ?? 15;

  return (
    <CalendarView
      logs={logs}
      leaves={leaves}
      holidays={holidays}
      userEmpId={userEmpId}
      isAdmin={isAdmin}
      employeesList={employeesList}
      selectedEmployeeId={selectedEmployeeId}
      workStartTime={workStartTime}
      gracePeriod={gracePeriod}
    />
  );
}

interface PageProps {
  searchParams: Promise<{ date?: string; employee_id?: string }>;
}

export default async function CalendarPage({ searchParams }: PageProps) {
  const { date, employee_id } = await searchParams;

  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const localToday = `${yyyy}-${mm}-${dd}`;

  const selectedDate =
    date && /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date))
      ? date
      : localToday;

  const requestedEmpId = employee_id ? parseInt(employee_id, 10) : undefined;
  const validEmpId =
    requestedEmpId && !isNaN(requestedEmpId) ? requestedEmpId : undefined;

  return (
    <div className="w-full h-auto my-6 px-6">
      <Suspense fallback={<EmployeeAnalyticsSkeleton />}>
        <CalendarContainer
          selectedDate={selectedDate}
          requestedEmpId={validEmpId}
        />
      </Suspense>
    </div>
  );
}
