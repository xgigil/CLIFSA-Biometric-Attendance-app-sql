"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface ApplicationRow {
  id: number; // also the LN# on the form
  employee_id: number;
  start_date: string;
  end_date: string;
  status: string;
  leave_type_name: string;
  applicant_name: string;
  date_filed: string;
  leave_taken: number;
}

interface EmployeeOption {
  employee_id: number;
  employee_name: string;
}

interface ApplicationsTableProps {
  rows: ApplicationRow[];
  isAuthorized: boolean;
  employees: EmployeeOption[];
  selectedStatus: string; // "all" or a status
  selectedEmployeeId: string; // "all" or an id
}

const BASE_PATH = "/dashboard/leave-requests";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "denied", label: "Denied" },
  { value: "cancelled", label: "Cancelled" },
];

// ---- formatting helpers (the old columns.tsx part) ----

function formatDate(value: string): string {
  // DATE and DATETIME arrive as strings ("2026-09-21" or "2026-09-21 09:00:00").
  const [y, m, d] = value.substring(0, 10).split("-").map(Number);
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d, 12, 0, 0).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDays(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function StatusBadge({ status }: { status: string }) {
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  if (status === "pending") {
    return (
      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-300">
        {label}
      </Badge>
    );
  }
  if (status === "approved") {
    return (
      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300">
        {label}
      </Badge>
    );
  }
  return <Badge variant="secondary">{label}</Badge>;
}

export function ApplicationsTable({
  rows,
  isAuthorized,
  employees,
  selectedStatus,
  selectedEmployeeId,
}: ApplicationsTableProps) {
  const router = useRouter();

  // Changing a filter rewrites the URL, which re-runs the server page.
  const updateFilter = (key: "status" | "employee_id", value: string) => {
    const params = new URLSearchParams();
    const nextStatus = key === "status" ? value : selectedStatus;
    const nextEmp = key === "employee_id" ? value : selectedEmployeeId;
    if (nextStatus !== "all") params.set("status", nextStatus);
    if (isAuthorized && nextEmp !== "all") params.set("employee_id", nextEmp);
    const qs = params.toString();
    router.push(qs ? `${BASE_PATH}?${qs}` : BASE_PATH);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Leave Requests</h1>
          <p className="text-sm text-muted-foreground">
            Pending applications are listed first.
          </p>
        </div>
        <Button asChild>
          <Link href={`${BASE_PATH}/new`}>Apply for Leave</Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="space-y-1">
          <Label htmlFor="filter-status" className="text-xs text-muted-foreground">
            Status
          </Label>
          <Select
            value={selectedStatus}
            onValueChange={(v) => updateFilter("status", v)}
          >
            <SelectTrigger id="filter-status" className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isAuthorized && (
          <div className="space-y-1">
            <Label htmlFor="filter-employee" className="text-xs text-muted-foreground">
              Employee
            </Label>
            <Select
              value={selectedEmployeeId}
              onValueChange={(v) => updateFilter("employee_id", v)}
            >
              <SelectTrigger id="filter-employee" className="w-[240px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All employees</SelectItem>
                {employees.map((emp) => (
                  <SelectItem key={emp.employee_id} value={String(emp.employee_id)}>
                    {emp.employee_name} ({emp.employee_id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>LN#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead className="text-right">Days</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date filed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-muted-foreground"
                >
                  No leave requests found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={
                    "cursor-pointer " +
                    (row.status === "pending" ? "bg-amber-50/60 dark:bg-amber-950/10" : "")
                  }
                  onClick={() => router.push(`${BASE_PATH}/${row.id}`)}
                >
                  <TableCell className="font-medium">{row.id}</TableCell>
                  <TableCell>{row.applicant_name}</TableCell>
                  <TableCell>{row.leave_type_name}</TableCell>
                  <TableCell>{formatDate(row.start_date)}</TableCell>
                  <TableCell>{formatDate(row.end_date)}</TableCell>
                  <TableCell className="text-right">
                    {formatDays(row.leave_taken)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell>{formatDate(row.date_filed)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}