"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { getEmployeesAction } from "@/app/dashboard/analytics/actions";
import {
  setLeaveAction,
  setLeaveForAllAction,
  getLeavesForRangedAction,
  removeLeaveAction,
} from "@/app/dashboard/leaves/actions";

interface SetLeaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEmployeeId?: number;
  defaultDate?: string;
}

interface EmployeeOption {
  employee_id: number;
  employee_name: string;
}

interface LeaveRecord {
  id: number;
  employee_id: number;
  start_date: string;
  end_date: string;
  leave_type: string | null;
  note: string | null;
}

const LEAVE_TYPES = [
  // Add here the types of on-leave here
  { value: "vacation", label: "Vacation" },
  { value: "sick", label: "Sick Leave" },
  { value: "unpaid", label: "Unpaid Leave" },
  { value: "other", label: "Other" },
];

function formatLeaveDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function countDays(start: string, end: string): number {
  const s = new Date(`${start}T12:00:00Z`).getTime();
  const e = new Date(`${end}T12:00:00Z`).getTime();
  return Math.round((e - s) / 86400000) + 1;
}

export function SetLeaveDialog({
  open,
  onOpenChange,
  defaultEmployeeId,
  defaultDate,
}: SetLeaveDialogProps) {
  const [employees, setEmployees] = React.useState<EmployeeOption[]>([]);
  const [selectedEmpId, setSelectedEmpId] = React.useState<string>("");
  const [startDate, setStartDate] = React.useState<string>("");
  const [endDate, setEndDate] = React.useState<string>("");
  const [leaveType, setLeaveType] = React.useState<string>("vacation");
  const [note, setNote] = React.useState<string>("");
  const [loading, setLoading] = React.useState<boolean>(false);
  const [fetchingEmployees, setFetchingEmployees] =
    React.useState<boolean>(false);
  const [existingLeaves, setExistingLeaves] = React.useState<LeaveRecord[]>(
    []
  );
  const [fetchingLeave, setFetchingLeave] = React.useState(false);
  const [removingLeaveId, setRemovingLeaveId] = React.useState<number | null>(
    null
  );
  const [confirmRemoveLeaveId, setConfirmRemoveLeaveId] = React.useState<
    number | null
  >(null);

  React.useEffect(() => {
    if (!open) return;

    const now = new Date();
    const fallback = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const initialDate = defaultDate || fallback;

    setStartDate(initialDate);
    setEndDate(initialDate);
    setLeaveType("vacation");
    setNote("");
    setSelectedEmpId(defaultEmployeeId ? String(defaultEmployeeId) : "");
    setExistingLeaves([]);
    setFetchingLeave(false);
    setRemovingLeaveId(null);
    setConfirmRemoveLeaveId(null);

    setFetchingEmployees(true);
    getEmployeesAction()
      .then((res) => {
        if (res.success && res.data) {
          setEmployees(res.data);
        } else {
          toast.error(res.error || "Failed to fetch employees");
        }
      })
      .finally(() => setFetchingEmployees(false));
  }, [open, defaultDate, defaultEmployeeId]);

  // Look up leaves that overlap the selected employee + date range.
  React.useEffect(() => {
    if (!open) return;
    if (!selectedEmpId || selectedEmpId === "all") {
      setExistingLeaves([]);
      setFetchingLeave(false);
      setConfirmRemoveLeaveId(null);
      return;
    }
    if (!startDate || !endDate) {
      setExistingLeaves([]);
      setFetchingLeave(false);
      setConfirmRemoveLeaveId(null);
      return;
    }

    const empId = parseInt(selectedEmpId, 10);
    if (Number.isNaN(empId)) {
      setExistingLeaves([]);
      setConfirmRemoveLeaveId(null);
      return;
    }

    let cancelled = false;
    setConfirmRemoveLeaveId(null);
    setFetchingLeave(true);

    getLeavesForRangedAction(startDate, endDate, empId)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          const rows = res.data as LeaveRecord[];
          setExistingLeaves(
            rows.filter((r) => Number(r.employee_id) === empId)
          );
        } else {
          setExistingLeaves([]);
          if (!res.success) {
            toast.error(res.error || "Failed to load leave records");
          }
        }
      })
      .finally(() => {
        if (!cancelled) setFetchingLeave(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, selectedEmpId, startDate, endDate]);

  // Dragging the start past the end should carry the end with it.
  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    if (endDate && value > endDate) setEndDate(value);
  };

  const handleRemoveLeave = async (leaveId: number) => {
    setRemovingLeaveId(leaveId);
    const res = await removeLeaveAction(leaveId);
    setRemovingLeaveId(null);

    if (res.success) {
      toast.success("Leave removed successfully");
      setExistingLeaves((prev) => prev.filter((l) => l.id !== leaveId));
      setConfirmRemoveLeaveId(null);
    } else {
      toast.error(res.error || "Failed to remove the leave");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedEmpId) return toast.error("Please select an employee");
    if (!startDate || !endDate)
      return toast.error("Please select a start and end date");
    if (endDate < startDate)
      return toast.error("End date cannot be before start date");
    if (selectedEmpId !== "all" && existingLeaves.length > 0) {
      return toast.error("Remove the existing leave first, or change the dates");
    }

    setLoading(true);
    try {
      if (selectedEmpId === "all") {
        const res = await setLeaveForAllAction({
          start_date: startDate,
          end_date: endDate,
          leave_type: leaveType,
          note: note.trim() || undefined,
        });

        if (res.success) {
          toast.success(
            `Leave saved for ${res.created ?? 0} employees(s)` +
              (res.skipped
                ? ` (${res.skipped} already on leave, skipped)`
                : "")
          );

          onOpenChange(false);
        } else {
          toast.error(res.error || "Failed to save leave");
        }
      } else {
        const res = await setLeaveAction({
          employee_id: parseInt(selectedEmpId, 10),
          start_date: startDate,
          end_date: endDate,
          leave_type: leaveType,
          note: note.trim() || undefined,
        });

        if (res.success) {
          toast.success("Leave saved successfully");
          onOpenChange(false);
        } else {
          toast.error(res.error || "Failed to save leave");
        }
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    } finally {
      setLoading(false);
    }
  };

  const hasOverlappingLeave =
    selectedEmpId !== "all" && existingLeaves.length > 0;
  const saveDisabled =
    loading ||
    fetchingEmployees ||
    fetchingLeave ||
    removingLeaveId !== null ||
    hasOverlappingLeave;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Set Employee Leave</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="leave-employee">Employee</Label>
            {fetchingEmployees ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Spinner className="size-4" /> Loading employees...
              </div>
            ) : (
              <Select value={selectedEmpId} onValueChange={setSelectedEmpId}>
                <SelectTrigger id="leave-employee" className="w-full min-w-0">
                  <SelectValue placeholder="Select an employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem
                      key={emp.employee_id}
                      value={String(emp.employee_id)}
                    >
                      {emp.employee_name} ({emp.employee_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedEmpId === "all" && (
            <p className="text-xs text-muted-foreground -mt-2">
              Applies to every active employee.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2 min-w-0">
              <Label htmlFor="leave-start">Start date</Label>
              <Input
                id="leave-start"
                type="date"
                className="w-full min-w-0"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
              />
            </div>
            <div className="space-y-2 min-w-0">
              <Label htmlFor="leave-end">End date</Label>
              <Input
                id="leave-end"
                type="date"
                className="w-full min-w-0"
                min={startDate}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="leave-type">Leave type</Label>
            <Select value={leaveType} onValueChange={setLeaveType}>
              <SelectTrigger id="leave-type" className="w-full min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAVE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="leave-note">Note (optional)</Label>
            <Input
              id="leave-note"
              className="w-full min-w-0"
              value={note}
              maxLength={255}
              placeholder={
                selectedEmpId === "all"
                  ? "e.g. Team offsite / shared leave"
                  : "e.g. Approved by HR"
              }
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {selectedEmpId &&
            selectedEmpId !== "all" &&
            !fetchingLeave &&
            existingLeaves.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Existing leave in this range
                </Label>

                {existingLeaves.map((leave) => {
                  const spansMultipleDays =
                    leave.start_date !== leave.end_date;
                  const isRemoving = removingLeaveId === leave.id;
                  const isConfirming = confirmRemoveLeaveId === leave.id;
                  const dayCount = countDays(leave.start_date, leave.end_date);

                  return (
                    <div
                      key={leave.id}
                      className="rounded-lg border bg-muted/20 p-3 text-sm space-y-1"
                    >
                      <div className="font-medium text-foreground break-words">
                        {formatLeaveDate(leave.start_date)}
                        {spansMultipleDays && (
                          <> &ndash; {formatLeaveDate(leave.end_date)}</>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground capitalize break-words">
                        {(leave.leave_type || "vacation").replace("_", " ")}
                        {leave.note ? ` \u2022 ${leave.note}` : ""}
                      </div>
                      {isConfirming ? (
                        <div className="pt-1 space-y-2">
                          <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                            {spansMultipleDays ? (
                              <>
                                Remove this leave? This will remove the entire {dayCount}-day
                                leave and cannot be undone.
                              </>
                            ) : (
                              <>Remove this leave? This cannot be undone.</>
                            )}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="h-7 text-xs cursor-pointer bg-destructive text-white hover:bg-destructive/80"
                              disabled={
                                loading ||
                                isRemoving ||
                                removingLeaveId !== null
                              }
                              onClick={() => handleRemoveLeave(leave.id)}
                            >
                              {isRemoving && (
                                <Spinner className="size-3 mr-1" />
                              )}
                              Confirm remove
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs cursor-pointer"
                              disabled={loading || isRemoving}
                              onClick={() => setConfirmRemoveLeaveId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs cursor-pointer"
                            disabled={
                              loading ||
                              removingLeaveId !== null ||
                              confirmRemoveLeaveId !== null
                            }
                            onClick={() => setConfirmRemoveLeaveId(leave.id)}
                          >
                            Remove leave
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

          {hasOverlappingLeave && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              This date already has a leave set.
            </p>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => onOpenChange(false)}
              disabled={loading || removingLeaveId !== null}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="w-full sm:w-auto"
              disabled={saveDisabled}
            >
              {loading && <Spinner className="size-4 mr-2" />} Save Leave
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}