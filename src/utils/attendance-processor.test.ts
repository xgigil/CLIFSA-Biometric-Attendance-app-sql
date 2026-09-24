import { describe, it, expect } from "vitest";
import {
  processDailyLogs,
  processUserHistoryLogs,
  calculateEmployeePersonalStats,
  generateMonthlyCalendarMatrix,
  buildLeaveIndex,
  buildHolidayIndex,
  RawBiometricLog,
} from "./attendance-processor";

describe("processDailyLogs", () => {
  const mockEmployees = [
    { employee_id: 1, employee_name: "Alice Smith" },
    { employee_id: 2, employee_name: "Bob Jones" },
    { employee_id: 3, employee_name: "Charlie Brown" },
  ];

  it("should mark unlogged employees as absent with 0 hours", () => {
    const logs: Parameters<typeof processDailyLogs>[0] = [];
    const result = processDailyLogs(logs, mockEmployees);

    expect(result).toHaveLength(3);
    const charlie = result.find((r) => r.employee_id === "3");
    expect(charlie).toEqual({
      employee_id: "3",
      employee_name: "Charlie Brown",
      first_punch: null,
      last_punch: null,
      total_hours_worked: 0,
      status: "absent",
      log_id: undefined,
      raw_logs: [],
    });
  });

  it("should filter out duplicate scans within 2 minutes of the previous scan", () => {
    const logs = [
      {
        id: 1,
        employee_id: 1,
        employee_name: "Alice Smith",
        log_date_time: "2026-06-22T08:00:00.000Z",
        log_time: "08:00:00",
        log_date: "2026-06-22",
      },
      {
        id: 2,
        employee_id: 1,
        employee_name: "Alice Smith",
        log_date_time: "2026-06-22T08:01:30.000Z",
        log_time: "08:01:30",
        log_date: "2026-06-22",
      },
      {
        id: 3,
        employee_id: 1,
        employee_name: "Alice Smith",
        log_date_time: "2026-06-22T17:00:00.000Z",
        log_time: "17:00:00",
        log_date: "2026-06-22",
      },
    ];

    const result = processDailyLogs(logs, mockEmployees);
    const alice = result.find((r) => r.employee_id === "1");

    expect(alice).toBeDefined();
    expect(alice?.first_punch).toBe("2026-06-22T08:00:00.000Z");
    expect(alice?.last_punch).toBe("2026-06-22T17:00:00.000Z");
    // Diff is 9 hours. Since hours > 5, 1 hour break is deducted.
    // 9 - 1 = 8 hours
    expect(alice?.total_hours_worked).toBe(8);
  });

  it("should calculate correct status: late if after 08:00, present if at or before 08:00", () => {
    const logs = [
      {
        id: 1,
        employee_id: 1,
        employee_name: "Alice Smith",
        log_date_time: "2026-06-22T08:00:00.000Z",
        log_time: "08:00:00",
        log_date: "2026-06-22",
      },
      {
        id: 2,
        employee_id: 2,
        employee_name: "Bob Jones",
        log_date_time: "2026-06-22T08:01:00.000Z",
        log_time: "08:01:00",
        log_date: "2026-06-22",
      },
    ];

    const result = processDailyLogs(logs, mockEmployees);
    const alice = result.find((r) => r.employee_id === "1");
    const bob = result.find((r) => r.employee_id === "2");

    expect(alice?.status).toBe("present");
    expect(bob?.status).toBe("late");
  });

  it("should sort raw logs chronologically by date-time before processing", () => {
    const logs = [
      {
        id: 1,
        employee_id: 1,
        employee_name: "Alice Smith",
        log_date_time: "2026-06-22T17:00:00.000Z",
        log_time: "17:00:00",
        log_date: "2026-06-22",
      },
      {
        id: 2,
        employee_id: 1,
        employee_name: "Alice Smith",
        log_date_time: "2026-06-22T08:00:00.000Z",
        log_time: "08:00:00",
        log_date: "2026-06-22",
      },
    ];

    const result = processDailyLogs(logs, mockEmployees);
    const alice = result.find((r) => r.employee_id === "1");

    expect(alice?.first_punch).toBe("2026-06-22T08:00:00.000Z");
    expect(alice?.last_punch).toBe("2026-06-22T17:00:00.000Z");
  });

  it("should deduct 1 hour break when total hours worked is greater than 5 hours", () => {
    const logs1 = [
      {
        id: 1,
        employee_id: 1,
        employee_name: "Alice Smith",
        log_date_time: "2026-06-22T08:00:00.000Z",
        log_time: "08:00:00",
        log_date: "2026-06-22",
      },
      {
        id: 2,
        employee_id: 1,
        employee_name: "Alice Smith",
        log_date_time: "2026-06-22T14:00:00.000Z",
        log_time: "14:00:00",
        log_date: "2026-06-22",
      },
    ];

    const logs2 = [
      {
        id: 3,
        employee_id: 2,
        employee_name: "Bob Jones",
        log_date_time: "2026-06-22T08:00:00.000Z",
        log_time: "08:00:00",
        log_date: "2026-06-22",
      },
      {
        id: 4,
        employee_id: 2,
        employee_name: "Bob Jones",
        log_date_time: "2026-06-22T13:00:00.000Z",
        log_time: "13:00:00",
        log_date: "2026-06-22",
      },
    ];

    const result1 = processDailyLogs(logs1, mockEmployees);
    const result2 = processDailyLogs(logs2, mockEmployees);

    const alice = result1.find((r) => r.employee_id === "1");
    const bob = result2.find((r) => r.employee_id === "2");

    expect(alice?.total_hours_worked).toBe(5);
    expect(bob?.total_hours_worked).toBe(5);
  });

  it("should handle employees with a single punch by setting last_punch to null and 0 hours worked", () => {
    const logs = [
      {
        id: 1,
        employee_id: 1,
        employee_name: "Alice Smith",
        log_date_time: "2026-06-22T08:00:00.000Z",
        log_time: "08:00:00",
        log_date: "2026-06-22",
      },
    ];

    const result = processDailyLogs(logs, mockEmployees);
    const alice = result.find((r) => r.employee_id === "1");

    expect(alice?.first_punch).toBe("2026-06-22T08:00:00.000Z");
    expect(alice?.last_punch).toBeNull();
    expect(alice?.total_hours_worked).toBe(0);
  });

  it("should calculate correct status based on workStartTime and gracePeriod parameters", () => {
    const logs = [
      {
        id: 1,
        employee_id: 1,
        employee_name: "Alice Smith",
        log_date_time: "2026-06-22T09:10:00.000Z",
        log_time: "09:10:00",
        log_date: "2026-06-22",
      },
      {
        id: 2,
        employee_id: 2,
        employee_name: "Bob Jones",
        log_date_time: "2026-06-22T09:20:00.000Z",
        log_time: "09:20:00",
        log_date: "2026-06-22",
      },
    ];

    // Under workStartTime 09:00 and gracePeriod 15 (cutoff 09:15)
    const result = processDailyLogs(logs, mockEmployees, "09:00", 15);
    const alice = result.find((r) => r.employee_id === "1");
    const bob = result.find((r) => r.employee_id === "2");

    expect(alice?.status).toBe("present"); // 09:10 <= 09:15
    expect(bob?.status).toBe("late");    // 09:20 > 09:15
  });
});

