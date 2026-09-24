import * as React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CalendarCheck2,
  Clock,
  ClockAlert,
  UserCheck,
  LogIn,
  LogOut,
  Fingerprint,
  Sun,
  Moon,
} from "lucide-react";
import { EmployeeMonthlyStats, RawBiometricLog } from "@/utils/attendance-processor";

export interface EmployeeDashboardViewProps {
  stats: EmployeeMonthlyStats;
  recentLogs: RawBiometricLog[];
  userEmployee: { employee_name: string; employee_id: number };
}

function formatTime12h(timeStr: string | null): string {
  if (!timeStr) return "—";
  let timePart = timeStr;
  if (timeStr.includes("T")) {
    timePart = timeStr.substring(11, 19);
  }
  const parts = timePart.split(":");
  if (parts.length < 2) return timeStr;
  const h = parseInt(parts[0], 10);
  const m = parts[1];
  const ampm = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 || 12;
  return `${displayH}:${m} ${ampm}`;
}

function formatDateDisplay(dateStr: string | null, dateTimeStr: string | null): string {
  if (dateStr) return dateStr;
  if (dateTimeStr && dateTimeStr.includes("T")) return dateTimeStr.substring(0, 10);
  return "—";
}

function getScanLabel(timeStr: string | null, dateTimeStr: string | null): string {
  const target = timeStr || dateTimeStr;
  if (!target) return "Device Punch";
  let h = 12;
  if (target.includes("T")) {
    const timePart = target.substring(11, 19);
    h = parseInt(timePart.split(":")[0], 10);
  } else if (target.includes(":")) {
    h = parseInt(target.split(":")[0], 10);
  }
  if (isNaN(h)) return "Device Punch";
  if (h < 12) return "Morning Punch";
  if (h < 17) return "Afternoon Punch";
  return "Evening Punch";
}

function isDaytimePunch(timeStr: string | null, dateTimeStr: string | null): boolean {
  const target = timeStr || dateTimeStr;
  if (!target) return true;
  let h = 12;
  if (target.includes("T")) {
    const timePart = target.substring(11, 19);
    h = parseInt(timePart.split(":")[0], 10);
  } else if (target.includes(":")) {
    h = parseInt(target.split(":")[0], 10);
  }
  if (isNaN(h)) return true;
  return h >= 6 && h < 17;
}

