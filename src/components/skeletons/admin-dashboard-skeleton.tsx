import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  CardAction,
} from "@/components/ui/card";
import {
  CalendarCheck2,
  ClockAlert,
  UserRoundX,
  CalendarOff,
  // Users,
} from "lucide-react";

export function AdminDashboardSkeleton() {
  return (
    <div className="w-full h-full flex flex-col gap-5 animate-fade-in">
      {/* 4 Admin Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6 *:data-[slot=card]:shadow-xs lg:grid-cols-4">
        {/* Present Card */}
        <Card className="@container/card px-2">
          <CardHeader>
            <div className="flex flex-col items-baseline gap-2 pt-2">
              <CardTitle className="text-2xl font-bold text-gray-700 dark:text-gray-100 tabular-nums @[250px]/card:text-3xl">
                <Skeleton className="h-8 w-12" />
              </CardTitle>
              <CardDescription className="flex items-center text-gray-500 dark:text-gray-400 gap-2 pb-2">
                Present
              </CardDescription>
            </div>
            <CardAction className="pt-2">
              <div className="flex h-16 w-16 items-center justify-center rounded-md bg-emerald-100/80 text-emerald-600 border-3 border-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-400/30">
                <CalendarCheck2 className="size-11" />
              </div>
            </CardAction>
          </CardHeader>
          <CardFooter className="py-1.5 justify-center">
            <Skeleton className="h-4 w-20" />
          </CardFooter>
        </Card>

        {/* Late Card */}
        <Card className="@container/card px-2">
          <CardHeader>
            <div className="flex flex-col items-baseline gap-2 pt-2">
              <CardTitle className="text-2xl font-bold text-gray-700 dark:text-gray-100 tabular-nums @[250px]/card:text-3xl">
                <Skeleton className="h-8 w-12" />
              </CardTitle>
              <CardDescription className="flex items-center text-gray-500 dark:text-gray-400 gap-2 pb-2">
                Late
              </CardDescription>
            </div>
            <CardAction className="pt-2">
              <div className="flex h-16 w-16 items-center justify-center rounded-md bg-yellow-100/80 text-yellow-600 border-3 border-yellow-600/20 dark:bg-yellow-950/40 dark:text-yellow-400 dark:border-yellow-400/30">
                <ClockAlert className="size-11" />
              </div>
            </CardAction>
          </CardHeader>
          <CardFooter className="py-1.5 justify-center">
            <Skeleton className="h-4 w-20" />
          </CardFooter>
        </Card>

        {/* Absent Card */}
        <Card className="@container/card px-2">
          <CardHeader>
            <div className="flex flex-col items-baseline gap-2 pt-2">
              <CardTitle className="text-2xl font-bold text-gray-700 dark:text-gray-100 tabular-nums @[250px]/card:text-3xl">
                <Skeleton className="h-8 w-12" />
              </CardTitle>
              <CardDescription className="flex items-center text-gray-500 dark:text-gray-400 gap-2 pb-2">
                Absent
              </CardDescription>
            </div>
            <CardAction className="pt-2">
              <div className="flex h-16 w-16 items-center justify-center rounded-md bg-red-100/80 text-red-600 border-3 border-red-600/20 dark:bg-red-950/40 dark:text-red-400 dark:border-red-400/30">
                <UserRoundX className="size-11" />
              </div>
            </CardAction>
          </CardHeader>
          <CardFooter className="py-1.5 justify-center">
            <Skeleton className="h-4 w-20" />
          </CardFooter>
        </Card>

        {/* On Leave Card */}
        <Card className="@container/card px-2">
          <CardHeader>
            <div className="flex flex-col items-baseline gap-2 pt-2">
              <CardTitle className="text-2xl font-bold text-gray-700 dark:text-gray-100 tabular-nums @[250px]/card:text-3xl">
                <Skeleton className="h-8 w-12" />
              </CardTitle>
              <CardDescription className="flex items-center text-gray-500 dark:text-gray-400 gap-2 pb-2">
                {/* Total Employees */}
                On Leave
              </CardDescription>
            </div>
            <CardAction className="pt-2">
              <div className="flex h-16 w-16 items-center justify-center rounded-md bg-indigo-100/80 text-indigo-600 border-3 border-indigo-600/20 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-400/30">
                <CalendarOff className="size-11" />
              </div>
            </CardAction>
          </CardHeader>
          <CardFooter className="py-1.5 justify-center">
            <Skeleton className="h-4 w-20" />
          </CardFooter>
        </Card>
      </div>

      {/* Chart & Recent Logs */}
      <div className="flex flex-col lg:flex-row items-start w-full h-fit rounded-xl gap-4 lg:gap-6">
        {/* Chart Skeleton */}
        <Card className="shadow-md w-full lg:flex-1">
          <CardHeader className="text-gray-600 dark:text-gray-300">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              Weekly Attendance Metrics
            </CardTitle>
            <CardAction>
              <Skeleton className="h-9 w-32 rounded-md" />
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="w-full aspect-video md:aspect-2/1 max-h-99 flex items-end justify-between gap-6 pt-12 pb-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center gap-3 h-full justify-end"
                >
                  <Skeleton
                    className="w-full rounded-t-md max-w-45"
                    style={{ height: `${30 + (i % 3) * 20}%` }}
                  />
                  <Skeleton className="mb-5 h-3 w-12" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Logs Skeleton */}
        <Card className="flex flex-col w-full lg:w-95 h-fit shadow-md overflow-visible mb-4">
          <CardHeader className="text-gray-600 dark:text-gray-300">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              Recent Logs
            </CardTitle>
          </CardHeader>
          <CardContent className="rounded-none flex-1 px-3 whitespace-nowrap">
            <div className="rounded-none space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="py-2.5 flex items-center justify-between px-2"
                >
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <div className="text-right space-y-1">
                    <Skeleton className="h-4 w-16 ml-auto" />
                    <Skeleton className="h-3 w-16 ml-auto" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
