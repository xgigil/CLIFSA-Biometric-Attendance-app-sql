import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardHeader, CardContent } from "@/components/ui/card";

export default function AnalyticsLoading() {
  return (
    <div className="w-full h-auto p-4 md:p-6 flex flex-col gap-6 animate-fade-in">
      {/* Page Header & Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Skeleton className="h-10 w-36 rounded-md" />
          <Skeleton className="h-10 w-28 rounded-md" />
          <Skeleton className="h-10 w-24 rounded-md" />
        </div>
      </div>

      {/* Main Table Skeleton (Desktop) */}
      <div className="hidden md:block relative w-full overflow-hidden rounded-xl border bg-card text-card-foreground shadow-md">
        <Table className="table-fixed w-full">
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="w-[250px]">
                <Skeleton className="h-4 w-28" />
              </TableHead>
              <TableHead className="text-center">
                <Skeleton className="h-4 w-20 mx-auto" />
              </TableHead>
              <TableHead className="text-center">
                <Skeleton className="h-4 w-16 mx-auto" />
              </TableHead>
              <TableHead className="text-center">
                <Skeleton className="h-4 w-16 mx-auto" />
              </TableHead>
              <TableHead className="text-center">
                <Skeleton className="h-4 w-24 mx-auto" />
              </TableHead>
              <TableHead className="text-right pr-6">
                <Skeleton className="h-4 w-16 ml-auto" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 9 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell className="py-3.5">
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-9 rounded-full shrink-0" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Skeleton className="h-6 w-20 rounded-full mx-auto" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-16 mx-auto" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-16 mx-auto" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-14 mx-auto" />
                </TableCell>
                <TableCell className="pr-6 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Skeleton className="size-8 rounded-md" />
                    <Skeleton className="size-8 rounded-md" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Cards List Skeleton (Mobile) */}
      <div className="md:hidden flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-3 gap-2 text-center p-2 rounded-lg bg-muted/20">
                <div className="space-y-1">
                  <Skeleton className="h-3 w-12 mx-auto" />
                  <Skeleton className="h-4 w-14 mx-auto" />
                </div>
                <div className="space-y-1">
                  <Skeleton className="h-3 w-12 mx-auto" />
                  <Skeleton className="h-4 w-14 mx-auto" />
                </div>
                <div className="space-y-1">
                  <Skeleton className="h-3 w-12 mx-auto" />
                  <Skeleton className="h-4 w-12 mx-auto" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
