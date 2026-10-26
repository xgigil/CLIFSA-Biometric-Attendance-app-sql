"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  previewLeaveDaysAction,
  submitLeaveApplicationAction,
} from "../apply-actions";
import { formatFormDate, formatWeekday, formatDays } from "../format";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface EmployeeOption {
	employee_id: number;
	employee_name: string;
}

interface LeaveTypeOption {
	id: number;
	name: string;
}

interface ApplyFormProps {
	isAuthorized: boolean;
	employees: EmployeeOption[];
	defaultEmployeeId: number | null;
	leaveTypes: LeaveTypeOption[];
}

interface Preview {
	totalDays: number;
	halfDayCandidates: string[];
	beginning_balance: number;
	leave_taken: number;
	allowable_leave: number;
}

function todayLocal(): string {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function ApplyForm ({
	isAuthorized,
	employees,
	defaultEmployeeId,
	leaveTypes,
}: ApplyFormProps) {
	const router = useRouter();

	const initialEmp =  defaultEmployeeId ? String(defaultEmployeeId) : "";
  const initialName = employees.find((e) => e.employee_id === defaultEmployeeId)?.employee_name ?? "";

	const [employeeId, setEmployeeId] = React.useState(initialEmp);
  const [applicantName, setApplicantName] = React.useState(initialName);
  const [position, setPosition] = React.useState("");
  const [department, setDepartment] = React.useState("");
  const [leaveTypeId, setLeaveTypeId] = React.useState("");
  const [note, setNote] = React.useState("");
  const [startDate, setStartDate] = React.useState(todayLocal);
  const [endDate, setEndDate] = React.useState(todayLocal);
  const [halfDay, setHalfDay] = React.useState(false);
  const [halfDates, setHalfDates] = React.useState<string[]>([]);

  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

	const effectiveHalfDays = React.useMemo(() => {
		if (!halfDay || !startDate || !endDate) return [];
		if (startDate === endDate) return [startDate];
		return halfDates.filter((d) => d >= startDate && d <= endDate).sort();
	}, [halfDay, startDate, endDate, halfDates]);

  React.useEffect(() => {
    setPreviewError(null);

    if (
      !employeeId ||
      !leaveTypeId ||
      !startDate ||
      !endDate ||
      endDate < startDate
    ) {
      setPreview(null);
      setPreviewLoading(false);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await previewLeaveDaysAction({
          employee_id: parseInt(employeeId, 10),
          start_date: startDate,
          end_date: endDate,
          leave_type_id: parseInt(leaveTypeId, 10),
          halfDayDates: effectiveHalfDays,
        });
        if (cancelled) return;
        if (res.success && res.data) {
          setPreview(res.data as Preview);
          setPreviewError(null);
        } else {
          setPreview(null);
          setPreviewError(res.error || "Could not calculate leave days");
        }
      } catch (err) {
        if (cancelled) return;
        setPreview(null);
        setPreviewError(
          err instanceof Error ? err.message : "Could not calculate leave days"
        );
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [employeeId, leaveTypeId, startDate, endDate, effectiveHalfDays]);

	const handleEmployeeChange = (value: string) => {
    setEmployeeId(value);
    const emp = employees.find((e) => String(e.employee_id) === value);
    setApplicantName(emp?.employee_name ?? ""); // pre-fill, still editable
  };

	const handleStartDateChange = (value: string) => {
    setStartDate(value);
    if (endDate && value > endDate) setEndDate(value);
  };

  const toggleHalfDate = (date: string, checked: boolean) => {
    setHalfDates((prev) =>
      checked ? [...prev, date] : prev.filter((d) => d !== date)
    );
  };

  const canSubmit =
    !submitting &&
    !previewLoading &&
    !!preview &&
    !previewError &&
    applicantName.trim().length > 0 &&
    note.trim().length > 0;

  const requestIsValid = () => {
    if (!employeeId) {
      toast.error("Please select an employee");
      return false;
    }
    if (!applicantName.trim()) {
      toast.error("Name is required");
      return false;
    }
    if (!leaveTypeId) {
      toast.error("Please select a leave type");
      return false;
    }
    if (!startDate || !endDate) {
      toast.error("Please select From and To dates");
      return false;
    }
    if (endDate < startDate) {
      toast.error("To date cannot be before From date");
      return false;
    }
    if (!note.trim()) {
      toast.error("Reason for leave is required");
      return false;
    }
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestIsValid()) return;
    setConfirmOpen(true);
  };

  const sendRequest = async () => {
    setSubmitting(true);
    try {
      const res = await submitLeaveApplicationAction({
        employee_id: parseInt(employeeId, 10),
        start_date: startDate,
        end_date: endDate,
        leave_type_id: parseInt(leaveTypeId, 10),
        note: note.trim(),
        applicant_name: applicantName.trim(),
        position: position.trim() || null,
        department: department.trim() || null,
        halfDayDates: effectiveHalfDays,
      });

      if (res.success && res.leaveId) {
        toast.success("Leave request submitted");
        setConfirmOpen(false);
        router.push(`/dashboard/leave-requests/${res.leaveId}`);
      } else {
        toast.error(res.error || "Failed to submit leave request");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

	const hasMultipleDays = !!startDate && !!endDate && startDate!== endDate;

	return (
    <>
		<form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Leave Request</h1>
        <p className="text-sm text-muted-foreground">
          Your request stays pending until HR or Admin approves it.
        </p>
      </div>

      {/* Who */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="app-employee">Employee</Label>
          {isAuthorized ? (
            <Select value={employeeId} onValueChange={handleEmployeeChange}>
              <SelectTrigger id="app-employee" className="w-full min-w-0">
                <SelectValue placeholder="Select an employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.employee_id} value={String(emp.employee_id)}>
                    {emp.employee_name} ({emp.employee_id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input id="app-employee" value={initialName || initialEmp} disabled />
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="app-filed">Date filed</Label>
          {/* suppressHydrationWarning: server and browser can disagree on "today" near midnight. */}
          <Input
            id="app-filed"
            value={formatFormDate(todayLocal())}
            disabled
            suppressHydrationWarning
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="app-name">Name</Label>
          <Input
            id="app-name"
            value={applicantName}
            maxLength={255}
            onChange={(e) => setApplicantName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="app-position">Position</Label>
          <Input
            id="app-position"
            value={position}
            maxLength={255}
            onChange={(e) => setPosition(e.target.value)}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="app-dept">Department / Section</Label>
          <Input
            id="app-dept"
            value={department}
            maxLength={255}
            onChange={(e) => setDepartment(e.target.value)}
          />
        </div>
      </div>

      {/* Type of leave (checklist: exactly one can be chosen) */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Type of leave</legend>
        {leaveTypes.length === 0 ? (
          <p className="text-sm text-red-500">No active leave types configured.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {leaveTypes.map((t) => (
              <label
                key={t.id}
                className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-muted/40"
              >
                <input
                  type="radio"
                  name="leave-type"
                  value={t.id}
                  checked={leaveTypeId === String(t.id)}
                  onChange={() => setLeaveTypeId(String(t.id))}
                />
                {t.name}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      {/* Dates */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="app-from">From</Label>
          <Input
            id="app-from"
            type="date"
            value={startDate}
            onChange={(e) => handleStartDateChange(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="app-to">To</Label>
          <Input
            id="app-to"
            type="date"
            min={startDate}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      {/* Half-day */}
      <div className="space-y-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={halfDay}
            onChange={(e) => setHalfDay(e.target.checked)}
          />
          Include half-day leave
        </label>

        {halfDay && !hasMultipleDays && (
          <p className="text-xs text-muted-foreground">
            The single day in this range will count as a half-day leave.
          </p>
        )}

        {halfDay && hasMultipleDays && (
          <div className="rounded-md border p-3 space-y-2">
            <p className="text-xs text-muted-foreground">
              Tick the days that are half days.
            </p>
            {!preview ? (
              <p className="text-xs text-muted-foreground">
                Choose an employee, a leave type and valid dates to see the days.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {preview.halfDayCandidates.map((d) => (
                  <label key={d} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={effectiveHalfDays.includes(d)}
                      onChange={(e) => toggleHalfDate(d, e.target.checked)}
                    />
                    {formatWeekday(d)} {d.substring(5)}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reason */}
      <div className="space-y-2">
        <Label htmlFor="app-note">Reason(s)</Label>
        <Input
          id="app-note"
          value={note}
          maxLength={255}
          placeholder="e.g. Personal matter"
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {/* Live totals */}
      <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Total # of days</span>
          {previewLoading ? (
            <Spinner className="size-4" />
          ) : (
            <span className="text-lg font-semibold">
              {preview ? formatDays(preview.totalDays) : "-"}
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 text-center text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Beginning balance</div>
            <div className="font-medium">
              {preview ? formatDays(preview.beginning_balance) : "-"}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Leave taken</div>
            <div className="font-medium">
              {preview ? formatDays(preview.leave_taken) : "-"}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Allowable leave</div>
            <div
              className={
                "font-medium " +
                (preview && preview.allowable_leave < 0 ? "text-rose-600" : "")
              }
            >
              {preview ? formatDays(preview.allowable_leave) : "-"}
            </div>
          </div>
        </div>

        {previewError && <p className="text-xs text-rose-600">{previewError}</p>}
        {preview && preview.allowable_leave < 0 && (
          <p className="text-xs text-amber-600">
            This request is more than the remaining balance.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Balances do not change until the leave request is approved.
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/leave-requests">Cancel</Link>
        </Button>
        <Button type="submit" disabled={!canSubmit} className="cursor-pointer">
          {submitting && <Spinner className="size-4 mr-2" />} Submit request
        </Button>
      </div>
    </form>
    <ConfirmDialog
      open={confirmOpen}
      title="Submit this request?"
      description="The request will be filed as pending. It will not reduce the leave balance until it is approved."
      confirmLabel="Submit request"
      confirmVariant="default"
      pending={submitting}
      onOpenChange={(open) => {
        if (!open) setConfirmOpen(false);
      }}
      onConfirm={sendRequest}
    />
		</>
	);
}
