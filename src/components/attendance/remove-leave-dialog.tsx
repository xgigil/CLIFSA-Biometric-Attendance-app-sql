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
import { Spinner } from "@/components/ui/spinner";
import {
    getLeavesForRangedAction,
    removeLeaveAction,
} from "@/app/dashboard/leaves/actions";

interface RemoveLeaveDialogProps {
    employeeId: number | null;
    employeeName?: string | null;
    date: string | null
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface LeaveRecord {
    id: number;
    employee_id: number;
    start_date: string;
    end_date: string;
    leave_type: string | null;
    note: string | null;
}

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
    return Math.round((e - s) / 86400000) + 1
}

export function RemoveLeaveDialog({
    employeeId,
    employeeName,
    date,
    open,
    onOpenChange,
}: RemoveLeaveDialogProps) {
    const [ leave, setLeave ] = React.useState<LeaveRecord | null>(null);
    const [ fetching, setFetching ] = React.useState(false);
    const [ loading, setLoading ] = React.useState(false);

    React.useEffect(() => {
        if (!open || !employeeId || !date) return;

        setLeave(null);
        setFetching(true);

        getLeavesForRangedAction(date, date, employeeId).then((res) => {
            if (res.success && res.data) {
                const rows = res.data as LeaveRecord[];
                setLeave(rows.find((r) => Number(r.employee_id) === employeeId) || null);
            } else {
                toast.error(res.error || "Failed to load the leave record");
            }
        }).finally(() => setFetching(false));
    }, [open, employeeId, date]);

    const handleRemove = async () => {
        if (!leave) return;
        setLoading(true);
        const res = await removeLeaveAction(leave.id);
        setLoading(false);

        if (res.success) {
            toast.success("Leave removed successfully");
            onOpenChange(false);
        } else {
            toast.error(res.error || "Failed to remove the leave");
        }
    };

    const spansMultipleDays = leave ? leave.start_date !== leave.end_date : false;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[420px]">
                <DialogHeader>
                <DialogTitle>Remove Leave</DialogTitle>
                <DialogDescription>
                    {fetching ? (
                    "Looking up the leave record..."
                    ) : leave ? (
                    <>
                        Remove this leave for{" "}
                        <span className="font-semibold text-foreground">
                        {employeeName || "this employee"}
                        </span>
                        ? This action cannot be undone.
                    </>
                    ) : (
                    "No leave record was found for this day. It may have already been removed."
                    )}
                </DialogDescription>
                </DialogHeader>
                {fetching && (
                <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                    <Spinner className="size-4" /> Loading...
                </div>
                )}
                {!fetching && leave && (
                <div className="rounded-lg border bg-muted/20 p-3 text-sm space-y-1">
                    <div className="font-medium text-foreground">
                    {formatLeaveDate(leave.start_date)}
                    {spansMultipleDays && <> &ndash; {formatLeaveDate(leave.end_date)}</>}
                    </div>
                    <div className="text-xs text-muted-foreground capitalize">
                    {(leave.leave_type || "vacation").replace("_", " ")}
                    {leave.note ? ` • ${leave.note}` : ""}
                    </div>
                    {spansMultipleDays && (
                    <p className="pt-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                        This removes the entire{" "}
                        {countDays(leave.start_date, leave.end_date)}-day leave, not just{" "}
                        {date ? formatLeaveDate(date) : "this day"}.
                    </p>
                    )}
                </div>
                )}
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
                    onClick={handleRemove}
                    disabled={loading || fetching || !leave}
                    className="bg-destructive text-white hover:bg-destructive/80 cursor-pointer"
                >
                    {loading ? <Spinner className="size-4 mr-2" /> : null}
                    Remove Leave
                </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}