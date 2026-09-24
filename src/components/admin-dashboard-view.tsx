import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { ChartBarStacked } from "@/components/chart-bar-stacked";
import {
  CalendarCheck2,
  UserRoundX,
  ClockAlert,
  CalendarOff,
  // Users,
  ArrowRight,
} from "lucide-react";
import { RawBiometricLog } from "@/utils/attendance-processor";

export interface AdminDashboardViewProps {
  presentCount: number;
  lateCount: number;
  absentCount: number;
  onLeaveCount: number;
  // totalCount: number;
  chartData: Array<{ day: string; present: number; late: number }>;
  weekRangeLabel: string;
  today: string;
  recentLogs: RawBiometricLog[];
}

function formatTime12h(timeStr: string): string {
  const parts = timeStr.split(":");
  if (parts.length < 2) return timeStr;
  const h = parseInt(parts[0], 10);
  const m = parts[1];
  const ampm = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 || 12;
  return `${displayH}:${m} ${ampm}`;
}

export function AdminDashboardView({
  presentCount,
  lateCount,
  absentCount,
  onLeaveCount,
  // totalCount,
  chartData,
  weekRangeLabel,
  today,
  recentLogs,
}: AdminDashboardViewProps) {
  return (
    <>
      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6 *:data-[slot=card]:shadow-xs lg:grid-cols-4">
        <Card className="@container/card">
          <CardHeader>
            <div className="flex flex-col items-baseline gap-2 pt-2 px-2">
              <CardTitle className="text-2xl font-bold text-gray-700 dark:text-gray-100 tabular-nums @[250px]/card:text-3xl animate-fade-in">
                {presentCount}
              </CardTitle>
              <CardDescription className="flex items-center text-gray-500 dark:text-gray-400 gap-2 pb-2">
                Present
              </CardDescription>
            </div>
            <CardAction className="pt-2 px-2">
              <div className="flex h-16 w-16 items-center justify-center rounded-md bg-emerald-100/80 text-emerald-600 border-3 border-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-400/30">
                <CalendarCheck2 className="size-11" />
              </div>
            </CardAction>
          </CardHeader>
          <CardFooter className="py-1.5 justify-center">
            <Link href="/dashboard/analytics?status=present">
              <Button
                variant="link"
                className="h-auto p-0 text-xs gap-1 text-muted-foreground hover:text-emerald-600 hover:font-bold hover:no-underline group animate-fade-in"
              >
                View details
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Link>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <div className="flex flex-col items-baseline gap-2 pt-2 px-2">
              <CardTitle className="text-2xl font-bold text-gray-700 dark:text-gray-100 tabular-nums @[250px]/card:text-3xl animate-fade-in">
                {lateCount}
              </CardTitle>
              <CardDescription className="flex items-center text-gray-500 dark:text-gray-400 gap-2 pb-2">
                Late
              </CardDescription>
            </div>
            <CardAction className="pt-2 px-2">
              <div className="flex h-16 w-16 items-center justify-center rounded-md bg-yellow-100/80 text-yellow-600 border-3 border-yellow-600/20 dark:bg-yellow-950/40 dark:text-yellow-400 dark:border-yellow-400/30">
                <ClockAlert className="size-11" />
              </div>
            </CardAction>
          </CardHeader>
          <CardFooter className="py-1.5 justify-center">
            <Link href="/dashboard/analytics?status=late">
              <Button
                variant="link"
                className="h-auto p-0 text-xs gap-1 text-muted-foreground hover:text-yellow-600 hover:font-bold hover:no-underline group animate-fade-in"
              >
                View details
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Link>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <div className="flex flex-col items-baseline gap-2 pt-2 px-2">
              <CardTitle className="text-2xl font-bold text-gray-700 dark:text-gray-100 tabular-nums @[250px]/card:text-3xl animate-fade-in">
                {absentCount}
              </CardTitle>
              <CardDescription className="flex items-center text-gray-500 dark:text-gray-400 gap-2 pb-2">
                Absent
              </CardDescription>
            </div>
            <CardAction className="pt-2 px-2">
              <div className="flex h-16 w-16 items-center justify-center rounded-md bg-red-100/80 text-red-600 border-3 border-red-600/20 dark:bg-red-950/40 dark:text-red-400 dark:border-red-400/30">
                <UserRoundX className="size-11" />
              </div>
            </CardAction>
          </CardHeader>
          <CardFooter className="py-1.5 justify-center">
            <Link href="/dashboard/analytics?status=absent">
              <Button
                variant="link"
                className="h-auto p-0 text-xs gap-1 text-muted-foreground hover:text-red-600 hover:font-bold hover:no-underline group animate-fade-in"
              >
                View details
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Link>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <div className="flex flex-col items-baseline gap-2 pt-2 px-2">
              <CardTitle className="text-2xl font-bold text-gray-700 dark:text-gray-100 tabular-nums @[250px]/card:text-3xl animate-fade-in">
                {onLeaveCount}
                {/* totalCount */}
              </CardTitle>
              <CardDescription className="flex items-center text-gray-500 dark:text-gray-400 gap-2 pb-2">
                {/* Total Employees */}
                On Leave
              </CardDescription>
            </div>
            <CardAction className="pt-2 px-2">
              <div className="flex h-16 w-16 items-center justify-center rounded-md bg-indigo-100/80 text-indigo-600 border-3 border-indigo-600/20 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-400/30">
                <CalendarOff className="size-11" />
              </div>
            </CardAction>
          </CardHeader>
          <CardFooter className="py-1.5 justify-center">
            <Link href="/dashboard/analytics">
              <Button
                variant="link"
                className="h-auto p-0 text-xs gap-1 text-muted-foreground hover:text-indigo-600 hover:font-bold hover:no-underline group animate-fade-in"
              >
                View details
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>

      {/* BIG CARD - RECENT LOGS */}
      <div className="flex flex-col lg:flex-row items-start w-full h-fit rounded-xl gap-4 lg:gap-6">
        {/* CHART BAR */}
        <ChartBarStacked
          data={chartData}
          weekRange={weekRangeLabel}
          selectedDate={today}
        />

        {/* RECENT LOGS */}
        <Card className="flex flex-col w-full lg:w-95 h-fit shadow-md p-4">
          <CardHeader className="text-gray-600 dark:text-gray-300 mt-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 whitespace-nowrap">
              Recent Logs
            </CardTitle>
          </CardHeader>
          <CardContent className="rounded-none flex-1 px-3 whitespace-nowrap animate-fade-in mb-2">
            {recentLogs.length > 0 ? (
              <div className="rounded-none">
                {recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="py-2 flex items-center justify-between group hover:bg-slate-50/50 dark:hover:bg-slate-900/30 px-2 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {log.employee_name || "Unregistered Token"}
                        </p>
                        <p className="text-xs text-slate-400 font-mono">
                          ID: {log.employee_id}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {log.log_time ? formatTime12h(log.log_time) : "—"}
                      </p>
                      <p className="text-xs text-slate-400 font-mono">
                        {log.log_date || "—"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-50 text-slate-400">
                <p className="text-sm">No recent logs found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
