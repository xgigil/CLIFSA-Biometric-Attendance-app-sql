"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { ColumnDef, Row } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import {
  IconCircleCheckFilled,
  IconCircleXFilled,
  IconCalendar,
  IconAlarmFilled,
  IconFlag,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { EditDayDialog } from "@/components/attendance/edit-day-dialog";
import { DeleteAttendanceDialog } from "@/components/attendance/delete-attendance-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { RawBiometricLog } from "@/utils/attendance-processor";

function formatRawTime(iso: string): string {
  const [h, m] = iso.substring(11, 16).split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const display = h % 12 || 12;
  return `${display}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatDateFormatted(dateStr?: string): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  const dateObj = new Date(y, m - 1, d, 12, 0, 0);
  return dateObj.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export type AttendanceStatus = "present" | "late" | "absent" | "on_leave" | "holiday";

export type PersonnelAnalytics = {
  employee_id: string;
  employee_name: string;
  department_name?: string;
  first_punch: string | null;
  last_punch: string | null;
  total_hours_worked: number;
  status: AttendanceStatus;
  date?: string;
  log_id?: number;
  raw_log_id?: number;
  raw_logs?: RawBiometricLog[];
};

function RowActions({ row }: { row: Row<PersonnelAnalytics> }) {
  const [isEditDayOpen, setIsEditDayOpen] = React.useState(false);

  const [deleteLogId, setDeleteLogId] = React.useState<number | null>(null);
  const [deleteEmpName, setDeleteEmpName] = React.useState<string | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);

  const rawLogs = React.useMemo(
    () => row.original.raw_logs || [],
    [row.original.raw_logs]
  );
  const empName = row.original.employee_name;
  const singleLogId = row.original.log_id || row.original.raw_log_id;
  const empIdNum = Number(row.original.employee_id) || null;

  const handleDeleteClick = (logToDelete?: RawBiometricLog) => {
    const targetLog = logToDelete || (rawLogs.length > 0 ? rawLogs[0] : null);
    if (targetLog) {
      setDeleteLogId(targetLog.id);
      setDeleteEmpName(empName);
      setIsDeleteOpen(true);
    } else if (singleLogId) {
      setDeleteLogId(singleLogId);
      setDeleteEmpName(empName);
      setIsDeleteOpen(true);
    } else {
      toast.error("No log record available for deletion.");
    }
  };

  const hasMultipleLogs = rawLogs.length > 1;

  return (
    <>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-500/10 dark:hover:text-blue-400 rounded-md transition-colors cursor-pointer"
          title="Edit Day"
          onClick={() => setIsEditDayOpen(true)}
        >
          <IconPencil className="h-4 w-4" />
        </Button>

        {hasMultipleLogs ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-500 hover:text-rose-600 hover:bg-rose-500/10 dark:hover:text-rose-400 rounded-md transition-colors cursor-pointer"
                title="Delete Log"
              >
                <IconTrash className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Select Punch to Delete</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {rawLogs.map((l, index) => {
                const timeLabel = l.log_time
                  ? formatRawTime(`1970-01-01T${l.log_time}`)
                  : `Punch #${index + 1}`;
                return (
                  <DropdownMenuItem
                    key={l.id}
                    className="text-destructive focus:bg-destructive focus:text-white"
                    onClick={() => handleDeleteClick(l)}
                  >
                    Delete Punch ({timeLabel})
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-500 hover:text-rose-600 hover:bg-rose-500/10 dark:hover:text-rose-400 rounded-md transition-colors"
            title="Delete Log"
            onClick={() => handleDeleteClick()}
          >
            <IconTrash className="h-4 w-4" />
          </Button>
        )}
      </div>

      <EditDayDialog
        open={isEditDayOpen}
        onOpenChange={setIsEditDayOpen}
        employeeId={empIdNum}
        employeeName={empName}
        date={row.original.date || null}
        punches={rawLogs}
      />
      <DeleteAttendanceDialog
        logId={deleteLogId}
        employeeName={deleteEmpName}
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
      />
    </>
  );
}

