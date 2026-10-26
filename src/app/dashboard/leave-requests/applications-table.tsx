"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import type { ReactNode } from "react";
import type { ColumnDef, Row } from "@tanstack/react-table";
import { ArrowUpDown, CalendarDays, ChevronDown, Plus, Search, X } from "lucide-react";
import {
  IconCircleCheckFilled,
  IconCircleXFilled,
  IconClockFilled,
  IconBan,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/ui/data-table";

const BASE_PATH = "/dashboard/leave-requests";
const TOOLBAR_TEXT = "text-[11px] sm:text-xs md:text-[13px]";
const TOOLBAR_ICON = "size-3.5 md:size-4";

// ---------------------------------------------------------------------------
// ROW TYPE
// One row of the table. This matches what listLeaveApplicationAction returns.
// It is exported because page.tsx imports it.
// ---------------------------------------------------------------------------
export type ApplicationRow = {
  id: number;
  employee_id: number;
  start_date: string;
  end_date: string;
  leave_type_id: number;
  leave_type_name: string;
  note: string;
  status: string;
  created_at: string;
  applicant_name: string;
  date_filed: string;
  beginning_balance: number;
  leave_taken: number;
  allowable_leave: number;
};

// ---------------------------------------------------------------------------
// SMALL HELPERS
// ---------------------------------------------------------------------------

// Turns "2026-10-22" into "Oct 22, 2026".
// Built at noon on purpose, so time zones can never shift the day.
function formatDate(value: string): string {
  const [y, m, d] = value.substring(0, 10).split("-").map(Number);
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d, 12, 0, 0).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// 0.5 -> "0.5 day", 1 -> "1 day", 3 -> "3 days".
function formatDaysLabel(n: number): string {
  const text = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return `${text} ${n <= 1 ? "day" : "days"}`;
}

// The clickable column title with the up/down arrows. Same look as Daily Logs.
function SortHeader({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className="hover:bg-transparent dark:text-slate-100 -ml-3"
    >
      {label}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );
}

// ---------------------------------------------------------------------------
// STATUS BADGE 
// ---------------------------------------------------------------------------
const STATUS_STYLE: Record<
  string,
  { icon: ReactNode; label: string; pill: string }
> = {
  pending: {
    icon: <IconClockFilled size={14} className="shrink-0" />,
    label: "Pending",
    pill: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  },
  approved: {
    icon: <IconCircleCheckFilled size={14} className="shrink-0" />,
    label: "Approved",
    pill: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  denied: {
    icon: <IconCircleXFilled size={14} className="shrink-0" />,
    label: "Denied",
    pill: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  },
  cancelled: {
    icon: <IconBan size={14} className="shrink-0" />,
    label: "Cancelled",
    pill: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
};

function StatusBadge({
  status,
  showIcon = true,
}: {
  status: string;
  showIcon?: boolean;
}) {
  // A status we do not know about still shows, just without colors.
  const style = STATUS_STYLE[status] ?? { icon: null, label: status, pill: "bg-muted" };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${style.pill}`}
    >
      {showIcon && style.icon}
      {style.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// DATE FILED CHOICES
// The options in the "Date filed" menu. "any" means no date filter.
// ---------------------------------------------------------------------------
const DATE_FILED_OPTIONS = [
  { value: "any", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
] as const;
type DateFiledValue = (typeof DATE_FILED_OPTIONS)[number]["value"];

// Says whether a "date filed" falls inside the chosen choice.
// Dates are compared as whole days (noon), so the time of day never matters.
function matchesDateFiled(dateFiled: string, choice: DateFiledValue): boolean {
  if (choice === "any") return true;

  const [y, m, d] = dateFiled.substring(0, 10).split("-").map(Number);
  if (!y || !m || !d) return false;
  const filed = new Date(y, m - 1, d, 12, 0, 0).getTime();

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0).getTime();
  const DAY = 24 * 60 * 60 * 1000;

  if (choice === "today") return filed === today;
  if (choice === "7d") return filed >= today - 6 * DAY && filed <= today;
  if (choice === "30d") return filed >= today - 29 * DAY && filed <= today;
  // "month": same year and month as today
  return y === now.getFullYear() && m === now.getMonth() + 1;
}

// ---------------------------------------------------------------------------
// COLUMNS (desktop table)
// ---------------------------------------------------------------------------
const columns: ColumnDef<ApplicationRow>[] = [
  {
    accessorKey: "id",
    header: ({ column }) => (
      <SortHeader label="LN#" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
    ),
    cell: ({ row }) => (
      <span className="ml-2 font-mono text-xs font-medium text-slate-700 dark:text-slate-300">
        {row.original.id}
      </span>
    ),
  },
  {
    accessorKey: "applicant_name",
    header: ({ column }) => (
      <SortHeader label="Employee" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
    ),
    // Name in bold with the employee ID in small muted text underneath.
    cell: ({ row }) => (
      <div>
        <div className="ml-2 font-semibold text-slate-900 dark:text-slate-100">
          {row.original.applicant_name}
        </div>
        <div className="ml-2 font-mono text-xs text-slate-400">
          ID: {row.original.employee_id}
        </div>
      </div>
    ),
  },
  {
    accessorKey: "leave_type_name",
    header: ({ column }) => (
      <SortHeader label="Type" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
    ),
    cell: ({ row }) => <span className="ml-2 text-sm">{row.original.leave_type_name}</span>,
  },
  {
    accessorKey: "start_date",
    header: ({ column }) => (
      <SortHeader label="From" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
    ),
    cell: ({ row }) => (
      <span className="ml-2 font-mono text-xs">{formatDate(row.original.start_date)}</span>
    ),
  },
  {
    accessorKey: "end_date",
    header: ({ column }) => (
      <SortHeader label="To" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
    ),
    cell: ({ row }) => (
      <span className="ml-2 font-mono text-xs">{formatDate(row.original.end_date)}</span>
    ),
  },
  {
    // "leave_taken" is the number of working days in this request.
    // CHANGED: shown with its unit ("1 day", "3 days"). Sorting still uses the number.
    accessorKey: "leave_taken",
    header: ({ column }) => (
      <SortHeader label="Days" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
    ),
    cell: ({ row }) => (
      <span className="ml-2 font-mono text-xs tabular-nums">
        {formatDaysLabel(row.original.leave_taken)}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <SortHeader label="Status" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
    ),
    cell: ({ row }) => (
      <div className="ml-2">
        <StatusBadge status={row.original.status} />
      </div>
    ),
  },
  {
    accessorKey: "date_filed",
    header: ({ column }) => (
      <SortHeader label="Date filed" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
    ),
    cell: ({ row }) => (
      <span className="ml-2 font-mono text-xs">{formatDate(row.original.date_filed)}</span>
    ),
  },
];

// ---------------------------------------------------------------------------
// MOBILE CARD
// On phones the table is replaced by one card per request. The whole card is
// clickable, so there is no separate "View" button.
// Order, top to bottom:
//   1. "REQUEST #30" (small), name (bold), employee ID (muted), status pill on the right
//   2. a divider
//   3. Leave type + Total days
//      Start date + End date
//   4. a divider
//   5. Date filed
// ---------------------------------------------------------------------------
function MobileLabel({ children }: { children: ReactNode }) {
  return <div className="text-xs text-muted-foreground">{children}</div>;
}

function MobileRequestCard({
  data,
  onOpen,
}: {
  data: ApplicationRow;
  onOpen: () => void;
}) {
  return (
    <Card
      role="link"
      tabIndex={0}
      onClick={onOpen}
      // Lets keyboard users open the card with Enter, like a normal link.
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen();
      }}
      className="cursor-pointer gap-0 p-4 shadow-sm transition-colors hover:bg-muted/50 active:bg-muted/50"
    >
      {/* 1. Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Request #{data.id}
          </div>
          <div className="mt-0.5 truncate text-base font-semibold text-slate-900 dark:text-slate-100">
            {data.applicant_name}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Employee ID: {data.employee_id}
          </div>
        </div>
        <div className="shrink-0">
          <StatusBadge status={data.status} showIcon={false} />
        </div>
      </div>

      {/* 2 + 3. Divider, then the two-column details */}
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-3">
        <div>
          <MobileLabel>Leave type</MobileLabel>
          <div className="text-sm font-semibold">{data.leave_type_name}</div>
        </div>
        <div>
          <MobileLabel>Total days</MobileLabel>
          <div className="text-sm font-semibold">{formatDaysLabel(data.leave_taken)}</div>
        </div>
        <div>
          <MobileLabel>Start date</MobileLabel>
          <div className="text-sm">{formatDate(data.start_date)}</div>
        </div>
        <div>
          <MobileLabel>End date</MobileLabel>
          <div className="text-sm">{formatDate(data.end_date)}</div>
        </div>
      </div>

      {/* 4 + 5. Divider, then the date filed */}
      <div className="mt-3 border-t pt-3">
        <MobileLabel>Date filed</MobileLabel>
        <div className="text-sm">{formatDate(data.date_filed)}</div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// THE PAGE PIECE
// The top bar (site-header.tsx) handles Status and Employee. Those reload the
// list from the server. The controls here (search, Type, Date filed) only
// narrow down the rows that are already loaded, so they react instantly.
// Clicking a row (desktop) or a card (mobile) opens that request's detail page.
// ---------------------------------------------------------------------------
export function ApplicationsTable({ rows }: { rows: ApplicationRow[] }) {
  const router = useRouter();

  // What the person typed and picked in the toolbar.
  const [search, setSearch] = React.useState("");
  // Ticked leave types. Empty means "all types", the same idea as the Status menu.
  const [selectedTypes, setSelectedTypes] = React.useState<string[]>([]);
  const [dateFiled, setDateFiled] = React.useState<DateFiledValue>("any");

  // The Type menu lists whatever types appear in the loaded rows,
  // so it never shows a type that has no requests.
  const typeOptions = React.useMemo(
    () => Array.from(new Set(rows.map((r) => r.leave_type_name))).sort(),
    [rows]
  );

  // The rows that pass all three checks. The table shows these.
  const visibleRows = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      // 1) Search: matches the name, the employee ID, or the LN# (request number).
      if (term) {
        const haystack = `${r.applicant_name} ${r.employee_id} ${r.id}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      // 2) Type: if any are ticked, the row's type must be one of them.
      if (selectedTypes.length > 0 && !selectedTypes.includes(r.leave_type_name)) {
        return false;
      }
      // 3) Date filed
      return matchesDateFiled(r.date_filed, dateFiled);
    });
  }, [rows, search, selectedTypes, dateFiled]);

  const hasActiveFilters =
    search.trim() !== "" || selectedTypes.length > 0 || dateFiled !== "any";

  const clearFilters = () => {
    setSearch("");
    setSelectedTypes([]);
    setDateFiled("any");
  };

  const toggleType = (type: string, checked: boolean) => {
    setSelectedTypes((prev) =>
      checked ? [...prev, type] : prev.filter((t) => t !== type)
    );
  };

  const dateFiledLabel =
    DATE_FILED_OPTIONS.find((o) => o.value === dateFiled)?.label ?? "Date filed";

  const openRequest = (id: number) => router.push(`${BASE_PATH}/${id}` as Route);

  return (
    <div className="space-y-4">
      {/* Toolbar. Search grows to fill the space, buttons stay compact,
          and everything wraps onto a second line on small screens.
          Text and icons use TOOLBAR_TEXT / TOOLBAR_ICON so they scale with the screen. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[160px] flex-1">
          <Search
            className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground ${TOOLBAR_ICON}`}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employee, ID, or LN#..."
            aria-label="Search leave requests"
            className={`h-8 pl-9 ${TOOLBAR_TEXT}`}
          />
        </div>

        {/* Type filter: tick one or more leave types. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className={`h-8 cursor-pointer ${TOOLBAR_TEXT}`}>
              Type
              {selectedTypes.length > 0 && (
                <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
                  {selectedTypes.length}
                </span>
              )}
              <ChevronDown className={TOOLBAR_ICON} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={`w-56 ${TOOLBAR_TEXT}`}>
            <DropdownMenuLabel className={TOOLBAR_TEXT}>Leave type</DropdownMenuLabel>
            {typeOptions.map((type) => (
              <DropdownMenuCheckboxItem
                key={type}
                checked={selectedTypes.includes(type)}
                onCheckedChange={(checked) => toggleType(type, !!checked)}
                // Keeps the menu open so several types can be ticked in a row.
                onSelect={(e) => e.preventDefault()}
                className={TOOLBAR_TEXT}
              >
                {type}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Date filed filter: pick one time range. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className={`h-8 cursor-pointer ${TOOLBAR_TEXT}`}>
              <CalendarDays className={TOOLBAR_ICON} />
              {dateFiled === "any" ? "Date filed" : dateFiledLabel}
              <ChevronDown className={TOOLBAR_ICON} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={`w-44 ${TOOLBAR_TEXT}`}>
            <DropdownMenuLabel className={TOOLBAR_TEXT}>Date filed</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={dateFiled}
              onValueChange={(v) => setDateFiled(v as DateFiledValue)}
            >
              {DATE_FILED_OPTIONS.map((o) => (
                <DropdownMenuRadioItem key={o.value} value={o.value} className={TOOLBAR_TEXT}>
                  {o.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Only shows when something is filtered, so it is easy to start over. */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            className={`h-8 cursor-pointer ${TOOLBAR_TEXT}`}
            onClick={clearFilters}
          >
            <X className={TOOLBAR_ICON} />
            Clear
          </Button>
        )}

        {/* The main action on this page: a solid button with a "+" icon, so it
            stands out from the outlined filter buttons. */}
        <Button className={`h-8 cursor-pointer ${TOOLBAR_TEXT}`} asChild>
          <Link href={`${BASE_PATH}/new`}>
            <Plus className={TOOLBAR_ICON} />
            Request for Leave
          </Link>
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={visibleRows}
        pageSize={10}
        itemLabel="requests"
        onRowClick={(row) => openRequest(row.original.id)}
        renderMobileCard={(row: Row<ApplicationRow>) => (
          <MobileRequestCard
            key={row.id}
            data={row.original}
            onOpen={() => openRequest(row.original.id)}
          />
        )}
      />
    </div>
  );
}