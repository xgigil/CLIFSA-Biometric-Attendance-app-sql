"use client";

import * as React from "react";
import {
  ColumnDef,
  Row,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  columnVisibility?: Record<string, boolean>;
  renderMobileCard?: (row: Row<TData>) => React.ReactNode;
  onRowClick?: (row: Row<TData>) => void;
  // Optional. How many rows to show per page to start with.
  pageSize?: number;
  pageSizeOptions?: number[];
  itemLabel?: string;
}

function getPageItems(current: number, count: number): (number | "gap")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);

  const items: (number | "gap")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(count - 1, current + 1);
  if (start > 2) items.push("gap");
  for (let p = start; p <= end; p++) items.push(p);
  if (end < count - 1) items.push("gap");
  items.push(count);
  return items;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  columnVisibility,
  renderMobileCard,
  onRowClick,
  pageSize,
  pageSizeOptions = [10, 25, 50],
  itemLabel = "results",
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
    ...(pageSize
      ? {
          getPaginationRowModel: getPaginationRowModel(),
          initialState: { pagination: { pageIndex: 0, pageSize } },
        }
      : {}),
    state: {
      sorting,
      columnVisibility: columnVisibilityState,
    },
  });

  // Numbers for the footer ("Showing 1–8 of 8 requests").
  const totalRows = table.getPrePaginationRowModel().rows.length;
  const { pageIndex, pageSize: currentPageSize } = table.getState().pagination;
  const firstShown = totalRows === 0 ? 0 : pageIndex * currentPageSize + 1;
  const lastShown = Math.min((pageIndex + 1) * currentPageSize, totalRows);
  const pageCount = Math.max(table.getPageCount(), 1);
  const currentPage = pageIndex + 1;

  // Make sure the current page size is always one of the menu choices,
  // even if the table was started with an unusual pageSize like 8.
  const sizeChoices = Array.from(
    new Set([...pageSizeOptions, currentPageSize])
  ).sort((a, b) => a - b);

  return (
    // CHANGED: gap-4 (16px) -> gap-3 (12px), so the footer sits closer to the table.
    <div className="flex flex-col gap-3">
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
                  className={onRowClick ? "cursor-pointer" : undefined}
                  onClick={() => onRowClick?.(row)}
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
      <div
        className={`md:hidden flex flex-col gap-3${pageSize ? "" : " pb-4"}`}
      >
        {table.getRowModel().rows?.length ? (
          table.getRowModel().rows.map((row) => {
            // A custom renderMobileCard handles its own click.
            if (renderMobileCard) {
              return renderMobileCard(row);
            }

            // Fallback for other tables
            const cells = row.getVisibleCells();
            return (
              <Card
                key={row.id}
                className={`p-4 shadow-sm border border-border bg-card flex flex-col gap-2${
                  onRowClick ? " cursor-pointer" : ""
                }`}
                onClick={() => onRowClick?.(row)}
              >
                {cells.map((cell) => (
                  <div
                    key={cell.id}
                    className="flex justify-between items-center text-xs"
                  >
                    <span className="text-muted-foreground font-medium capitalize">
                      {cell.column.id.replace(/_/g, " ")}
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

      {/* Page footer style */}
      {pageSize && totalRows > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-muted-foreground">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span>
              Showing {firstShown}–{lastShown} of {totalRows} {itemLabel}
            </span>
            <div className="flex items-center gap-1.5">
              <span>Rows per page</span>
              <Select
                value={String(currentPageSize)}
                onValueChange={(value) => {
                  table.setPageSize(Number(value));
                  table.setPageIndex(0);
                }}
              >
                <SelectTrigger className="h-7 w-[56px] gap-1 px-2 text-[11px] shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sizeChoices.map((size) => (
                    <SelectItem key={size} value={String(size)} className="text-[11px]">
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 cursor-pointer gap-1 px-2 text-[11px] font-normal"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="size-3" />
              Previous
            </Button>

            {/* Numbered buttons on wider screens. The current page is a soft grey. */}
            <div className="hidden items-center gap-0.5 sm:flex">
              {getPageItems(currentPage, pageCount).map((item, index) =>
                item === "gap" ? (
                  <span key={`gap-${index}`} className="px-1 text-[11px]">
                    …
                  </span>
                ) : (
                  <Button
                    key={item}
                    type="button"
                    size="sm"
                    variant={item === currentPage ? "secondary" : "ghost"}
                    className={`h-7 min-w-7 cursor-pointer px-2 text-[11px] ${
                      item === currentPage ? "font-semibold text-foreground" : "font-normal"
                    }`}
                    aria-current={item === currentPage ? "page" : undefined}
                    onClick={() => table.setPageIndex(item - 1)}
                  >
                    {item}
                  </Button>
                )
              )}
            </div>

            {/* On phones there is no room for numbers, so show plain text instead. */}
            <span className="px-1 text-[11px] sm:hidden">
              {currentPage} / {pageCount}
            </span>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 cursor-pointer gap-1 px-2 text-[11px] font-normal"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
              <ChevronRight className="size-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}