export const columns: ColumnDef<PersonnelAnalytics>[] = [
  {
    accessorKey: "date",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="hover:bg-transparent dark:text-slate-100 animate-fade-in mx-auto"
      >
        Date
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const dateVal = row.getValue("date") as string | undefined;
      if (!dateVal)
        return <span className="text-slate-400 text-xs mx-auto">—</span>;

      return (
        <div className="flex items-center ml-3 gap-1.5 text-slate-700 dark:text-slate-300 font-mono text-xs font-medium animate-fade-in">
          {formatDateFormatted(dateVal)}
        </div>
      );
    },
  },
  {
    accessorKey: "employee_name",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-transparent dark:text-slate-100 animate-fade-in -ml-3"
        >
          Employee
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const name = row.getValue("employee_name") as string;
      const empId = row.original.employee_id;
      const dept = row.original.department_name;

      return (
        <div className="flex items-center gap-3 animate-fade-in">
          <div>
            <div className="ml-2 font-semibold text-slate-900 dark:text-slate-100 capitalize">
              {name || "Unregistered Token"}
            </div>
            <div className="ml-2 text-xs text-slate-400 dark:text-slate-500 font-mono">
              ID: {empId} {dept && `• ${dept}`}
            </div>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="hover:bg-transparent dark:text-slate-100 animate-fade-in -ml-3"
      >
        Status
        <ArrowUpDown className="ml-2 h-4 w-4 data-[state=sorted]:border-blue-500 data-[state=sorted]:border data-[state=sorted]:text-blue-500" />
      </Button>
    ),
    cell: ({ row }) => {
      const status = row.getValue("status") as AttendanceStatus;

      const styles: Record<
        AttendanceStatus,
        { icon: React.ReactNode; label: string }
      > = {
        present: {
          icon: (
            <IconCircleCheckFilled
              size={14}
              className="text-emerald-500 shrink-0"
            />
          ),
          label: "Present",
        },
        late: {
          icon: (
            <IconAlarmFilled size={14} className="text-amber-500 shrink-0" />
          ),
          label: "Late",
        },
        absent: {
          icon: (
            <IconCircleXFilled size={14} className="text-red-500 shrink-0" />
          ),
          label: "Absent",
        },
        on_leave: {
          icon: <IconCalendar size={14} className="text-blue-500 shrink-0" />,
          label: "On Leave",
        },
        holiday: {
          icon: (
            <IconFlag
              size={14}
              className="text-slate-600 dark:text-slate-400 shrink-0"
            />
          ),
          label: "Holiday",
        },
      };

      const { icon, label } = styles[status];

      return (
        <span className="flex w-fit items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-transparent dark:text-slate-300 animate-fade-in">
          {icon}
          {label}
        </span>
      );
    },
  },
  {
    accessorKey: "first_punch",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="hover:bg-transparent dark:text-slate-100 animate-fade-in -ml-3"
      >
        Time in
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const rawTime = row.getValue("first_punch") as string;
      if (!rawTime) return <span className="text-slate-400 text-xs">—</span>;

      return (
        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium font-mono text-xs animate-fade-in">
          {formatRawTime(rawTime)}
        </div>
      );
    },
  },
  {
    accessorKey: "last_punch",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="hover:bg-transparent dark:text-slate-100 animate-fade-in -ml-3"
      >
        Time out
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const rawTime = row.getValue("last_punch") as string;
      if (!rawTime) return <span className="text-slate-400 text-xs">—</span>;

      return (
        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium font-mono text-xs animate-fade-in">
          {formatRawTime(rawTime)}
        </div>
      );
    },
  },
  {
    accessorKey: "total_hours_worked",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="hover:bg-transparent dark:text-slate-100 animate-fade-in -ml-3"
      >
        Hours Logged
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const decimalHours = row.getValue("total_hours_worked") as number;

      // Convert decimal hours to a human string (example: 8h 30m)
      const hours = Math.floor(decimalHours);
      const minutes = Math.round((decimalHours - hours) * 60);

      if (decimalHours === 0 || isNaN(decimalHours)) {
        return (
          <span className="text-slate-400 text-xs animate-fade-in">
            0h 0m
          </span>
        );
      }

      return (
        <div className="flex items-center gap-1.5 text-slate-900 dark:text-slate-100 font-semibold animate-fade-in">
          <span>
            {hours}h {minutes}m
          </span>
        </div>
      );
    },
  },
  {
    id: "actions",
    header: () => (
      <div className="font-semibold text-slate-900 dark:text-slate-100">
        Actions
      </div>
    ),
    cell: ({ row }) => <RowActions row={row} />,
  },
];
