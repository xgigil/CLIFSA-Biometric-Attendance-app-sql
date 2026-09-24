"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { EmployeeAttendanceCalendar } from "@/components/employee-attendance-calendar";
import { RawBiometricLog, LeaveRow, HolidayRow } from "@/utils/attendance-processor";

export interface EmployeeOption {
  employee_id: number;
  employee_name: string | null;
}

export interface CalendarViewProps {
  logs: RawBiometricLog[];
  userEmpId: number;
  isAdmin: boolean;
  employeesList?: EmployeeOption[];
  selectedEmployeeId: number;
  workStartTime: string;
  gracePeriod: number;
  leaves?: LeaveRow[];
  holidays?: HolidayRow[];
}

export function CalendarView({
  logs,
  leaves = [],
  holidays = [],
  userEmpId,
  isAdmin,
  employeesList = [],
  selectedEmployeeId,
  workStartTime,
  gracePeriod,
}: CalendarViewProps) {
  const searchParams = useSearchParams();

  const todayObj = useMemo(() => new Date(), []);

  const dateParam = searchParams ? searchParams.get("date") : null;

  const { year, month } = useMemo(() => {
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const [yStr, mStr] = dateParam.split("-");
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12) {
        return { year: y, month: m };
      }
    }
    return { year: todayObj.getFullYear(), month: todayObj.getMonth() + 1 };
  }, [dateParam, todayObj]);


  return (
    <div className="w-full space-y-4">
      {/* Employee Attendance Calendar Component */}
      <EmployeeAttendanceCalendar
        logs={logs}
        leaves={leaves}
        holidays={holidays}
        employeeId={selectedEmployeeId}
        workStartTime={workStartTime}
        gracePeriod={gracePeriod}
        initialYear={year}
        initialMonth={month}
        hideMonthNavigation={true}
      />
    </div>
  );
}
