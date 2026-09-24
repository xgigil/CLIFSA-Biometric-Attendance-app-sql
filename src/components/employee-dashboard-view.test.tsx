import { describe, it, expect } from "vitest";
import { EmployeeDashboardView } from "./employee-dashboard-view";
import { EmployeeMonthlyStats, RawBiometricLog } from "@/utils/attendance-processor";

describe("EmployeeDashboardView", () => {
  const mockUserEmployee = {
    employee_id: 101,
    employee_name: "Jane Doe",
  };

  const mockStats: EmployeeMonthlyStats = {
    onTimeRatePercent: 95,
    loggedHoursThisWeek: 35.5,
    lateCount: 1,
    avgLateMins: 12,
    presentDaysCount: 14,
    elapsedWorkdaysCount: 15,
    todayStatus: {
      state: "checked_in",
      firstPunch: "2026-07-20T08:15:00",
      lastPunch: null,
    },
  };

  const mockRecentLogs: RawBiometricLog[] = [
    {
      id: 1,
      employee_id: 101,
      employee_name: "Jane Doe",
      log_date_time: "2026-07-20T08:15:00",
      log_time: "08:15:00",
      log_date: "2026-07-20",
    },
  ];

  it("should be exported as a React component function", () => {
    expect(EmployeeDashboardView).toBeTypeOf("function");
  });

  it("should return JSX element when instantiated", () => {
    const element = EmployeeDashboardView({
      stats: mockStats,
      recentLogs: mockRecentLogs,
      userEmployee: mockUserEmployee,
    });

    expect(element).toBeDefined();
    expect(element.type).toBeDefined();
  });
});
