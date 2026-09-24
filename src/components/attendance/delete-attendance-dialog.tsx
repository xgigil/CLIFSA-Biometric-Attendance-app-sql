"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { deleteAttendanceLogAction } from "@/app/dashboard/analytics/actions";
import { Spinner } from "@/components/ui/spinner";

interface DeleteAttendanceDialogProps {
  logId: number | null;
  employeeName?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteAttendanceDialog({
  logId,
  employeeName,
  open,
  onOpenChange,
}: DeleteAttendanceDialogProps) {
  const [loading, setLoading] = React.useState(false);

  const handleDelete = async () => {
    if (!logId) return;
    setLoading(true);
    const res = await deleteAttendanceLogAction(logId);
    setLoading(false);

    if (res.success) {
      toast.success("Attendance log deleted");
      onOpenChange(false);
    } else {
      toast.error(res.error || "Failed to delete attendance log");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Delete Attendance Log</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this log entry for{" "}
            <span className="font-semibold text-foreground">
              {employeeName || "this employee"}
            </span>
            ? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
            className="bg-destructive text-white hover:bg-destructive/80 cursor-pointer"
          >
            {loading ? <Spinner className="size-4 mr-2" /> : null}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
