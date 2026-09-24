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
import {
  getEmployeesAction,
  createAttendanceLogAction,
} from "@/app/dashboard/analytics/actions";

interface AddAttendanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EmployeeOption {
  employee_id: number;
  employee_name: string;
}

export function AddAttendanceDialog({
  open,
  onOpenChange,
}: AddAttendanceDialogProps) {
  const [employees, setEmployees] = React.useState<EmployeeOption[]>([]);
  const [selectedEmpId, setSelectedEmpId] = React.useState<string>("");
  const [logDate, setLogDate] = React.useState<string>("");
  const [logTime, setLogTime] = React.useState<string>("");
  const [loading, setLoading] = React.useState<boolean>(false);
  const [fetchingEmployees, setFetchingEmployees] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (open) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");

      setLogDate(`${year}-${month}-${day}`);
      setLogTime(`${hours}:${minutes}`);
      setSelectedEmpId("");

      setFetchingEmployees(true);
      getEmployeesAction()
        .then((res) => {
          if (res.success && res.data) {
            setEmployees(res.data);
          } else {
            toast.error(res.error || "Failed to fetch employees");
          }
        })
        .finally(() => {
          setFetchingEmployees(false);
        });
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId) {
      toast.error("Please select an employee");
      return;
    }
    if (!logDate) {
      toast.error("Please select a valid date");
      return;
    }
    if (!logTime) {
      toast.error("Please select a valid time");
      return;
    }

    const empIdNum = parseInt(selectedEmpId, 10);
    const emp = employees.find((e) => e.employee_id === empIdNum);
    if (!emp) {
      toast.error("Selected employee not found");
      return;
    }

    setLoading(true);
    try {
      const res = await createAttendanceLogAction({
        employee_id: emp.employee_id,
        employee_name: emp.employee_name,
        log_date: logDate,
        log_time: logTime,
      });

      if (res.success) {
        toast.success("Attendance log added successfully");
        onOpenChange(false);
      } else {
        toast.error(res.error || "Failed to add attendance log");
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Attendance Log</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="employee">Employee</Label>
            {fetchingEmployees ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Spinner className="size-4" /> Loading employees...
              </div>
            ) : (
              <Select value={selectedEmpId} onValueChange={setSelectedEmpId}>
                <SelectTrigger id="employee" className="w-full">
                  <SelectValue placeholder="Select an employee" />
                </SelectTrigger>
                <SelectContent>
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

          <div className="space-y-2">
            <Label htmlFor="log_date">Date</Label>
            <Input
              id="log_date"
              type="date"
              value={logDate}
              onChange={(e) => setLogDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="log_time">Time</Label>
            <Input
              id="log_time"
              type="time"
              step="1"
              value={logTime}
              onChange={(e) => setLogTime(e.target.value)}
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
              {loading && <Spinner className="size-4 mr-2" />} Save Log
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
