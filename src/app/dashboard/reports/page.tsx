import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from "react";

export default function ReportsPage() {
  return (
    <div className="w-full h-full p-4">
      <Suspense fallback={
        <div className="w-full h-full flex flex-col gap-4">
          <Skeleton className="w-full h-16" />
          <Skeleton className="w-full h-full" />
        </div>
      }>
        <div className="w-full h-full flex flex-col gap-4">
          <Skeleton className="w-full h-16" />
          <Skeleton className="w-full h-full" />
        </div>
      </Suspense>
    </div>
  );
}
