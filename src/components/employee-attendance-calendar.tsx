"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sun,
  LogIn,
  LogOut,
  List,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  generateMonthlyCalendarMatrix,
  CalendarDayStatus,
  RawBiometricLog,
  buildLeaveIndex,
  LeaveRow,
  buildHolidayIndex,
  HolidayRow,
} from "@/utils/attendance-processor";
import { cn } from "@/lib/utils";

export interface EmployeeAttendanceCalendarProps {
  logs: RawBiometricLog[];
  employeeId: number;
  workStartTime: string;
  gracePeriod: number;
  leaves?: LeaveRow[];
  holidays?: HolidayRow[];
  /**
   * Initial year (e.g. 2026). Defaults to current year.
   */
  initialYear?: number;
  /**
   * Initial month 1-indexed (1 = January, 12 = December). Defaults to current month.
   */
  initialMonth?: number;
  /**
   * If true, hides the month navigation header (useful when parent component renders navigation).
   */
  hideMonthNavigation?: boolean;
}

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EMPTY_LEAVES: LeaveRow[] = [];
const EMPTY_HOLIDAYS: HolidayRow[] = [];

export function formatTimeDisplay(punchStr: string | null, includeSeconds = false): string {
  if (!punchStr) return "--:--";
  try {
    let timePart = punchStr;
    if (punchStr.includes("T")) {
      timePart = punchStr.substring(11);
    }
    const parts = timePart.split(":");
    if (parts.length >= 2) {
      let hours = parseInt(parts[0], 10);
      const minutes = parts[1].substring(0, 2);
      const rawSecs = parts[2] ? parts[2].substring(0, 2) : "";
      const seconds = rawSecs ? `:${rawSecs}` : "";
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12 || 12;
      return `${String(hours).padStart(2, "0")}:${minutes}${includeSeconds && seconds ? seconds : ""} ${ampm}`;
    }
  } catch {
    // Return original string on parse failure
  }
  return punchStr;
}

function formatDateTitle(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return dateStr;
  }
}