describe("processUserHistoryLogs", () => {
  const employee = { employee_id: 1, employee_name: "Alice Smith" };

  it("should return an empty array if logs is empty", () => {
    const result = processUserHistoryLogs([], employee);
    expect(result).toEqual([]);
  });

  it("should group logs by date, sort dates descending, and attach date string to each PersonnelAnalytics record", () => {
    const logs = [
      {
        id: 1,
        employee_id: 1,
        employee_name: "Alice Smith",
        log_date_time: "2026-06-21T08:00:00.000Z",
        log_time: "08:00:00",
        log_date: "2026-06-21",
      },
      {
        id: 2,
        employee_id: 1,
        employee_name: "Alice Smith",
        log_date_time: "2026-06-21T17:00:00.000Z",
        log_time: "17:00:00",
        log_date: "2026-06-21",
      },
      {
        id: 3,
        employee_id: 1,
        employee_name: "Alice Smith",
        log_date_time: "2026-06-23T08:30:00.000Z",
        log_time: "08:30:00",
        log_date: "2026-06-23",
      },
      {
        id: 4,
        employee_id: 1,
        employee_name: "Alice Smith",
        log_date_time: "2026-06-22T08:00:00.000Z",
        log_time: "08:00:00",
        log_date: "2026-06-22",
      },
    ];

    const result = processUserHistoryLogs(logs, employee, "08:00", 15);

    // Verify descending sort order across all generated dates
    const dates = result.map((r) => r.date || "");
    const expectedSorted = [...dates].sort((a, b) => b.localeCompare(a));
    expect(dates).toEqual(expectedSorted);

    const rec23 = result.find((r) => r.date === "2026-06-23");
    const rec22 = result.find((r) => r.date === "2026-06-22");
    const rec21 = result.find((r) => r.date === "2026-06-21");

    expect(rec23).toBeDefined();
    expect(rec22).toBeDefined();
    expect(rec21).toBeDefined();

    // Check 2026-06-23 record (log at 08:30 with workStartTime 08:00, gracePeriod 15 => late)
    expect(rec23?.employee_id).toBe("1");
    expect(rec23?.status).toBe("late");

    // Check 2026-06-21 record (hours logged)
    expect(rec21?.total_hours_worked).toBe(8);
  });

  it("should generate absent records for missing weekdays and exclude weekends", () => {
    const mockEmployee = { employee_id: 1, employee_name: "Alice Smith" };
    const logs = [
      {
        id: 1,
        employee_id: 1,
        employee_name: "Alice Smith",
        log_date_time: "2026-06-19T08:00:00.000Z",
        log_time: "08:00:00",
        log_date: "2026-06-19",
      },
      {
        id: 2,
        employee_id: 1,
        employee_name: "Alice Smith",
        log_date_time: "2026-06-23T08:00:00.000Z",
        log_time: "08:00:00",
        log_date: "2026-06-23",
      },
    ];

    const result = processUserHistoryLogs(logs, mockEmployee, "08:00", 0);

    const dates = result.map((r) => r.date || "");
    expect(dates).toContain("2026-06-19");
    expect(dates).toContain("2026-06-22");
    expect(dates).toContain("2026-06-23");
    expect(dates).not.toContain("2026-06-20");
    expect(dates).not.toContain("2026-06-21");

    const mon = result.find((r) => r.date === "2026-06-22");
    expect(mon?.status).toBe("absent");
  });

  it("should restrict evaluated dates to the target month when selectedDate is provided", () => {
    const mockEmployee = { employee_id: 1, employee_name: "Alice Smith" };
    const logs = [
      {
        id: 1,
        employee_id: 1,
        employee_name: "Alice Smith",
        log_date_time: "2026-06-15T08:00:00.000Z",
        log_time: "08:00:00",
        log_date: "2026-06-15",
      },
    ];

    // Evaluate for June 2026 when selectedDate is "2026-06-01"
    const result = processUserHistoryLogs(logs, mockEmployee, "08:00", 0, "2026-06-01");

    const dates = result.map((r) => r.date || "");
    expect(dates.length).toBeGreaterThan(0);
    expect(dates.every((d) => d.startsWith("2026-06-"))).toBe(true);
    expect(dates).not.toContain("2026-07-01");
  });
});

