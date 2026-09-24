import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="max-w-7xl mx-auto p-6 md:p-10 space-y-10 bg-background min-h-full animate-fade-in">
      <div className="space-y-8">
        {/* ACCOUNT PROFILE SKELETON */}
        <div className="space-y-5 border-b pb-8">
          <div className="flex items-center gap-2 text-foreground font-semibold text-lg pb-2">
            <Skeleton className="h-6 w-36" />
          </div>

          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-border/10 pb-4 gap-3">
              <div className="space-y-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-64" />
              </div>
              <Skeleton className="h-9 w-52 rounded-md" />
            </div>

            <div className="flex items-center justify-between border-b border-border/10 pb-4 gap-3">
              <div className="space-y-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-52" />
              </div>
              <Skeleton className="h-9 w-52 rounded-md" />
            </div>
          </div>
        </div>

        {/* PREFERENCES SKELETON */}
        <div className="space-y-5 border-b pb-8">
          <div className="flex items-center gap-2 text-foreground font-semibold text-lg pb-2">
            <Skeleton className="h-6 w-28" />
          </div>

          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-border/10 pb-4 gap-3">
              <div className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-72" />
              </div>
              <Skeleton className="h-9 w-36 rounded-md" />
            </div>

            <div className="flex items-center justify-between pb-2 gap-3">
              <div className="space-y-1">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-64" />
              </div>
              <Skeleton className="h-9 w-36 rounded-md" />
            </div>
          </div>
        </div>

        {/* SHIFT RULES SKELETON */}
        <div className="space-y-5 border-b pb-8">
          <div className="flex items-center gap-2 text-foreground font-semibold text-lg pb-2">
            <Skeleton className="h-6 w-24" />
          </div>

          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-border/10 pb-4 gap-3">
              <div className="space-y-1">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-9 w-36 rounded-md" />
            </div>

            <div className="flex items-center justify-between pb-2 gap-3">
              <div className="space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-9 w-36 rounded-md" />
            </div>
          </div>
        </div>

        {/* SAVE SETTINGS BUTTON SKELETON */}
        <div className="flex justify-end pt-4">
          <Skeleton className="h-10 w-36 rounded-md" />
        </div>
      </div>
    </div>
  );
}
