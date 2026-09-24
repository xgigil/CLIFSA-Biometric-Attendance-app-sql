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

export default function DashboardLoading() {
  return (
    <div className="w-full h-full p-4 md:p-6 flex flex-col gap-6 animate-fade-in">
      {/* 4 Summary Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="@container/card shadow-xs px-2">
            <CardHeader>
              <div className="flex flex-col items-baseline gap-2 pt-2">
                <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl">
                  <Skeleton className="h-8 w-20" />
                </CardTitle>
                <CardDescription className="flex items-center gap-2 pb-2">
                  <Skeleton className="h-4 w-28" />
                </CardDescription>
              </div>
              <CardAction className="pt-2">
                <Skeleton className="h-16 w-16 rounded-md" />
              </CardAction>
            </CardHeader>
            <CardFooter className="py-1.5 justify-center">
              <Skeleton className="h-3.5 w-24" />
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Lower Section (2 Columns matching Employee and Admin layouts) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start mb-8">
        {/* Column 1: Today's Shift Status / Attendance Overview */}
        <Card className="shadow-xs">
          <CardHeader className="border-b pb-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3.5 w-56" />
              </div>
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-md border">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-md border">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Column 2: Recent Biometric Scans / Activity Timeline */}
        <Card className="shadow-xs">
          <CardHeader className="border-b pb-4">
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-52" />
              <Skeleton className="h-3.5 w-44" />
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="divide-y">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                  <div className="text-right space-y-1.5">
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