describe("calculateEmployeePersonalStats", () => {
  it("calculates monthly on-time rate, weekly hours, late count, and present days correctly", () => {
    const mockLogs: RawBiometricLog[] = [
      { id: 1, employee_id: 101, employee_name: "Alice", log_date: "2026-07-06", log_time: "08:50:00", log_date_time: "2026-07-06T08:50:00Z" },
      { id: 2, employee_id: 101, employee_name: "Alice", log_date: "2026-07-06", log_time: "17:00:00", log_date_time: "2026-07-06T17:00:00Z" },
      { id: 3, employee_id: 101, employee_name: "Alice", log_date: "2026-07-07", log_time: "09:30:00", log_date_time: "2026-07-07T09:30:00Z" },
      { id: 4, employee_id: 101, employee_name: "Alice", log_date: "2026-07-07", log_time: "17:00:00", log_date_time: "2026-07-07T17:00:00Z" },
    ];
    const monthDates = ["2026-07-06", "2026-07-07", "2026-07-08"]; // 3 workdays
    const stats = calculateEmployeePersonalStats(mockLogs, 101, "09:00", 15, monthDates, "2026-07-07");
    expect(stats.presentDaysCount).toBe(2);
    expect(stats.lateCount).toBe(1);
    expect(stats.onTimeRatePercent).toBe(50);
    expect(stats.avgLateMins).toBe(30);
    expect(stats.elapsedWorkdaysCount).toBe(2);
    expect(stats.loggedHoursThisWeek).toBe(13.67);
    expect(stats.todayStatus.state).toBe("checked_out");
    expect(stats.todayStatus.firstPunch).toBe("2026-07-07T09:30:00Z");
    expect(stats.todayStatus.lastPunch).toBe("2026-07-07T17:00:00Z");
  });

  it("handles todayStatus with no scans (not_scanned) and single scan (checked_in)", () => {
    const mockLogs: RawBiometricLog[] = [
      { id: 1, employee_id: 101, employee_name: "Alice", log_date: "2026-07-07", log_time: "08:50:00", log_date_time: "2026-07-07T08:50:00Z" },
    ];
    const monthDates = ["2026-07-07"];
    const stats1 = calculateEmployeePersonalStats(mockLogs, 101, "09:00", 15, monthDates, "2026-07-07");
    expect(stats1.todayStatus).toEqual({
      state: "checked_in",
      firstPunch: "2026-07-07T08:50:00Z",
      lastPunch: null,
    });

    const stats2 = calculateEmployeePersonalStats([], 101, "09:00", 15, monthDates, "2026-07-07");
    expect(stats2.todayStatus).toEqual({
      state: "not_scanned",
      firstPunch: null,
      lastPunch: null,
    });
  });

  it("calculates weekly hours correctly across month transition (e.g. July 1st is Wednesday, Monday June 29 & Tuesday June 30 included)", () => {
    const mockLogs: RawBiometricLog[] = [
      { id: 1, employee_id: 101, employee_name: "Alice", log_date: "2026-06-29", log_time: "09:00:00", log_date_time: "2026-06-29T09:00:00Z" },
      { id: 2, employee_id: 101, employee_name: "Alice", log_date: "2026-06-29", log_time: "17:00:00", log_date_time: "2026-06-29T17:00:00Z" },
      { id: 3, employee_id: 101, employee_name: "Alice", log_date: "2026-06-30", log_time: "09:00:00", log_date_time: "2026-06-30T09:00:00Z" },
      { id: 4, employee_id: 101, employee_name: "Alice", log_date: "2026-06-30", log_time: "17:00:00", log_date_time: "2026-06-30T17:00:00Z" },
      { id: 5, employee_id: 101, employee_name: "Alice", log_date: "2026-07-01", log_time: "09:00:00", log_date_time: "2026-07-01T09:00:00Z" },
      { id: 6, employee_id: 101, employee_name: "Alice", log_date: "2026-07-01", log_time: "17:00:00", log_date_time: "2026-07-01T17:00:00Z" },
    ];
    const monthDates = ["2026-07-01", "2026-07-02", "2026-07-03"];
    const stats = calculateEmployeePersonalStats(mockLogs, 101, "09:00", 15, monthDates, "2026-07-01");
    expect(stats.loggedHoursThisWeek).toBe(21);
    expect(stats.presentDaysCount).toBe(1);
  });
});

