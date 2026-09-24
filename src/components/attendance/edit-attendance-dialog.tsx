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
import { updateAttendanceLogAction } from "@/app/dashboard/analytics/actions";
import { Spinner } from "@/components/ui/spinner";

interface EditAttendanceDialogProps {
  log: {
    id: number;
    employee_name: string | null;
    log_date: string | null;
    log_time: string | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditAttendanceDialog({
  log,
  open,
  onOpenChange,
}: EditAttendanceDialogProps) {
  const [logDate, setLogDate] = React.useState("");
  const [logTime, setLogTime] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (log) {
      setLogDate(log.log_date || "");
      setLogTime(log.log_time ? log.log_time.substring(0, 5) : "");
    }
  }, [log]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!log) return;
    if (!logDate || !logTime) {
      toast.error("Please enter a valid date and time");
      return;
    }

    setLoading(true);
    const res = await updateAttendanceLogAction(log.id, {
      log_date: logDate,
      log_time: logTime,
    });
    setLoading(false);

    if (res.success) {
      toast.success("Attendance log updated");
      onOpenChange(false);
    } else {
      toast.error(res.error || "Failed to update attendance log");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Attendance Record</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <Label className="text-xs text-muted-foreground">Employee</Label>
            <p className="font-semibold text-sm">{log?.employee_name || "Unknown"}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit_log_date">Date</Label>
              <Input
                id="edit_log_date"
                type="date"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                disabled={loading}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_log_time">Time</Label>
              <Input
                id="edit_log_time"
                type="time"
                step="1"
                value={logTime}
                onChange={(e) => setLogTime(e.target.value)}
                disabled={loading}
                required
              />
            </div>
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
            <Button type="submit" disabled={loading}>
              {loading ? <Spinner className="size-4 mr-2" /> : null}
              Update Record
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
