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
import { setLeaveAction, setLeaveForAllAction } from "@/app/dashboard/leaves/actions";

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

const LEAVE_TYPES = [ // Add here the types of on-leave here
  { value: "vacation", label: "Vacation" },
  { value: "sick", label: "Sick Leave" },
  { value: "unpaid", label: "Unpaid Leave" },
  { value: "other", label: "Other" },
];

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

  // Dragging the start past the end should carry the end with it.
  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    if (endDate && value > endDate) setEndDate(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedEmpId) return toast.error("Please select an employee");
    if (!startDate || !endDate)
      return toast.error("Please select a start and end date");
    if (endDate < startDate)
      return toast.error("End date cannot be before start date");

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
            (res.skipped ? ` (${res.skipped} already on leave, skipped)` : "")
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
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
                <SelectTrigger id="leave-employee" className="w-full">
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
              Applies to every active employee. People already on leave for this range are skipped.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="leave-start">Start date</Label>
              <Input
                id="leave-start"
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="leave-end">End date</Label>
              <Input
                id="leave-end"
                type="date"
                min={startDate}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="leave-type">Leave type</Label>
            <Select value={leaveType} onValueChange={setLeaveType}>
              <SelectTrigger id="leave-type" className="w-full">
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

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || fetchingEmployees}>
              {loading && <Spinner className="size-4 mr-2" />} Save Leave
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}