describe("generateMonthlyCalendarMatrix", () => {
  it("generates calendar days with correct status, weekend flags, and current month flags", () => {
    const mockLogs: RawBiometricLog[] = [
      { id: 1, employee_id: 101, employee_name: "Alice", log_date: "2026-07-06", log_time: "08:50:00", log_date_time: "2026-07-06T08:50:00Z" },
      { id: 2, employee_id: 101, employee_name: "Alice", log_date: "2026-07-06", log_time: "17:00:00", log_date_time: "2026-07-06T17:00:00Z" },
      { id: 3, employee_id: 101, employee_name: "Alice", log_date: "2026-07-07", log_time: "09:30:00", log_date_time: "2026-07-07T09:30:00Z" },
      { id: 4, employee_id: 101, employee_name: "Alice", log_date: "2026-07-07", log_time: "17:00:00", log_date_time: "2026-07-07T17:00:00Z" },
    ];
    // Year 2026, Month 7 (July 2026). todayStr: "2026-07-07"
    const matrix = generateMonthlyCalendarMatrix(mockLogs, 101, 2026, 7, "09:00", 15, "2026-07-07");

    expect(matrix.length).toBeGreaterThanOrEqual(31);

    // Find July 6, 2026
    const july6 = matrix.find((d) => d.date === "2026-07-06");
    expect(july6).toBeDefined();
    expect(july6?.isCurrentMonth).toBe(true);
    expect(july6?.isWeekend).toBe(false);
    expect(july6?.status).toBe("on_time");
    expect(july6?.totalHours).toBe(7.17);

    // Find July 7, 2026
    const july7 = matrix.find((d) => d.date === "2026-07-07");
    expect(july7?.status).toBe("late");
    expect(july7?.lateMins).toBe(30);

    // Find July 8, 2026 (future date > todayStr)
    const july8 = matrix.find((d) => d.date === "2026-07-08");
    expect(july8?.status).toBe("future");

    // Find July 5, 2026 (Sunday -> weekend)
    const july5 = matrix.find((d) => d.date === "2026-07-05");
    expect(july5?.status).toBe("weekend");
    expect(july5?.isWeekend).toBe(true);

    // Find July 1, 2026 (Wednesday, past date before July 6 with no logs -> absent)
    const july1 = matrix.find((d) => d.date === "2026-07-01");
    expect(july1?.status).toBe("absent");
  });

  it("should align grid matrix with Sunday as the first column of the week", () => {
    // July 1, 2026 is a Wednesday (getUTCDay = 3).
    // For Sunday-first calendar, leading padding starts on Sunday June 28, 2026.
    const matrix = generateMonthlyCalendarMatrix([], 101, 2026, 7, "09:00", 15, "2026-07-07");
    expect(matrix[0].date).toBe("2026-06-28"); // Sunday
    expect(matrix[0].isWeekend).toBe(true);
    expect(matrix[3].date).toBe("2026-07-01"); // Wednesday (July 1st)
  });
});

// ---------------------------------------------------------------------------
// Leave + holiday attendance rules
// ---------------------------------------------------------------------------

