import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  CardContent,
  CardAction,
} from "@/components/ui/card";
import {
  CalendarCheck2,
  Clock,
  ClockAlert,
  UserCheck,
  LogIn,
  LogOut,
  Fingerprint,
} from "lucide-react";

export function EmployeeDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6 w-full animate-fade-in">
      {/* 4 Personal Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {/* Card 1: Monthly On-Time Rate */}
        <Card className="@container/card shadow-xs px-2">
          <CardHeader>
            <div className="flex flex-col items-baseline gap-2 pt-2">
              <CardTitle className="text-2xl font-bold text-gray-700 dark:text-gray-100 tabular-nums @[250px]/card:text-3xl">
                <Skeleton className="h-8 w-16" />
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
                <Skeleton className="h-8 w-28" />
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
                <Skeleton className="h-8 w-16" />
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
                <Skeleton className="h-8 w-24" />
              </CardTitle>
              <CardDescription className="flex items-center text-gray-500 dark:text-gray-400 gap-2 pb-2">
                Days Present
              </CardDescription>
            </div>
            <CardAction className="pt-2">
              <div className="flex h-16 w-16 items-center justify-center rounded-md bg-indigo-100/80 text-indigo-600 border-3 border-indigo-600/20 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-400/30">
                <UserCheck className="size-11" />
              </div>
            </CardAction>
          </CardHeader>
        </Card>
      </div>

      {/* 2 Equal Columns Lower Section */}
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
                  Real-time status based on biometric scans
                </CardDescription>
              </div>
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-md border bg-card">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 shrink-0">
                  <LogIn className="size-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Time In</p>
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-md border bg-card">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 shrink-0">
                  <LogOut className="size-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Time Out</p>
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            </div>
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
          <CardContent className="pt-2">
            <div className="divide-y">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="py-3 flex items-center justify-between px-2 rounded-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                      <Fingerprint className="size-4" />
                    </div>
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <Skeleton className="h-4 w-16 ml-auto" />
                    <Skeleton className="h-3 w-12 ml-auto" />
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
