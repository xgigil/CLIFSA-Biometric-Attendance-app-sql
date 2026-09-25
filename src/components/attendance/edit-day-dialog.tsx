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
import { IconPlus, IconTrash, IconArrowBackUp } from "@tabler/icons-react";
import {
  createAttendanceLogAction,
  updateAttendanceLogAction,
  deleteAttendanceLogAction,
} from "@/app/dashboard/analytics/actions";
import {
  getLeavesForRangedAction,
  setLeaveAction,
  removeLeaveAction,
} from "@/app/dashboard/leaves/actions";
import { getHolidaysForRangeAction } from "@/app/dashboard/holidays/actions";
import type { RawBiometricLog } from "@/utils/attendance-processor";

export interface EditDayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: number | null;
  employeeName: string | null;
  date: string | null;
  punches: RawBiometricLog[];
}

interface PunchDraft {
  key: string;
  id: number | null;
  time: string;
  originalTime: string;
  deleted: boolean;
}

interface LeaveRecord {
  id: number;
  employee_id: number;
  start_date: string;
  end_date: string;
  leave_type?: string | null;
  note?: string | null;
}

const LEAVE_TYPES = [
  { value: "vacation", label: "Vacation" },
  { value: "sick", label: "Sick Leave" },
  { value: "unpaid", label: "Unpaid Leave" },
  { value: "other", label: "Other" },
];

function formatShortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
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

function punchToTime(punch: RawBiometricLog): string {
  if (punch.log_time) return punch.log_time.substring(0, 5);
  if (punch.log_date_time) return punch.log_date_time.substring(11, 16);
  return "";
}

