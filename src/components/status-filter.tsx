"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  IconFilter2,
  IconCircleCheckFilled,
  IconAlarmFilled,
  IconCircleXFilled,
  IconCalendar,
  IconFlag,
  IconClockFilled,
  IconBan,
  type Icon,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// CHANGED: this one component now serves every page that has a status menu.
// Each page tells it WHICH statuses to show by passing a list ("options").
// To add a status menu to a new page, add a list below and pass it in.
export type StatusOption = {
  value: string; // the text saved in the web address, e.g. ?status=on_leave
  label: string; // the text people see in the menu
  icon: Icon; // the small icon beside the label
  iconClassName: string; // the icon's color
};

// Used by Daily Logs. This is the default, so <StatusFilter /> works exactly as before.
export const ATTENDANCE_STATUS_OPTIONS: StatusOption[] = [
  { value: "present", label: "Present", icon: IconCircleCheckFilled, iconClassName: "text-emerald-500" },
  { value: "late", label: "Late", icon: IconAlarmFilled, iconClassName: "text-orange-500" },
  { value: "absent", label: "Absent", icon: IconCircleXFilled, iconClassName: "text-rose-500" },
  { value: "on_leave", label: "On Leave", icon: IconCalendar, iconClassName: "text-blue-500" },
  { value: "holiday", label: "Holiday", icon: IconFlag, iconClassName: "text-slate-600 dark:text-slate-400" },
];

// Used by Leave Requests. These values must match the statuses saved
// in the database (see APPLICATION_STATUSES in leave-requests/_lib/errors.ts).
export const LEAVE_STATUS_OPTIONS: StatusOption[] = [
  { value: "pending", label: "Pending", icon: IconClockFilled, iconClassName: "text-amber-500" },
  { value: "approved", label: "Approved", icon: IconCircleCheckFilled, iconClassName: "text-emerald-500" },
  { value: "denied", label: "Denied", icon: IconCircleXFilled, iconClassName: "text-rose-500" },
  { value: "cancelled", label: "Cancelled", icon: IconBan, iconClassName: "text-slate-600 dark:text-slate-400" },
];

export function StatusFilter({
  options = ATTENDANCE_STATUS_OPTIONS,
}: {
  options?: StatusOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const allValues = React.useMemo(() => options.map((o) => o.value), [options]);

  // Which boxes are ticked is stored in the web address, for example
  // ?status=pending,approved. If there is no "status" in the address,
  // every box is ticked, which means "show everything".
  const selectedStatuses = React.useMemo(() => {
    const statusParam = searchParams.get("status");
    if (!statusParam) {
      return new Set<string>(allValues);
    }
    // Ignore any value that is not in this menu's list (the address can be edited by hand).
    return new Set<string>(
      statusParam.split(",").filter((s) => allValues.includes(s))
    );
  }, [searchParams, allValues]);

  // Runs when someone ticks or unticks a box. It updates the web address,
  // and the page reloads its list from the new address.
  const handleToggle = (status: string) => {
    const newSelected = new Set(selectedStatuses);
    if (newSelected.has(status)) {
      newSelected.delete(status);
    } else {
      newSelected.add(status);
    }

    const params = new URLSearchParams(searchParams.toString());

    // Everything ticked is the same as no filter, so we remove "status"
    // from the address to keep it clean.
    if (newSelected.size === allValues.length) {
      params.delete("status");
    } else {
      params.set("status", Array.from(newSelected).join(","));
    }

    router.push(pathname + "?" + params.toString());
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="border-transparent text-gray-700 bg-primary dark:bg-primary dark:hover:bg-primary/90 hover:bg-primary/90 shrink-0"
          title="Filter by Status"
        >
          <IconFilter2 className="size-4 text-primary-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuLabel>Status</DropdownMenuLabel>
        {/* CHANGED: one checkbox row per option, instead of five hand-written rows. */}
        {options.map(({ value, label, icon: StatusIcon, iconClassName }) => (
          <DropdownMenuCheckboxItem
            key={value}
            checked={selectedStatuses.has(value)}
            onCheckedChange={() => handleToggle(value)}
          >
            <StatusIcon size={14} className={`${iconClassName} shrink-0`} />
            {label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}