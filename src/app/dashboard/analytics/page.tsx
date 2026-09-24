import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { AttendanceTable } from "./attendance-table";
import {
  processDailyLogs,
  processUserHistoryLogs,
  buildLeaveIndex,
  buildHolidayIndex,
} from "@/utils/attendance-processor";
import { PersonnelAnalytics } from "./columns";
import { AdminAnalyticsSkeleton } from "@/components/skeletons/admin-analytics-skeleton";
import { EmployeeAnalyticsSkeleton } from "@/components/skeletons/employee-analytics-skeleton";

interface AnalyticsContainerProps {
  selectedDate: string;
  statusParam?: string;
  profile: { role: string; employee_id: number | null } | null;
}

async function AnalyticsDataContainer({
  selectedDate,
  statusParam,
  profile,
}: AnalyticsContainerProps) {
  const supabase = await createClient();
  const isAdmin = profile?.role === "admin";
  const isSingleUserView = !isAdmin;

  let logsQuery = supabase
    .from("hik_biometric_logs")
    .select("*")
    .order("log_date_time", { ascending: true });

  let empQuery = supabase
    .from("employees")
    .select("employee_id, employee_name")
    .eq("is_active", true)
    .order("employee_name", { ascending: true })
    .neq("employee_id", 1111);

  // replaced entirley to support leave tracking --start
  const userEmpId = profile?.employee_id || 0;
  
  const [selYearStr, selMonthStr] = selectedDate.split("-");
  const hasMonth = Boolean(selYearStr && selMonthStr);

  const lastDayNum = hasMonth ? new Date(Number(selYearStr), Number(selMonthStr), 0).getDate() : 0;
  const startOfMonth = hasMonth ? `${selYearStr}-${selMonthStr}-01` : selectedDate;
  const endOfMonth = hasMonth ? `${selYearStr}-${selMonthStr}-${String(lastDayNum).padStart(2, "0")}` : selectedDate;
  
  if (!isAdmin) {
    logsQuery = logsQuery.eq("employee_id", userEmpId);
    if (hasMonth) {
      logsQuery = logsQuery.gte("log_date", startOfMonth).lte("log_date", endOfMonth);
    }
    empQuery = empQuery.eq("employee_id", userEmpId);
  } else {
    logsQuery = logsQuery.eq("log_date", selectedDate);
  }

  const leaveStart = isAdmin ? selectedDate : startOfMonth;
  const leaveEnd = isAdmin ? selectedDate : endOfMonth;

  let leavesQuery = supabase.from("employee_leaves").select("employee_id, start_date, end_date")
    .eq("status", "approved").lte("start_date", leaveEnd).gte("end_date", leaveStart);

  if (!isAdmin) {
    leavesQuery = leavesQuery.eq("employee_id", userEmpId);
  }

  const holidaysQuery = supabase
    .from("company_holidays")
    .select("start_date, end_date")
    .lte("start_date", leaveEnd)
    .gte("end_date", leaveStart);
  // --end of replaced code

  const [
    { data: rawLogs, error },
    { data: allEmployees, error: employeesError },
    { data: sysSettings, error: sysSettingsError },
    { data: leavesData, error: leavesError },
    { data: holidaysData, error: holidaysError },
  ] = await Promise.all([
    logsQuery,
    empQuery,
    supabase
      .from("system_settings")
      .select("work_start_time, grace_period")
      .eq("id", 1)
      .maybeSingle(),
    leavesQuery,
    holidaysQuery,
  ]);

  if (error) {
    console.error(error);
    return (
      <div className="p-6 text-red-500">Error loading biometric data.</div>
    );
  }

  if (employeesError) {
    console.error("Employees fetch error:", employeesError);
  }

  if (sysSettingsError) {
    console.error("System settings fetch error:", sysSettingsError);
  }

  if (leavesError) {
    console.error("Leaves fetch error:", leavesError);
  }

  if (holidaysError) {
    console.error("Holidays fetch error:", holidaysError);
  }

  let workStartTime = "09:00";
  let gracePeriod = 15;
  if (sysSettings) {
    workStartTime = sysSettings.work_start_time;
    gracePeriod = sysSettings.grace_period;
  }

  const leaveIndex = buildLeaveIndex(leavesData || []);
  const holidayIndex = buildHolidayIndex(holidaysData || []);

  const currentEmp = (allEmployees || [])[0] || {
    employee_id: profile?.employee_id || 0,
    employee_name: null,
  };

  const userEmployee = isSingleUserView
    ? {
        employee_name: currentEmp.employee_name || "Employee",
        employee_id: String(currentEmp.employee_id),
      }
    : undefined;

  let processedData: PersonnelAnalytics[] = [];

  if (!isAdmin) {
    processedData = processUserHistoryLogs(
      rawLogs || [],
      currentEmp,
      workStartTime,
      gracePeriod,
      selectedDate,
      leaveIndex,
      holidayIndex
    );
  } else {
    processedData = processDailyLogs(
      rawLogs || [],
      allEmployees || [],
      workStartTime,
      gracePeriod,
      selectedDate,
      leaveIndex,
      holidayIndex
    ).map((item) => ({ ...item, date: selectedDate }));
  }

  const selectedStatuses = statusParam ? statusParam.split(",") : [];

  const filteredData =
    selectedStatuses.length > 0
      ? processedData.filter((item) => selectedStatuses.includes(item.status))
      : processedData;

  return (
    <AttendanceTable
      data={filteredData}
      isAdmin={isAdmin}
      isSingleUserView={isSingleUserView}
      userEmployee={userEmployee}
      rawLogs={rawLogs || []}
      workStartTime={workStartTime}
      gracePeriod={gracePeriod}
    />
  );

}

interface PageProps {
  searchParams: Promise<{ date?: string; status?: string }>;
}

export default async function AttendancePage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const resolvedParams = await searchParams;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch self role and employee_id
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, employee_id")
    .eq("id", user?.id || "")
    .single();

  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const today = `${yyyy}-${mm}-${dd}`;
  const selectedDate = resolvedParams.date || today;

  const isAdmin = profile?.role === "admin";

  return (
    <div className="w-full h-auto mt-6 px-6">
      {isAdmin ? (
        <Suspense fallback={<AdminAnalyticsSkeleton />}>
          <AnalyticsDataContainer
            selectedDate={selectedDate}
            statusParam={resolvedParams.status}
            profile={profile}
          />
        </Suspense>
      ) : (
        <Suspense fallback={<EmployeeAnalyticsSkeleton />}>
          <AnalyticsDataContainer
            selectedDate={selectedDate}
            statusParam={resolvedParams.status}
            profile={profile}
          />
        </Suspense>
      )}
    </div>
  );
}
