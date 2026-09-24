import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  processDailyLogs,
  calculateEmployeePersonalStats,
  RawBiometricLog,
  EmployeeStub,
  buildLeaveIndex,
  buildHolidayIndex,
  LeaveRow,
  HolidayRow,
} from "@/utils/attendance-processor";
import { RedirectToDefaultHome } from "@/components/redirect-to-default-home";
import { AdminDashboardView } from "@/components/admin-dashboard-view";
import { EmployeeDashboardView } from "@/components/employee-dashboard-view";
import { AdminDashboardSkeleton } from "@/components/skeletons/admin-dashboard-skeleton";
import { EmployeeDashboardSkeleton } from "@/components/skeletons/employee-dashboard-skeleton";

interface AdminContainerProps {
  today: string;
}

async function AdminDashboardContainer({ today }: AdminContainerProps) {
  const supabase = await createClient();
  let workStartTime = "09:00";
  let gracePeriod = 15;
  let errorMsg = "";

  const [year, month, day] = today.split("-").map(Number);
  const todayDate = new Date(year, month - 1, day, 12, 0, 0);
  const dayOfWeek = todayDate.getDay();

  const monday = new Date(todayDate);
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  monday.setDate(todayDate.getDate() + diffToMonday);

  const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const weekDates = weekDays.map((_, index) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + index);

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dayVal = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dayVal}`;
  });

  const formatLabelDate = (dString: string) => {
    const [y, m, d] = dString.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d, 12, 0, 0);
    const monthName = dateObj.toLocaleDateString("en-US", { month: "long" });
    return { month: monthName, day: dateObj.getDate() };
  };

  const startLabel = formatLabelDate(weekDates[0]);
  const endLabel = formatLabelDate(weekDates[4]);

  let weekRangeLabel = "";
  if (startLabel.month === endLabel.month) {
    weekRangeLabel = `${startLabel.month} ${startLabel.day} - ${endLabel.day}`;
  } else {
    weekRangeLabel = `${startLabel.month} ${startLabel.day} - ${endLabel.month} ${endLabel.day}`;
  }

  let allEmployees: EmployeeStub[] = [];
  let weeklyLogs: RawBiometricLog[] = [];
  let leaveRows: LeaveRow[] = [];

  const empQuery = supabase
    .from("employees")
    .select("employee_id, employee_name")
    .eq("is_active", true)
    .order("employee_name", { ascending: true })
    .neq("employee_id", 1111);

  const logsQuery = supabase
    .from("hik_biometric_logs")
    .select("*")
    .gte("log_date", weekDates[0])
    .lte("log_date", weekDates[4])
    .order("log_date_time", { ascending: true });

    const leavesQuery = supabase
      .from("employee_leaves")
      .select("employee_id, start_date, end_date")
      .eq("status", "approved")
      .lte("start_date", weekDates[4])
      .gte("end_date", weekDates[0]);

  const holidaysQuery = supabase
    .from("company_holidays")
    .select("start_date, end_date")
    .lte("start_date", weekDates[4])
    .gte("end_date", weekDates[0]);

  let holidayRows: HolidayRow[] = [];

  try {
    const [empRes, logsRes, sysSettingsRes, leavesRes, holidaysRes] = await Promise.all([
      empQuery,
      logsQuery,
      supabase
        .from("system_settings")
        .select("work_start_time, grace_period")
        .eq("id", 1)
        .maybeSingle(),
      leavesQuery,
      holidaysQuery,
    ]);

    if (empRes.error) {
      console.error("Employees fetch error:", empRes.error);
      errorMsg = "Error loading employee data.";
    } else {
      allEmployees = empRes.data || [];
    }

    if (logsRes.error) {
      console.error("Weekly logs fetch error:", logsRes.error);
      errorMsg = "Error loading attendance logs.";
    } else {
      weeklyLogs = logsRes.data || [];
    }

    if (sysSettingsRes.error) {
      console.error("System settings fetch error:", sysSettingsRes.error);
    } else if (sysSettingsRes.data) {
      workStartTime = sysSettingsRes.data.work_start_time;
      gracePeriod = sysSettingsRes.data.grace_period;
    }

    if (leavesRes.error) {
      console.error("Leaves fetch error:", leavesRes.error);
    } else {
      leaveRows = leavesRes.data || [];
    }

    if (holidaysRes.error) {
      console.error("Holidays fetch error:", holidaysRes.error);
    } else {
      holidayRows = holidaysRes.data || [];
    }

  } catch (err) {
    console.error("Unexpected fetch exception:", err);
    errorMsg = "An unexpected error occurred while fetching data.";
  }

  if (errorMsg) {
    return <div className="p-6 text-red-500 font-medium">{errorMsg}</div>;
  }

  const leaveIndex = buildLeaveIndex(leaveRows);
  const holidayIndex = buildHolidayIndex(holidayRows);

  const rawLogs = weeklyLogs.filter((log) => log.log_date === today);
  const recentLogs = [...rawLogs].reverse().slice(0, 5);
  const processedData = processDailyLogs(rawLogs, allEmployees, workStartTime, gracePeriod, today, leaveIndex, holidayIndex);

  const chartData = weekDays.map((dayName, index) => {
    const dateStr = weekDates[index];
    const dailyLogs = weeklyLogs.filter((log) => log.log_date === dateStr);
    const processed = processDailyLogs(dailyLogs, allEmployees, workStartTime, gracePeriod, dateStr, leaveIndex, holidayIndex);

    const present = processed.filter((emp) => emp.status === "present").length;
    const late = processed.filter((emp) => emp.status === "late").length;

    return {
      day: dayName,
      present,
      late,
    };
  });

  const presentCount = processedData.filter((emp) => emp.status === "present").length;
  const lateCount = processedData.filter((emp) => emp.status === "late").length;
  const absentCount = processedData.filter((emp) => emp.status === "absent").length;
  const onLeaveCount = processedData.filter((emp) => emp.status === "on_leave").length;
  // const totalCount = allEmployees.length;

  return (
    <AdminDashboardView
      presentCount={presentCount}
      lateCount={lateCount}
      absentCount={absentCount}
      onLeaveCount={onLeaveCount}
      // totalCount={totalCount}
      chartData={chartData}
      weekRangeLabel={weekRangeLabel}
      today={today}
      recentLogs={recentLogs}
    />
  );
}

interface EmployeeContainerProps {
  today: string;
  userEmpId: number;
}

async function EmployeeDashboardContainer({
  today,
  userEmpId,
}: EmployeeContainerProps) {
  const supabase = await createClient();
  let workStartTime = "09:00";
  let gracePeriod = 15;
  let errorMsg = "";

  const [tYear, tMonth, tDay] = today.split("-").map(Number);
  const daysInMonth = new Date(tYear, tMonth, 0).getDate();
  const monthDates: string[] = [];
  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const dayStr = String(dayNum).padStart(2, "0");
    const mStr = String(tMonth).padStart(2, "0");
    monthDates.push(`${tYear}-${mStr}-${dayStr}`);
  }

  const todayDateObj = new Date(tYear, tMonth - 1, tDay, 12, 0, 0);
  const dayOfWeek = todayDateObj.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const mondayObj = new Date(todayDateObj);
  mondayObj.setDate(todayDateObj.getDate() + diffToMonday);

  const monY = mondayObj.getFullYear();
  const monM = String(mondayObj.getMonth() + 1).padStart(2, "0");
  const monD = String(mondayObj.getDate()).padStart(2, "0");
  const mondayStr = `${monY}-${monM}-${monD}`;

  const logsStartDate = mondayStr < monthDates[0] ? mondayStr : monthDates[0];

  let monthlyLogs: RawBiometricLog[] = [];
  let leaveRows: LeaveRow[] = [];
  let holidayRows: HolidayRow[] = [];
  let empName = "Employee";

  try {
    const [empRes, logsRes, sysSettingsRes, leavesRes, holidaysRes] = await Promise.all([
      supabase
        .from("employees")
        .select("employee_id, employee_name")
        .eq("employee_id", userEmpId)
        .maybeSingle(),
      supabase
        .from("hik_biometric_logs")
        .select("*")
        .eq("employee_id", userEmpId)
        .gte("log_date", logsStartDate)
        .lte("log_date", monthDates[monthDates.length - 1])
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
        .eq("employee_id", userEmpId)
        .lte("start_date", monthDates[monthDates.length - 1])
        .gte("end_date", logsStartDate),
      supabase
        .from("company_holidays")
        .select("start_date, end_date")
        .lte("start_date", monthDates[monthDates.length - 1])
        .gte("end_date", logsStartDate),
    ]);

    if (empRes.error) {
      console.error("Employee fetch error:", empRes.error);
    } else if (empRes.data) {
      empName = empRes.data.employee_name || "Employee";
    }

    if (logsRes.error) {
      console.error("Monthly logs fetch error:", logsRes.error);
      errorMsg = "Error loading attendance logs.";
    } else {
      monthlyLogs = logsRes.data || [];
    }

    if (sysSettingsRes.error) {
      console.error("System settings fetch error:", sysSettingsRes.error);
    } else if (sysSettingsRes.data) {
      workStartTime = sysSettingsRes.data.work_start_time;
      gracePeriod = sysSettingsRes.data.grace_period;
    }

    if (leavesRes.error) {
      console.error("Leaves fetch error", leavesRes.error);
    } else {
      leaveRows = leavesRes.data || [];
    }

    if (holidaysRes.error) {
      console.error("Holidays fetch error", holidaysRes.error);
    } else {
      holidayRows = holidaysRes.data || [];
    }
  } catch (err) {
    console.error("Unexpected fetch exception:", err);
    errorMsg = "An unexpected error occurred while fetching data.";
  }

  if (errorMsg) {
    return <div className="p-6 text-red-500 font-medium">{errorMsg}</div>;
  }

  const leaveIndex = buildLeaveIndex(leaveRows);
  const holidayIndex = buildHolidayIndex(holidayRows);

  const stats = calculateEmployeePersonalStats(
    monthlyLogs,
    userEmpId,
    workStartTime,
    gracePeriod,
    monthDates,
    today,
    leaveIndex,
    holidayIndex
  );

  const personalRecentLogs = [...monthlyLogs].reverse().slice(0, 5);

  return (
    <EmployeeDashboardView
      stats={stats}
      recentLogs={personalRecentLogs}
      userEmployee={{ employee_name: empName, employee_id: userEmpId }}
    />
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const localToday = `${yyyy}-${mm}-${dd}`;

  const today =
    date && /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date))
      ? date
      : localToday;

  // Fetch self role and employee_id
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, employee_id")
    .eq("id", user?.id || "")
    .single();

  const isAdmin = profile?.role === "admin";

  return (
    <div className="w-full h-full p-6 flex flex-col gap-5">
      <RedirectToDefaultHome userId={user?.id || ""} />
      {isAdmin ? (
        <Suspense fallback={<AdminDashboardSkeleton />}>
          <AdminDashboardContainer today={today} />
        </Suspense>
      ) : (
        <Suspense fallback={<EmployeeDashboardSkeleton />}>
          <EmployeeDashboardContainer
            today={today}
            userEmpId={profile?.employee_id || 0}
          />
        </Suspense>
      )}
    </div>
  );
}
