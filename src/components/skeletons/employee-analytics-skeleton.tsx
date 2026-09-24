import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent } from "@/components/ui/card";

export function EmployeeAnalyticsSkeleton() {
  return (
    <div className="w-full h-auto p-4 md:p-6 flex flex-col gap-6 animate-fade-in">
      {/* Top Header & Calendar/Table View Toggle Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </div>

      {/* Calendar & Personal Table Container */}
      <Card className="shadow-md overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
          <Skeleton className="h-6 w-36" />
          <div className="flex items-center gap-2">
            <Skeleton className="size-8 rounded-md" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="size-8 rounded-md" />
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          {/* Calendar Grid Skeleton */}
          <div className="grid grid-cols-7 gap-2 md:gap-4 mb-4 text-center">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-10 mx-auto" />
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2 md:gap-4">
            {Array.from({ length: 35 }).map((_, i) => (
              <div
                key={i}
                className="h-16 md:h-24 p-2 rounded-lg border flex flex-col justify-between"
              >
                <Skeleton className="h-4 w-6" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