export function EmployeeDashboardView({
  stats,
  recentLogs,
  userEmployee,
}: EmployeeDashboardViewProps) {
  const loggedHoursProgress = Math.min(
    100,
    Math.max(0, (stats.loggedHoursThisWeek / 40.0) * 100)
  );

  const renderTodayStatusBadge = () => {
    switch (stats.todayStatus.state) {
      case "checked_in":
        return (
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800">
            On Duty
          </Badge>
        );
      case "checked_out":
        return (
          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border-blue-300 dark:border-blue-800">
            Shift Complete
          </Badge>
        );
      case "on_leave":
        return (
          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border-blue-300 dark:border-blue-800">
            On Leave
          </Badge>
        );
      case "holiday":
        return (
          <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-900/50 dark:text-slate-300 border-slate-300 dark:border-slate-700">
            Holiday
          </Badge>
        );
      case "not_scanned":
      default:
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-300 dark:border-amber-800">
            Not Checked In
          </Badge>
        );
    }
  };

  const renderTodayStatusHeadline = () => {
    switch (stats.todayStatus.state) {
      case "checked_in":
        return `Checked In at ${formatTime12h(stats.todayStatus.firstPunch)}`;
      case "checked_out":
        return `Checked Out at ${formatTime12h(stats.todayStatus.lastPunch)}`;
      case "on_leave":
        return "On approved leave today";
      case "holiday":
        return "Company holiday today";
      case "not_scanned":
      default:
        return "No Scan Recorded Today";
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">

      {/* 2. 4 Personal Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {/* Card 1: Monthly On-Time Rate */}
        <Card className="@container/card shadow-xs px-2">
          <CardHeader>
            <div className="flex flex-col items-baseline gap-2 pt-2">
              <CardTitle className="text-2xl font-bold text-gray-700 dark:text-gray-100 tabular-nums @[250px]/card:text-3xl">
                {stats.onTimeRatePercent}%
              </CardTitle>
              <CardDescription className="flex items-center text-gray-500 dark:text-gray-400 gap-2 pb-2">
                Monthly On-Time Rate
              </CardDescription>
            </div>
            <CardAction className="pt-2">
              <div className="flex h-16 w-16 items-center justify-center rounded-md bg-emerald-100/80 text-emerald-600 border-3 border-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-400/30">
                <CalendarCheck2 className="size-11" />
              </div>
            </CardAction>
          </CardHeader>
        </Card>

        {/* Card 2: Logged Hours This Week */}
        <Card className="@container/card shadow-xs px-2">
          <CardHeader>
            <div className="flex flex-col items-baseline gap-2 pt-2">
              <CardTitle className="text-2xl font-bold text-gray-700 dark:text-gray-100 tabular-nums @[250px]/card:text-3xl">
                {stats.loggedHoursThisWeek.toFixed(1)}
              </CardTitle>
              <CardDescription className="flex items-center text-gray-500 dark:text-gray-400 gap-2 pb-2">
                Logged Hours This Week
              </CardDescription>
            </div>
            <CardAction className="pt-2">
              <div className="flex h-16 w-16 items-center justify-center rounded-md bg-blue-100/80 text-blue-600 border-3 border-blue-600/20 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-400/30">
                <Clock className="size-11" />
              </div>
            </CardAction>
          </CardHeader>
        </Card>

        {/* Card 3: Late Arrivals */}
        <Card className="@container/card shadow-xs px-2">
          <CardHeader>
            <div className="flex flex-col items-baseline gap-2 pt-2">
              <CardTitle className="text-2xl font-bold text-gray-700 dark:text-gray-100 tabular-nums @[250px]/card:text-3xl">
                {stats.lateCount} {stats.lateCount === 1 ? "time" : "times"}
              </CardTitle>
              <CardDescription className="flex items-center text-gray-500 dark:text-gray-400 gap-2 pb-2">
                Late Arrivals
              </CardDescription>
            </div>
            <CardAction className="pt-2">
              <div className="flex h-16 w-16 items-center justify-center rounded-md bg-amber-100/80 text-amber-600 border-3 border-amber-600/20 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-400/30">
                <ClockAlert className="size-11" />
              </div>
            </CardAction>
          </CardHeader>
        </Card>

        {/* Card 4: Days Present */}
        <Card className="@container/card shadow-xs px-2">
          <CardHeader>
            <div className="flex flex-col items-baseline gap-2 pt-2">
              <CardTitle className="text-2xl font-bold text-gray-700 dark:text-gray-100 tabular-nums @[250px]/card:text-3xl">
                {stats.presentDaysCount}/{stats.elapsedWorkdaysCount}
              </CardTitle>
              <CardDescription className="flex items-center text-gray-500 dark:text-gray-400 gap-2 pb-2">
                Days Present
              </CardDescription>
            </div>
            <CardAction className="pt-2">
              <div className="flex h-16 w-16 items-center justify-center rounded-md bg-indigo-100/80 text-indigo-800 border-3 border-indigo-800/30 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-400/30">
                <UserCheck className="size-11" />
              </div>
            </CardAction>
          </CardHeader>
        </Card>
      </div>

      {/* 3. Lower Section (2 columns on large screens) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start mb-8">
        {/* Column 1: Today's Shift Status */}
        <Card className="shadow-xs">
          <CardHeader className="border-b pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">
                  Today's Shift Status
                </CardTitle>
                <CardDescription className="text-xs">
                  {stats.todayStatus.state === "on_leave"
                    ? "Scheduled leave - no scan expected"
                    : stats.todayStatus.state === "holiday"
                      ? "Company holiday - attendance not required"
                      : "Real-time status based on biometric scans"}
                </CardDescription>
              </div>
              {renderTodayStatusBadge()}
            </div>
          </CardHeader>

          {/* Added on leave notice on member dashboard */}
          <CardContent className="">
            {stats.todayStatus.state === "on_leave" ? (
              <div className="flex items-center gap-3 p-3 rounded-md border border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/30">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 shrink-0">
                  <CalendarCheck2 className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    You are on approved leave today
                  </p>
                  <p className="text-xs text-muted-foreground">
                    No scan is expected, and this day won&apos;t count against your attendance.
                  </p>
                </div>
              </div>
            ) : stats.todayStatus.state === "holiday" ? (
              <div className="flex items-center gap-3 p-3 rounded-md border border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/40">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200/80 text-slate-700 dark:bg-slate-900 dark:text-slate-300 shrink-0">
                  <CalendarCheck2 className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Today is a company holiday
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Attendance is not required. Any scans are still recorded, and this day won&apos;t count against your attendance.
                  </p>
                </div>
              </div>
            ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-md border bg-card">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 shrink-0">
                  <LogIn className="size-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Time In</p>
                  <p className="text-sm font-semibold text-foreground font-mono">
                    {formatTime12h(stats.todayStatus.firstPunch)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-md border bg-card">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 shrink-0">
                  <LogOut className="size-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Time Out</p>
                  <p className="text-sm font-semibold text-foreground font-mono">
                    {formatTime12h(stats.todayStatus.lastPunch)}
                  </p>
                </div>
              </div>
            </div>
            )}
          </CardContent>
        </Card>

        {/* Column 2: Recent Personal Biometric Scans */}
        <Card className="shadow-xs gap-1">
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-base font-semibold flex items-center">
              Recent Personal Biometric Scans
            </CardTitle>
            <CardDescription className="text-xs">
              Timeline of recent device logs
            </CardDescription>
          </CardHeader>
          <CardContent className="-mb-2">
            {recentLogs && recentLogs.length > 0 ? (
              <div className="divide-y">
                {recentLogs.map((log) => {
                  const isDay = isDaytimePunch(log.log_time, log.log_date_time);
                  return (
                    <div
                      key={log.id}
                      className="py-3 flex items-center justify-between hover:bg-muted/40 px-2 rounded-md transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full ${
                            isDay
                              ? "bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400"
                              : "bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400"
                          }`}
                        >
                          {isDay ? (
                            <Sun className="size-4" />
                          ) : (
                            <Moon className="size-4" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {getScanLabel(log.log_time, log.log_date_time)}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            ID #{log.id}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground font-mono">
                          {log.log_time ? formatTime12h(log.log_time) : formatTime12h(log.log_date_time)}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {formatDateDisplay(log.log_date, log.log_date_time)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Fingerprint className="size-10 stroke-1 mb-2 opacity-50" />
                <p className="text-sm">No recent biometric scans found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