export function EditDayDialog({
  open,
  onOpenChange,
  employeeId,
  employeeName,
  date,
  punches,
}: EditDayDialogProps) {
  const [drafts, setDrafts] = React.useState<PunchDraft[]>([]);
  const [leave, setLeave] = React.useState<LeaveRecord | null>(null);
  const [removeLeaveStaged, setRemoveLeaveStaged] = React.useState(false);
  const [markLeave, setMarkLeave] = React.useState(false);
  const [leaveType, setLeaveType] = React.useState("vacation");
  const [leaveNote, setLeaveNote] = React.useState("");
  const [fetchingLeave, setFetchingLeave] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [isCompanyHoliday, setIsCompanyHoliday] = React.useState(false);
  const [holidayNote, setHolidayNote] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;

    setDrafts(
      punches.map((punch, index) => {
        const time = punchToTime(punch);
        return {
          key: `existing-${punch.id}-${index}`,
          id: punch.id,
          time,
          originalTime: time,
          deleted: false,
        };
      })
    );

    setLeave(null);
    setRemoveLeaveStaged(false);
    setMarkLeave(false);
    setLeaveType("vacation");
    setLeaveNote("");
    setIsCompanyHoliday(false);
    setHolidayNote(null);

    if (!employeeId || !date) return;

    setFetchingLeave(true);
    Promise.all([
      getLeavesForRangedAction(date, date, employeeId),
      getHolidaysForRangeAction(date, date),
    ])
      .then(([leaveRes, holidayRes]) => {
        if (leaveRes.success && leaveRes.data) {
          const rows = leaveRes.data as LeaveRecord[];
          setLeave(
            rows.find((r) => Number(r.employee_id) === employeeId) || null
          );
        } else if (!leaveRes.success) {
          toast.error(leaveRes.error || "Failed to load the leave record");
        }

        if (holidayRes.success && holidayRes.data && holidayRes.data.length > 0) {
          setIsCompanyHoliday(true);
          setHolidayNote(holidayRes.data[0]?.note || null);
          setMarkLeave(false);
        }
      })
      .finally(() => setFetchingLeave(false));
  }, [open, employeeId, date, punches]);

  const updateDraft = (key: string, changes: Partial<PunchDraft>) => {
    setDrafts((prev) =>
      prev.map((d) => (d.key === key ? { ...d, ...changes } : d))
    );
  };

  const addPunch = () => {
    setDrafts((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}-${prev.length}`,
        id: null,
        time: "",
        originalTime: "",
        deleted: false,
      },
    ]);
  };

  const removeDraft = (key: string) => {
    setDrafts((prev) => {
      const target = prev.find((d) => d.key === key);
      if (target && target.id === null) return prev.filter((d) => d.key !== key);
      return prev.map((d) => (d.key === key ? { ...d, deleted: true } : d));
    });
  };

  const activeDrafts = drafts.filter((d) => !d.deleted);
  const willHavePunches = activeDrafts.some((d) => d.time);
  const leaveSpansRange = leave ? leave.start_date !== leave.end_date : false;

  const handleSave = async () => {
    if (!employeeId || !date) {
      toast.error("This row is missing an employee or date.");
      return;
    }

    if (activeDrafts.some((d) => !d.time)) {
      toast.error("Every punch needs a time, or remove it.");
      return;
    }

    setSaving(true);
    const failures: string[] = [];

    for (const draft of drafts) {
      if (draft.deleted && draft.id !== null) {
        const res = await deleteAttendanceLogAction(draft.id);
        if (!res.success) failures.push(res.error || "Failed to delete a punch");
        continue;
      }

      if (draft.deleted || !draft.time) continue;

      if (draft.id === null) {
        const res = await createAttendanceLogAction({
          employee_id: employeeId,
          employee_name: employeeName || "",
          log_date: date,
          log_time: draft.time,
        });
        if (!res.success) failures.push(res.error || "Failed to add a punch");
      } else if (draft.time !== draft.originalTime) {
        const res = await updateAttendanceLogAction(draft.id, {
          log_date: date,
          log_time: draft.time,
        });
        if (!res.success) failures.push(res.error || "Failed to update a punch");
      }
    }

    if (leave && removeLeaveStaged) {
      const res = await removeLeaveAction(leave.id);
      if (!res.success) failures.push(res.error || "Failed to remove leave");
    } else if (!leave && markLeave) {
      const res = await setLeaveAction({
        employee_id: employeeId,
        start_date: date,
        end_date: date,
        leave_type: leaveType,
        note: leaveNote.trim() || undefined,
      });
      if (!res.success) failures.push(res.error || "Failed to set leave");
    }

    setSaving(false);

    if (failures.length === 0) {
      toast.success("Day updated");
      onOpenChange(false);
    } else {
      failures.forEach((message) => toast.error(message));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Attendance Record</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
          <div>
            <Label className="text-xs text-muted-foreground">Employee</Label>
            <p className="font-semibold text-sm">{employeeName || "Unknown"}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Punches</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs cursor-pointer"
                onClick={addPunch}
                disabled={saving}
              >
                <IconPlus className="h-3.5 w-3.5" />
                Add punch
              </Button>
            </div>

            {drafts.length === 0 && (
              <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                No scans recorded for this day.
              </p>
            )}

            <div className="space-y-2">
              {drafts.map((draft) => (
                <div key={draft.key} className="flex items-center gap-2">
                  <Input
                    type="time"
                    step="1"
                    value={draft.time}
                    disabled={saving || draft.deleted}
                    onChange={(e) =>
                      updateDraft(draft.key, { time: e.target.value })
                    }
                    className={
                      draft.deleted ? "line-through opacity-50" : undefined
                    }
                  />
                  {draft.deleted ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 cursor-pointer"
                      title="Undo removal"
                      disabled={saving}
                      onClick={() => updateDraft(draft.key, { deleted: false })}
                    >
                      <IconArrowBackUp className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-slate-500 hover:text-rose-600 hover:bg-rose-500/10 dark:hover:text-rose-400 cursor-pointer"
                      title="Remove punch"
                      disabled={saving}
                      onClick={() => removeDraft(draft.key)}
                    >
                      <IconTrash className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 border-t pt-4">
            <Label className="text-xs text-muted-foreground">Leave</Label>

            {fetchingLeave && (
              <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
                <Spinner className="size-4" /> Checking leave...
              </div>
            )}

            {!fetchingLeave && leave && (
              <div className="rounded-lg border bg-muted/20 p-3 text-sm space-y-1">
                <div className="font-medium text-foreground">
                  {formatShortDate(leave.start_date)}
                  {leaveSpansRange && (
                    <> &ndash; {formatShortDate(leave.end_date)}</>
                  )}
                </div>
                <div className="text-xs text-muted-foreground capitalize">
                  {(leave.leave_type || "vacation").replace("_", " ")}
                  {leave.note ? ` \u2022 ${leave.note}` : ""}
                </div>

                {removeLeaveStaged ? (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-medium text-rose-600 dark:text-rose-400">
                      Will be removed on save.
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs cursor-pointer"
                      disabled={saving}
                      onClick={() => setRemoveLeaveStaged(false)}
                    >
                      Undo
                    </Button>
                  </div>
                ) : (
                  <div className="pt-1 space-y-1">
                    {leaveSpansRange && (
                      <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                        Removing this deletes the entire{" "}
                        {countDays(leave.start_date, leave.end_date)}-day leave,
                        not just this day.
                      </p>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs cursor-pointer"
                      disabled={saving}
                      onClick={() => setRemoveLeaveStaged(true)}
                    >
                      Remove leave
                    </Button>
                  </div>
                )}
              </div>
            )}

            {!fetchingLeave && isCompanyHoliday && (
              <div className="rounded-lg border border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/40 p-3 text-sm space-y-1">
                <div className="font-medium text-foreground">{holidayNote ? `${holidayNote}` : "Holiday"}</div>
                <div className="text-xs text-muted-foreground">
                  This day is a holiday for all employees. Personal leave
                  cannot be set here.
                </div>
              </div>
            )}

            {!fetchingLeave && !leave && !isCompanyHoliday && (
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="size-4 accent-blue-600 cursor-pointer"
                    checked={markLeave}
                    disabled={saving}
                    onChange={(e) => setMarkLeave(e.target.checked)}
                  />
                  Mark this day as on leave
                </label>

                {markLeave && (
                  <div className="space-y-3 pl-6">
                    <div className="space-y-2">
                      <Label htmlFor="day-leave-type" className="text-xs">
                        Leave type
                      </Label>
                      <Select
                        value={leaveType}
                        onValueChange={setLeaveType}
                        disabled={saving}
                      >
                        <SelectTrigger id="day-leave-type" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LEAVE_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="day-leave-note" className="text-xs">
                        Note (optional)
                      </Label>
                      <Input
                        id="day-leave-note"
                        value={leaveNote}
                        maxLength={255}
                        placeholder="e.g. Approved by HR"
                        disabled={saving}
                        onChange={(e) => setLeaveNote(e.target.value)}
                      />
                    </div>

                    {willHavePunches && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        This day has punches. Status will show as On Leave and will not count toward
                        present days or logged hours; scan times stay on the record.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || fetchingLeave}
            className="cursor-pointer"
          >
            {saving ? <Spinner className="size-4 mr-2" /> : null}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