describe("leave and holiday attendance rules", () => {
  const WORK_START = "09:00";
  const GRACE = 15;
  const EMP_A = 100;
  const EMP_B = 200;

  const employees = [
    { employee_id: EMP_A, employee_name: "Emp A" },
    { employee_id: EMP_B, employee_name: "Emp B" },
  ];

  let nextId = 1;
  function punch(
    empId: number,
    name: string,
    date: string,
    timeIn: string,
    timeOut?: string
  ): RawBiometricLog[] {
    const logs: RawBiometricLog[] = [
      {
        id: nextId++,
        employee_id: empId,
        employee_name: name,
        log_date: date,
        log_time: `${timeIn}:00`,
        log_date_time: `${date}T${timeIn}:00Z`,
      },
    ];
    if (timeOut) {
      logs.push({
        id: nextId++,
        employee_id: empId,
        employee_name: name,
        log_date: date,
        log_time: `${timeOut}:00`,
        log_date_time: `${date}T${timeOut}:00Z`,
      });
    }
    return logs;
  }

  const leaveRows = [
    { employee_id: EMP_A, start_date: "2026-09-10", end_date: "2026-09-11" },
  ];
  const holidayRows = [{ start_date: "2026-09-07", end_date: "2026-09-07" }];

  const leaveIndex = buildLeaveIndex(leaveRows);
  const holidayIndex = buildHolidayIndex(holidayRows);

  const empALogs: RawBiometricLog[] = [
    ...punch(EMP_A, "Emp A", "2026-09-01", "09:20", "17:00"),
    ...punch(EMP_A, "Emp A", "2026-09-07", "08:50", "17:00"),
    ...punch(EMP_A, "Emp A", "2026-09-08", "08:55", "17:00"),
    ...punch(EMP_A, "Emp A", "2026-09-09", "09:00", "17:00"),
    ...punch(EMP_A, "Emp A", "2026-09-10", "09:05", "17:00"),
    ...punch(EMP_A, "Emp A", "2026-09-14", "08:50", "17:00"),
    ...punch(EMP_A, "Emp A", "2026-09-15", "08:50", "17:00"),
    ...punch(EMP_A, "Emp A", "2026-09-16", "08:50", "17:00"),
    ...punch(EMP_A, "Emp A", "2026-09-17", "08:50", "17:00"),
    ...punch(EMP_A, "Emp A", "2026-09-18", "08:50", "17:00"),
  ];

  const empBLogs: RawBiometricLog[] = [
    ...punch(EMP_B, "Emp B", "2026-09-07", "09:00", "17:00"),
    ...punch(EMP_B, "Emp B", "2026-09-10", "09:00", "17:00"),
    ...punch(EMP_B, "Emp B", "2026-09-18", "09:00", "17:00"),
  ];

  const allLogs = [...empALogs, ...empBLogs];

  const monthDates: string[] = [];
  for (let d = 1; d <= 30; d++) {
    monthDates.push(`2026-09-${String(d).padStart(2, "0")}`);
  }

  function dayLogs(date: string) {
    return allLogs.filter((l) => l.log_date === date);
  }

  it("should keep an employee as on leave even if they punched that day", () => {
    const result = processDailyLogs(
      dayLogs("2026-09-10"),
      employees,
      WORK_START,
      GRACE,
      "2026-09-10",
      leaveIndex,
      holidayIndex
    );
    const a = result.find((r) => r.employee_id === "100");
    expect(a?.status).toBe("on_leave");
    expect(a?.first_punch).toContain("09:05");
    expect(a?.raw_logs?.length).toBeGreaterThan(0);
  });

  it("should still mark another employee as present on someone else's leave day", () => {
    const result = processDailyLogs(
      dayLogs("2026-09-10"),
      employees,
      WORK_START,
      GRACE,
      "2026-09-10",
      leaveIndex,
      holidayIndex
    );
    const b = result.find((r) => r.employee_id === "200");
    expect(b?.status).toBe("present");
  });

  it("should mark every employee as holiday on a company holiday even if they punched", () => {
    const result = processDailyLogs(
      dayLogs("2026-09-07"),
      employees,
      WORK_START,
      GRACE,
      "2026-09-07",
      leaveIndex,
      holidayIndex
    );
    expect(result.find((r) => r.employee_id === "100")?.status).toBe("holiday");
    expect(result.find((r) => r.employee_id === "200")?.status).toBe("holiday");
  });

  it("should keep a Saturday as weekend on the calendar even if a holiday overlaps", () => {
    const holidayOnSat = buildHolidayIndex([
      { start_date: "2026-09-05", end_date: "2026-09-05" },
    ]);
    const matrix = generateMonthlyCalendarMatrix(
      [],
      EMP_A,
      2026,
      9,
      WORK_START,
      GRACE,
      "2026-09-18",
      new Set(),
      holidayOnSat
    );
    const sat = matrix.find((d) => d.date === "2026-09-05");
    expect(sat?.status).toBe("weekend");
  });

  it("should mark a Saturday with no punch as absent in daily logs", () => {
    const result = processDailyLogs(
      [],
      [{ employee_id: EMP_A, employee_name: "Emp A" }],
      WORK_START,
      GRACE,
      "2026-09-05",
      new Set(),
      new Set()
    );
    expect(result[0].status).toBe("absent");
  });

  it("should mark a weekday with no punch as absent", () => {
    const result = processDailyLogs(
      [],
      [{ employee_id: EMP_A, employee_name: "Emp A" }],
      WORK_START,
      GRACE,
      "2026-09-02",
      leaveIndex,
      holidayIndex
    );
    expect(result[0].status).toBe("absent");
  });

  it("should show leave and holiday days correctly in a member's attendance history", () => {
    const history = processUserHistoryLogs(
      empALogs,
      { employee_id: EMP_A, employee_name: "Emp A" },
      WORK_START,
      GRACE,
      "2026-09-18",
      leaveIndex,
      holidayIndex
    );
    expect(history.find((r) => r.date === "2026-09-10")?.status).toBe("on_leave");
    expect(history.find((r) => r.date === "2026-09-07")?.status).toBe("holiday");
  });

  it("should show holiday, on leave, and present days correctly on the calendar", () => {
    const matrix = generateMonthlyCalendarMatrix(
      empALogs,
      EMP_A,
      2026,
      9,
      WORK_START,
      GRACE,
      "2026-09-18",
      leaveIndex,
      holidayIndex
    );
    expect(matrix.find((d) => d.date === "2026-09-07")?.status).toBe("holiday");
    expect(matrix.find((d) => d.date === "2026-09-10")?.status).toBe("on_leave");
    expect(matrix.find((d) => d.date === "2026-09-11")?.status).toBe("on_leave");
    expect(matrix.find((d) => d.date === "2026-09-08")?.status).toBe("on_time");
    expect(matrix.find((d) => d.date === "2026-09-10")?.logs.length).toBeGreaterThan(0);
    expect(matrix.find((d) => d.date === "2026-09-07")?.logs.length).toBeGreaterThan(0);
  });

  it("should change a punched day to on leave after leave is set later", () => {
    const sep21Logs = punch(EMP_A, "Emp A", "2026-09-21", "09:00", "17:00");
    const before = processDailyLogs(
      sep21Logs,
      [{ employee_id: EMP_A, employee_name: "Emp A" }],
      WORK_START,
      GRACE,
      "2026-09-21",
      new Set(),
      new Set()
    );
    expect(before[0].status).toBe("present");

    const afterLeave = buildLeaveIndex([
      { employee_id: EMP_A, start_date: "2026-09-21", end_date: "2026-09-21" },
    ]);
    const after = processDailyLogs(
      sep21Logs,
      [{ employee_id: EMP_A, employee_name: "Emp A" }],
      WORK_START,
      GRACE,
      "2026-09-21",
      afterLeave,
      new Set()
    );
    expect(after[0].status).toBe("on_leave");
    expect(after[0].first_punch).toBeTruthy();
  });

  it("should calculate days present, on-time rate, late arrivals, and weekly hours without counting leave or holiday days", () => {
    const stats = calculateEmployeePersonalStats(
      empALogs,
      EMP_A,
      WORK_START,
      GRACE,
      monthDates,
      "2026-09-18",
      leaveIndex,
      holidayIndex
    );

    expect(stats.presentDaysCount).toBe(8);
    expect(stats.elapsedWorkdaysCount).toBe(11);
    expect(stats.onTimeRatePercent).toBe(64);
    expect(stats.lateCount).toBe(1);
    expect(stats.avgLateMins).toBe(20);
    expect(stats.loggedHoursThisWeek).toBe(35.85);
  });

  it("should not change attendance totals when there are extra punches on leave or holiday days", () => {
    const base = calculateEmployeePersonalStats(
      empALogs,
      EMP_A,
      WORK_START,
      GRACE,
      monthDates,
      "2026-09-18",
      leaveIndex,
      holidayIndex
    );
    const extraLeavePunch = [
      ...empALogs,
      ...punch(EMP_A, "Emp A", "2026-09-10", "10:00", "18:00"),
    ];
    const after = calculateEmployeePersonalStats(
      extraLeavePunch,
      EMP_A,
      WORK_START,
      GRACE,
      monthDates,
      "2026-09-18",
      leaveIndex,
      holidayIndex
    );
    expect(after.presentDaysCount).toBe(base.presentDaysCount);
    expect(after.onTimeRatePercent).toBe(base.onTimeRatePercent);
    expect(after.lateCount).toBe(base.lateCount);
  });

  it("should exclude leave and holiday days from logged hours for the week", () => {
    const stats = calculateEmployeePersonalStats(
      empALogs,
      EMP_A,
      WORK_START,
      GRACE,
      monthDates,
      "2026-09-11",
      leaveIndex,
      holidayIndex
    );
    expect(stats.loggedHoursThisWeek).toBe(14.08);
  });

  it("should show today as on leave even if the employee punched", () => {
    const stats = calculateEmployeePersonalStats(
      empALogs,
      EMP_A,
      WORK_START,
      GRACE,
      monthDates,
      "2026-09-10",
      leaveIndex,
      holidayIndex
    );
    expect(stats.todayStatus.state).toBe("on_leave");
  });

  it("should show today as holiday even if the employee punched", () => {
    const stats = calculateEmployeePersonalStats(
      empALogs,
      EMP_A,
      WORK_START,
      GRACE,
      monthDates,
      "2026-09-07",
      leaveIndex,
      holidayIndex
    );
    expect(stats.todayStatus.state).toBe("holiday");
  });

  it("should not count future days after today toward expected workdays", () => {
    const stats = calculateEmployeePersonalStats(
      empALogs,
      EMP_A,
      WORK_START,
      GRACE,
      monthDates,
      "2026-09-18",
      leaveIndex,
      holidayIndex
    );
    expect(stats.elapsedWorkdaysCount).toBe(11);
  });

  it("should count an on-leave employee under on leave and not under present, late, or absent", () => {
    const processed = processDailyLogs(
      dayLogs("2026-09-10"),
      employees,
      WORK_START,
      GRACE,
      "2026-09-10",
      leaveIndex,
      holidayIndex
    );
    const onLeaveCount = processed.filter((e) => e.status === "on_leave").length;
    expect(onLeaveCount).toBe(1);
    expect(processed.find((e) => e.employee_id === "100")?.status).toBe("on_leave");
    expect(processed.filter((e) => e.status === "present").length).toBe(1);
    expect(processed.filter((e) => e.status === "late").length).toBe(0);
    expect(processed.filter((e) => e.status === "absent").length).toBe(0);
  });

  it("should omit holiday employees from present, late, absent, and on leave counts", () => {
    const processed = processDailyLogs(
      dayLogs("2026-09-07"),
      employees,
      WORK_START,
      GRACE,
      "2026-09-07",
      leaveIndex,
      holidayIndex
    );
    expect(processed.every((e) => e.status === "holiday")).toBe(true);
    expect(processed.filter((e) => e.status === "present").length).toBe(0);
    expect(processed.filter((e) => e.status === "on_leave").length).toBe(0);
  });

  it("should count employees as present on a normal workday", () => {
    const processed = processDailyLogs(
      dayLogs("2026-09-18"),
      employees,
      WORK_START,
      GRACE,
      "2026-09-18",
      leaveIndex,
      holidayIndex
    );
    expect(processed.filter((e) => e.status === "present").length).toBe(2);
    expect(processed.filter((e) => e.status === "on_leave").length).toBe(0);
  });

  it("should exclude leave and holiday days from the weekly present and late chart", () => {
    const thu = processDailyLogs(
      dayLogs("2026-09-10"),
      employees,
      WORK_START,
      GRACE,
      "2026-09-10",
      leaveIndex,
      holidayIndex
    );
    expect(
      thu.filter(
        (e) =>
          e.employee_id === "100" &&
          (e.status === "present" || e.status === "late")
      ).length
    ).toBe(0);

    const mon = processDailyLogs(
      dayLogs("2026-09-07"),
      employees,
      WORK_START,
      GRACE,
      "2026-09-07",
      leaveIndex,
      holidayIndex
    );
    expect(
      mon.filter((e) => e.status === "present" || e.status === "late").length
    ).toBe(0);
  });

  it("should restore present status from punches after leave is removed", () => {
    const withLeave = processDailyLogs(
      dayLogs("2026-09-10"),
      employees,
      WORK_START,
      GRACE,
      "2026-09-10",
      leaveIndex,
      holidayIndex
    );
    expect(withLeave.find((e) => e.employee_id === "100")?.status).toBe("on_leave");

    const withoutLeave = processDailyLogs(
      dayLogs("2026-09-10"),
      employees,
      WORK_START,
      GRACE,
      "2026-09-10",
      new Set(),
      holidayIndex
    );
    expect(withoutLeave.find((e) => e.employee_id === "100")?.status).toBe(
      "present"
    );

    const statsAfter = calculateEmployeePersonalStats(
      empALogs,
      EMP_A,
      WORK_START,
      GRACE,
      monthDates,
      "2026-09-18",
      new Set(),
      holidayIndex
    );
    expect(statsAfter.presentDaysCount).toBe(9);
  });

  it("should restore present status from punches after a holiday is removed", () => {
    const withoutHoliday = processDailyLogs(
      dayLogs("2026-09-07"),
      employees,
      WORK_START,
      GRACE,
      "2026-09-07",
      leaveIndex,
      new Set()
    );
    expect(withoutHoliday.find((e) => e.employee_id === "100")?.status).toBe(
      "present"
    );

    const statsAfter = calculateEmployeePersonalStats(
      empALogs,
      EMP_A,
      WORK_START,
      GRACE,
      monthDates,
      "2026-09-18",
      leaveIndex,
      new Set()
    );
    expect(statsAfter.presentDaysCount).toBe(9);
  });

  it("should match member days present with present and late rows in attendance history", () => {
    const stats = calculateEmployeePersonalStats(
      empALogs,
      EMP_A,
      WORK_START,
      GRACE,
      monthDates,
      "2026-09-18",
      leaveIndex,
      holidayIndex
    );
    const history = processUserHistoryLogs(
      empALogs,
      { employee_id: EMP_A, employee_name: "Emp A" },
      WORK_START,
      GRACE,
      "2026-09-18",
      leaveIndex,
      holidayIndex
    );
    const presentOrLate = history.filter(
      (r) =>
        r.date &&
        r.date <= "2026-09-18" &&
        (r.status === "present" || r.status === "late")
    ).length;
    expect(presentOrLate).toBe(stats.presentDaysCount);
  });

  it("should remove a day from attendance totals after it is marked as leave", () => {
    const sep21Logs = punch(EMP_A, "Emp A", "2026-09-21", "09:20", "17:00");
    const logsWith21 = [...empALogs, ...sep21Logs];

    const beforeLeave = calculateEmployeePersonalStats(
      logsWith21,
      EMP_A,
      WORK_START,
      GRACE,
      monthDates,
      "2026-09-21",
      leaveIndex,
      holidayIndex
    );
    expect(beforeLeave.presentDaysCount).toBe(9);
    expect(beforeLeave.lateCount).toBe(2);

    const leaveWith21 = buildLeaveIndex([
      ...leaveRows,
      { employee_id: EMP_A, start_date: "2026-09-21", end_date: "2026-09-21" },
    ]);
    const afterLeave = calculateEmployeePersonalStats(
      logsWith21,
      EMP_A,
      WORK_START,
      GRACE,
      monthDates,
      "2026-09-21",
      leaveWith21,
      holidayIndex
    );
    expect(afterLeave.presentDaysCount).toBe(8);
    expect(afterLeave.lateCount).toBe(1);

    const dayStatus = processDailyLogs(
      sep21Logs,
      [{ employee_id: EMP_A, employee_name: "Emp A" }],
      WORK_START,
      GRACE,
      "2026-09-21",
      leaveWith21,
      holidayIndex
    );
    expect(dayStatus[0].status).toBe("on_leave");
  });

  it("should mark September days as on leave when leave started in the previous month", () => {
    const leave = buildLeaveIndex([
      { employee_id: EMP_A, start_date: "2026-08-31", end_date: "2026-09-02" },
    ]);
    const history = processUserHistoryLogs(
      [
        ...punch(EMP_A, "Emp A", "2026-09-01", "09:00"),
        ...punch(EMP_A, "Emp A", "2026-09-02", "09:00"),
        ...punch(EMP_A, "Emp A", "2026-09-03", "09:00"),
      ],
      { employee_id: EMP_A, employee_name: "Emp A" },
      WORK_START,
      GRACE,
      "2026-09-18",
      leave,
      new Set()
    );
    expect(history.find((r) => r.date === "2026-09-01")?.status).toBe("on_leave");
    expect(history.find((r) => r.date === "2026-09-02")?.status).toBe("on_leave");
  });

  it("should mark in-range days as holiday when a holiday spans the previous month", () => {
    const holiday = buildHolidayIndex([
      { start_date: "2026-08-31", end_date: "2026-09-01" },
    ]);
    const sepMatrix = generateMonthlyCalendarMatrix(
      [],
      EMP_A,
      2026,
      9,
      WORK_START,
      GRACE,
      "2026-09-18",
      new Set(),
      holiday
    );
    expect(sepMatrix.find((d) => d.date === "2026-09-01")?.status).toBe("holiday");
  });

  it("should filter daily logs to only on leave or only holiday employees when asked", () => {
    const leaveDay = processDailyLogs(
      dayLogs("2026-09-10"),
      employees,
      WORK_START,
      GRACE,
      "2026-09-10",
      leaveIndex,
      holidayIndex
    );
    const onLeaveOnly = leaveDay.filter((r) => r.status === "on_leave");
    expect(onLeaveOnly.map((r) => r.employee_id)).toEqual(["100"]);

    const holidayDay = processDailyLogs(
      dayLogs("2026-09-07"),
      employees,
      WORK_START,
      GRACE,
      "2026-09-07",
      leaveIndex,
      holidayIndex
    );
    const holidayOnly = holidayDay.filter((r) => r.status === "holiday");
    expect(holidayOnly).toHaveLength(2);
  });
});

