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
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const FILTERABLE_STATUSES = [
  "present",
  "late",
  "absent",
  "on_leave",
  "holiday",
] as const;
type FilterStatus = (typeof FILTERABLE_STATUSES)[number];

export function StatusFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedStatuses = React.useMemo(() => {
    const statusParam = searchParams.get("status");
    if (!statusParam) {
      return new Set<FilterStatus>(FILTERABLE_STATUSES);
    }
    return new Set<FilterStatus>(
      statusParam
        .split(",")
        .filter((s): s is FilterStatus =>
          FILTERABLE_STATUSES.includes(s as FilterStatus)
        )
    );
  }, [searchParams]);

  const handleToggle = (status: FilterStatus) => {
    const newSelected = new Set(selectedStatuses);
    if (newSelected.has(status)) {
      newSelected.delete(status);
    } else {
      newSelected.add(status);
    }

    const params = new URLSearchParams(searchParams.toString());

    if (newSelected.size === FILTERABLE_STATUSES.length) {
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
        <DropdownMenuCheckboxItem
          checked={selectedStatuses.has("present")}
          onCheckedChange={() => handleToggle("present")}
        >
          <IconCircleCheckFilled
            size={14}
            className="text-emerald-500 shrink-0"
          />
          Present
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={selectedStatuses.has("late")}
          onCheckedChange={() => handleToggle("late")}
        >
          <IconAlarmFilled size={14} className="text-orange-500 shrink-0" />
          Late
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={selectedStatuses.has("absent")}
          onCheckedChange={() => handleToggle("absent")}
        >
          <IconCircleXFilled size={14} className="text-rose-500 shrink-0" />
          Absent
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={selectedStatuses.has("on_leave")}
          onCheckedChange={() => handleToggle("on_leave")}
        >
          <IconCalendar size={14} className="text-blue-500 shrink-0" />
          On Leave
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={selectedStatuses.has("holiday")}
          onCheckedChange={() => handleToggle("holiday")}
        >
          <IconFlag
            size={14}
            className="text-slate-600 dark:text-slate-400 shrink-0"
          />
          Holiday
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
