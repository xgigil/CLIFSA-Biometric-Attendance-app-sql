import { describe, it, expect, vi } from "vitest";
import { EmployeeAttendanceCalendar, formatTimeDisplay } from "./employee-attendance-calendar";
import { RawBiometricLog } from "@/utils/attendance-processor";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn().mockReturnValue(null),
  }),
}));

describe("EmployeeAttendanceCalendar", () => {
  const mockLogs: RawBiometricLog[] = [
    {
      id: 1,
      employee_id: 101,
      employee_name: "John Doe",
      log_date_time: "2026-07-06T08:50:00.000Z",
      log_time: "08:50:00",
      log_date: "2026-07-06",
    },
  ];

  it("should be exported as a React component function", () => {
    expect(EmployeeAttendanceCalendar).toBeTypeOf("function");
    expect(EmployeeAttendanceCalendar.name).toBe("EmployeeAttendanceCalendar");
  });

  it("should format ISO timestamp strings directly without applying local timezone offset shifts", () => {
    expect(formatTimeDisplay("2026-06-10T07:49:00.000Z")).toBe("07:49 AM");
    expect(formatTimeDisplay("2026-06-10T17:42:00.000Z")).toBe("05:42 PM");
    expect(formatTimeDisplay("07:49:00")).toBe("07:49 AM");
    expect(formatTimeDisplay("17:42:00")).toBe("05:42 PM");
  });
});
