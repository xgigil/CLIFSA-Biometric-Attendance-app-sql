"use client";

import * as React from "react";
import {
  ColumnDef,
  Row,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  columnVisibility?: Record<string, boolean>;
  renderMobileCard?: (row: Row<TData>) => React.ReactNode;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  columnVisibility,
  renderMobileCard,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnVisibilityState, setColumnVisibilityState] =
    React.useState<VisibilityState>(columnVisibility || {});

  React.useEffect(() => {
    setColumnVisibilityState(columnVisibility || {});
  }, [columnVisibility]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibilityState,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
      columnVisibility: columnVisibilityState,
    },
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Desktop Table View */}
      <div className="hidden md:block relative w-full h-fit max-h-[calc(100vh-125px)] overflow-auto rounded-md border bg-card text-foreground shadow-md">
        <Table noWrapper className="table-fixed">
          <TableHeader className="sticky top-0 z-10 bg-muted shadow-sm">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-slate-500 font-medium bg-card"
                >
                  No results found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards View */}
      <div className="md:hidden flex flex-col gap-3 pb-4">
        {table.getRowModel().rows?.length ? (
          table.getRowModel().rows.map((row) => {
            if (renderMobileCard) {
              return renderMobileCard(row);
            }

            // Fallback for other tables
            const cells = row.getVisibleCells();
            return (
              <Card
                key={row.id}
                className="p-4 shadow-sm border border-border bg-card flex flex-col gap-2"
              >
                {cells.map((cell) => (
                  <div
                    key={cell.id}
                    className="flex justify-between items-center text-xs"
                  >
                    <span className="text-muted-foreground font-medium capitalize">
                      {cell.column.id.replace("_", " ")}
                    </span>
                    <div>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </div>
                  </div>
                ))}
              </Card>
            );
          })
        ) : (
          <Card className="p-8 text-center text-slate-500 font-medium border border-border bg-card">
            No results found.
          </Card>
        )}
      </div>
    </div>
  );
}
