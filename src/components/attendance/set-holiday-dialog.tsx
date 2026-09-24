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
import { Spinner } from "@/components/ui/spinner";
import {
  getHolidaysForRangeAction,
  setHolidayAction,
  removeHolidayAction,
} from "@/app/dashboard/holidays/actions";

interface SetHolidayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: string;
}

type HolidayRecord = {
  id: number;
  start_date: string;
  end_date: string;
  note?: string | null;
};

function todayLocal(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function yearRangeAround(dateStr: string): { start: string; end: string } {
  const year = Number(dateStr.slice(0, 4)) || new Date().getFullYear();
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

export function SetHolidayDialog({
  open,
  onOpenChange,
  defaultDate,
}: SetHolidayDialogProps) {
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [note, setNote] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [fetching, setFetching] = React.useState(false);
  const [holidays, setHolidays] = React.useState<HolidayRecord[]>([]);
  const [removingId, setRemovingId] = React.useState<number | null>(null);

  const loadHolidays = React.useCallback(async (anchorDate: string) => {
    const { start, end } = yearRangeAround(anchorDate);
    setFetching(true);
    try {
      const res = await getHolidaysForRangeAction(start, end);
      if (res.success && res.data) {
        setHolidays(res.data as HolidayRecord[]);
      } else {
        toast.error(res.error || "Failed to load holidays");
      }
    } finally {
      setFetching(false);
    }
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const initial = defaultDate || todayLocal();
    setStartDate(initial);
    setEndDate(initial);
    setNote("");
    loadHolidays(initial);
  }, [open, defaultDate, loadHolidays]);

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    if (endDate && value > endDate) setEndDate(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      return toast.error("Please select a start and end date");
    }
    if (endDate < startDate) {
      return toast.error("End date cannot be before start date");
    }
    const trimmedNote = note.trim();
    if (!trimmedNote) {
      return toast.error("Please enter a note to identify this holiday");
    }

    setLoading(true);
    try {
      const res = await setHolidayAction({
        start_date: startDate,
        end_date: endDate,
        note: trimmedNote,
      });

      if (res.success) {
        toast.success("Company holiday saved for all employees");
        setNote("");
        await loadHolidays(startDate);
      } else {
        toast.error(res.error || "Failed to save holiday");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (id: number) => {
    setRemovingId(id);
    try {
      const res = await removeHolidayAction(id);
      if (res.success) {
        toast.success("Holiday removed");
        setHolidays((prev) => prev.filter((h) => h.id !== id));
      } else {
        toast.error(res.error || "Failed to remove holiday");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Set Company Holiday</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <p className="text-xs text-muted-foreground -mt-1">
            Applies to all employees. Personal leave cannot be set on these
            dates.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="holiday-start">Start date</Label>
              <Input
                id="holiday-start"
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="holiday-end">End date</Label>
              <Input
                id="holiday-end"
                type="date"
                min={startDate}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="holiday-note">Note</Label>
            <Input
              id="holiday-note"
              value={note}
              maxLength={255}
              required
              placeholder="e.g. National Holiday"
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="space-y-2 border-t pt-4">
            <Label className="text-xs text-muted-foreground">
              Holidays this year
            </Label>
            {fetching ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
                <Spinner className="size-4" /> Loading...
              </div>
            ) : holidays.length === 0 ? (
              <p className="text-sm text-muted-foreground">No holidays set yet.</p>
            ) : (
              <ul className="max-h-36 overflow-y-auto space-y-2">
                {holidays.map((h) => (
                  <li
                    key={h.id}
                    className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {h.note || "Untitled holiday"}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {h.start_date}
                        {h.end_date !== h.start_date ? ` – ${h.end_date}` : ""}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-rose-600 shrink-0"
                      disabled={removingId === h.id}
                      onClick={() => handleRemove(h.id)}
                    >
                      {removingId === h.id ? (
                        <Spinner className="size-3" />
                      ) : (
                        "Remove"
                      )}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
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
            <Button type="submit" disabled={loading || fetching}>
              {loading && <Spinner className="size-4 mr-2" />} Save Holiday
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