export function EmployeeAttendanceCalendar({
  logs,
  leaves = EMPTY_LEAVES,
  holidays = EMPTY_HOLIDAYS,
  employeeId,
  workStartTime,
  gracePeriod,
  initialYear,
  initialMonth,
  hideMonthNavigation = false,
}: EmployeeAttendanceCalendarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const todayObj = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => {
    const yyyy = todayObj.getFullYear();
    const mm = String(todayObj.getMonth() + 1).padStart(2, "0");
    const dd = String(todayObj.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, [todayObj]);

  const dateParam = searchParams ? searchParams.get("date") : null;

  const [year, setYear] = useState<number>(() => {
    if (initialYear !== undefined) return initialYear;
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const y = parseInt(dateParam.split("-")[0], 10);
      if (!isNaN(y)) return y;
    }
    return todayObj.getFullYear();
  });

  const [month, setMonth] = useState<number>(() => {
    if (initialMonth !== undefined) return initialMonth;
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const m = parseInt(dateParam.split("-")[1], 10);
      if (!isNaN(m) && m >= 1 && m <= 12) return m;
    }
    return todayObj.getMonth() + 1;
  });

  useEffect(() => {
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const [yStr, mStr] = dateParam.split("-");
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12) {
        setYear(y);
        setMonth(m);
      }
    }
  }, [dateParam]);

  const [selectedDay, setSelectedDay] = useState<CalendarDayStatus | null>(
    null
  );

  const handlePrevMonth = () => {
    let newMonth = month - 1;
    let newYear = year;
    if (newMonth < 1) {
      newMonth = 12;
      newYear = year - 1;
    }
    setMonth(newMonth);
    setYear(newYear);
    const formattedFirstDayOfMonth = `${newYear}-${String(newMonth).padStart(2, "0")}-01`;
    router.push("/dashboard/analytics?date=" + formattedFirstDayOfMonth);
  };

  const handleNextMonth = () => {
    let newMonth = month + 1;
    let newYear = year;
    if (newMonth > 12) {
      newMonth = 1;
      newYear = year + 1;
    }
    setMonth(newMonth);
    setYear(newYear);
    const formattedFirstDayOfMonth = `${newYear}-${String(newMonth).padStart(2, "0")}-01`;
    router.push("/dashboard/analytics?date=" + formattedFirstDayOfMonth);
  };

  const handleToday = () => {
    const newYear = todayObj.getFullYear();
    const newMonth = todayObj.getMonth() + 1;
    setYear(newYear);
    setMonth(newMonth);
    const formattedFirstDayOfMonth = `${newYear}-${String(newMonth).padStart(2, "0")}-01`;
    router.push("/dashboard/analytics?date=" + formattedFirstDayOfMonth);
  };

  const monthLabel = useMemo(() => {
    const d = new Date(year, month - 1, 1);
    return d.toLocaleString("en-US", { month: "long", year: "numeric" });
  }, [year, month]);

  const leaveIndex = useMemo(() => buildLeaveIndex(leaves), [leaves]);
  const holidayIndex = useMemo(() => buildHolidayIndex(holidays), [holidays]);

  const matrix = useMemo(() => {
    return generateMonthlyCalendarMatrix(
      logs,
      employeeId,
      year,
      month,
      workStartTime,
      gracePeriod,
      todayStr,
      leaveIndex,
      holidayIndex
    );
  }, [
    logs,
    employeeId,
    year,
    month,
    workStartTime,
    gracePeriod,
    todayStr,
    leaveIndex,
    holidayIndex,
  ]);

  return (
    <div className="w-full space-y-4">
      {/* Legend Bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs">
        <span className="font-semibold text-muted-foreground mr-1">Legend:</span>
        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1 font-medium">
          <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
          On-Time
        </Badge>
        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1 font-medium">
          <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
          Late
        </Badge>
        <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 gap-1 font-medium">
          <XCircle className="h-3 w-3 text-rose-600 dark:text-rose-400" />
          Absent / Missing Scan
        </Badge>
        <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 gap-1 font-medium">
          <CalendarIcon className="h-3 w-3 text-blue-600 dark:text-blue-400" />
          On Leave
        </Badge>
        <Badge className="bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30 gap-1 font-medium">
          <CalendarIcon className="h-3 w-3 text-slate-600 dark:text-slate-400" />
          Holiday
        </Badge>
        <Badge className="bg-muted text-muted-foreground border-border gap-1 font-medium">
          <Sun className="h-3 w-3 text-muted-foreground" />
          Weekend
        </Badge>
      </div>

      {/* Calendar Grid Matrix */}
      <div className="rounded-xl border bg-card p-2 md:p-3 shadow-xs">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-1 md:gap-2 mb-2 text-center text-xs font-semibold text-muted-foreground">
          {WEEKDAY_NAMES.map((day) => (
            <div key={day} className="py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Cells */}
        <div className="grid grid-cols-7 gap-1 md:gap-2">
          {matrix.map((cell) => {
            const isToday = cell.date === todayStr;

            return (
              <button
                key={cell.date}
                type="button"
                onClick={() => setSelectedDay(cell)}
                aria-label={`${cell.date}: ${cell.status}`}
                className={cn(
                  "group relative flex min-h-20 md:min-h-23 flex-col justify-between rounded-lg border-2 p-1.5 md:p-2 text-left transition-all hover:border-primary/50 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/20",
                  !cell.isCurrentMonth
                    ? "opacity-0"
                    : cell.isWeekend
                      ? "bg-muted/20 border-border/60"
                      : "bg-card border-border/80",
                  isToday && "ring-1 ring-primary border-primary/80"
                )}
              >
                {/* Cell Top Header: Day Number & Status Badge */}
                <div className="flex items-center justify-between w-full gap-1">
                  <span
                    className={cn(
                      "text-xs font-semibold rounded-full h-5 min-w-5 flex items-center justify-center px-1",
                      isToday
                        ? "bg-primary text-primary-foreground font-bold"
                        : cell.isCurrentMonth
                          ? "text-foreground"
                          : "text-muted-foreground"
                    )}
                  >
                    {cell.dayNumber}
                  </span>

                  {cell.isCurrentMonth && (
                    <div className="flex items-center">
                      {cell.status === "on_time" && (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[9px] md:text-[10px] px-1 py-0 h-4">
                          On-Time
                        </Badge>
                      )}
                      {cell.status === "late" && (
                        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[9px] md:text-[10px] px-1 py-0 h-4">
                          Late ({cell.lateMins}m)
                        </Badge>
                      )}
                      {cell.status === "absent" && (
                        <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 text-[9px] md:text-[10px] px-1 py-0 h-4">
                          Absent
                        </Badge>
                      )}
                      {/* added on_leave status to the calendar view */}
                      {cell.status === "on_leave" && (
                        <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 text-[9px] md:text-[10px] px-1 py-0 h-4">
                          On Leave
                        </Badge>
                      )}
                      {cell.status === "holiday" && (
                        <Badge className="bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30 text-[9px] md:text-[10px] px-1 py-0 h-4">
                          Holiday
                        </Badge>
                      )}
                      {cell.status === "weekend" && (
                        <span className="text-[9px] text-muted-foreground/60 hidden sm:inline">
                          Weekend
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Cell Content: Punch Summary */}
                <div className="mt-1 flex flex-col justify-end gap-0.5 text-[10px] md:text-xs">
                  {cell.firstPunch ? (
                    <>
                      <div className="font-mono text-muted-foreground truncate">
                        {formatTimeDisplay(cell.firstPunch)} -{" "}
                        {cell.lastPunch ? formatTimeDisplay(cell.lastPunch) : "--:--"}
                      </div>
                      {cell.totalHours > 0 && (
                        <div className="text-[10px] font-medium text-foreground/80">
                          {cell.totalHours} hrs
                        </div>
                      )}
                    </>
                  ) : cell.isCurrentMonth && !cell.isWeekend && cell.status !== "future" && cell.status !== "on_leave" && cell.status !== "holiday" ? (
                    <span className="text-[10px] text-muted-foreground/60 italic">
                      No scan
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive Day Click Dialog */}
      <Dialog open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent className="sm:max-w-md shadow-sm px-6 py-6">
          {selectedDay && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">
                  {formatDateTitle(selectedDay.date)}
                </DialogTitle>
                <DialogDescription></DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* Summary Banner */}
                <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/20 ">
                  <div>
                    <span className="text-xs text-muted-foreground">Status</span>
                    <div className="mt-1.5">
                      {selectedDay.status === "on_time" && (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-700 gap-1 font-semibold">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          On-Time
                        </Badge>
                      )}
                      {selectedDay.status === "late" && (
                        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-700 gap-1 font-semibold">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Late ({selectedDay.lateMins} mins)
                        </Badge>
                      )}
                      {selectedDay.status === "absent" && (
                        <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-700 gap-1 font-semibold">
                          <XCircle className="h-3.5 w-3.5" />
                          Absent / Missing
                        </Badge>
                      )}
                      {/* added on_leave status to the calendar view */}
                      {selectedDay.status === "on_leave" && (
                        <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-700 gap-1 font-semibold">
                          <CalendarIcon className="h-3.5 w-3.5" />
                          On Leave
                        </Badge>
                      )}
                      {selectedDay.status === "holiday" && (
                        <Badge className="bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-600 gap-1 font-semibold">
                          <CalendarIcon className="h-3.5 w-3.5" />
                          Holiday
                        </Badge>
                      )}
                      {selectedDay.status === "weekend" && (
                        <Badge className="bg-muted text-muted-foreground border-border gap-1 font-semibold">
                          <Sun className="h-3.5 w-3.5" />
                          Weekend
                        </Badge>
                      )}
                      {selectedDay.status === "future" && (
                        <Badge variant="outline" className="text-muted-foreground border-muted-foreground gap-1">
                          Upcoming Day
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs text-muted-foreground">Total Hours Worked</span>
                    <div className="mt-1.5 flex items-center gap-1.5 font-semibold text-sm text-foreground">
                      {selectedDay.totalHours > 0
                        ? `${selectedDay.totalHours} hrs logged`
                        : "0 hrs"}
                    </div>
                  </div>
                </div>

                {/* Raw Biometric Scan Logs Breakdown */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-2.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      Raw Scan Events Breakdown
                    </span>
                    <span className="text-muted-foreground font-normal">
                      {selectedDay.logs.length} scan{selectedDay.logs.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  {selectedDay.logs.length > 0 ? (
                    <div className="max-h-40 overflow-y-auto rounded-lg border border-muted-foreground/50 bg-card divide-y">
                      {selectedDay.logs.map((log, idx) => (
                        <div
                          key={log.id || idx}
                          className="flex items-center justify-between p-2 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-muted-foreground text-[11px]">
                              #{idx + 1}
                            </span>
                            <span className="font-mono font-medium text-foreground">
                              {formatTimeDisplay(log.log_date_time || log.log_time, true)}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            Scan Event
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border-2 border-dashed p-4 text-center text-xs text-muted-foreground">
                      No raw scan events recorded for this date.
                    </div>
                  )}
                </div>

                {/* Clock In / Clock Out Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2.5 rounded-lg border p-2.5 bg-card border-muted-foreground/50 shadow-sm">
                    <div className="rounded-md bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
                      <LogIn className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-[11px] text-muted-foreground">Clock In</div>
                      <div className="text-xs font-mono font-bold text-foreground">
                        {selectedDay.firstPunch
                          ? formatTimeDisplay(selectedDay.firstPunch)
                          : "--:--"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 rounded-lg border p-2.5 bg-card border-muted-foreground/50 shadow-sm">
                    <div className="rounded-md bg-indigo-500/10 p-2 text-indigo-600 dark:text-indigo-400">
                      <LogOut className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-[11px] text-muted-foreground">Clock Out</div>
                      <div className="text-xs font-mono font-bold text-foreground">
                        {selectedDay.lastPunch
                          ? formatTimeDisplay(selectedDay.lastPunch)
                          : "--:--"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
