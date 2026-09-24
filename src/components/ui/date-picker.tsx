"use client";

import * as React from "react";
import { format } from "date-fns";
import { IconCalendarFilled, IconX } from "@tabler/icons-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerProps {
  selected?: string; // "YYYY-MM-DD"
  label?: string; // Optional label to override the default format
}

export function DatePicker({ selected, label }: DatePickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeDate = searchParams.get("date") || selected || "";

  // Parse YYYY-MM-DD safely into local timezone Date
  const date = React.useMemo(() => {
    if (!activeDate) return undefined;
    const [year, month, day] = activeDate.split("-").map(Number);
    if (!year || !month || !day) return undefined;
    return new Date(year, month - 1, day);
  }, [activeDate]);

  const handleSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
      const day = String(selectedDate.getDate()).padStart(2, "0");
      const dateString = `${year}-${month}-${day}`;

      const params = new URLSearchParams(searchParams.toString());
      params.set("date", dateString);
      router.push(`${pathname}?${params.toString()}`);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    params.delete("date");
    router.push(`${pathname}?${params.toString()}`);
  };

  const hasDateFilter = Boolean(searchParams.get("date") || selected);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"default"}
          className={cn(
            "w-auto justify-start text-left font-medium bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground px-2.5 gap-1.5",
            !hasDateFilter && "text-primary-foreground/90",
          )}
        >
          <IconCalendarFilled className="h-4 w-4 shrink-0 text-primary-foreground" />
          <span className="hidden md:inline">
            {label ? (
              label
            ) : date ? (
              format(date, "PPP")
            ) : (
              "All Dates"
            )}
          </span>
          {hasDateFilter && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  handleClear(e as unknown as React.MouseEvent);
                }
              }}
              className="flex items-center justify-center p-0.5 rounded-full hover:bg-primary-foreground/20 transition-colors ml-0.5"
              title="Clear date filter"
            >
              <IconX className="h-3.5 w-3.5 text-primary-foreground" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          disabled={(date) =>
            date > new Date() || date < new Date("1900-01-01")
          }
        />
      </PopoverContent>
    </Popover>
  );
}

