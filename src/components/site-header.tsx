"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { IconBrandGithub } from "@tabler/icons-react";
import { StatusFilter, LEAVE_STATUS_OPTIONS } from "@/components/status-filter";
import * as React from "react";
import { ChevronLeft, ChevronRight, User } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getEmployeesAction } from "@/app/dashboard/analytics/actions";

interface SiteHeaderProps {
  isAdmin?: boolean;
  canManageLeave?: boolean;
}

export function SiteHeader({ isAdmin = true, canManageLeave = false }: SiteHeaderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [employees, setEmployees] = React.useState<{employee_id: number, employee_name: string}[]>([]);

  React.useEffect(() => {
    // CHANGED: the employee list used to load only for admins on the Calendar.
    // It now also loads on the Leave Requests page, for Admin and HR.
    // Everyone else skips the request, so we do not fetch data nobody will see.
    const needsEmployees =
      (isAdmin && pathname === "/dashboard/calendar") ||
      (canManageLeave && pathname === "/dashboard/leave-requests");
    if (!needsEmployees) return;

    const fetchEmployees = async () => {
      // Server action: browser cannot query MySQL directly.
      const result = await getEmployeesAction();
      if (result.success && result.data) {
        setEmployees(
          result.data.map((e: { employee_id: number; employee_name: string | null }) => ({
            employee_id: e.employee_id,
            employee_name: e.employee_name || "",
          })),
        );
      }
    };
    fetchEmployees();
  }, [isAdmin, canManageLeave, pathname]); // CHANGED: canManageLeave added

  // Determine title, subtitle, and right-side controls based on path
  let title = "Dashboard";
  let subtitle = "";
  let rightControls: React.ReactNode;

  if (pathname === "/dashboard/analytics") {
    const dateParam = searchParams.get("date");
    let currentDate = new Date();
    if (dateParam) {
      const [year, month, day] = dateParam.split("-").map(Number);
      if (year && month) {
        currentDate = new Date(year, month - 1, day || 1);
      }
    }

    const monthLabel = new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
    }).format(currentDate);

    if (!isAdmin) {
      title = monthLabel;
      subtitle = "Monthly personal biometric logs";
    } else {
      title = new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(currentDate);
      subtitle = "Daily attendance records";
    }

    const handlePrev = () => {
      const params = new URLSearchParams(searchParams.toString());
      if (!isAdmin) {
        const prevDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() - 1,
          1
        );
        const formatted = `${prevDate.getFullYear()}-${String(
          prevDate.getMonth() + 1
        ).padStart(2, "0")}-01`;
        params.set("date", formatted);
      } else {
        const prevDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          currentDate.getDate() - 1
        );
        const formatted = `${prevDate.getFullYear()}-${String(
          prevDate.getMonth() + 1
        ).padStart(2, "0")}-${String(prevDate.getDate()).padStart(2, "0")}`;
        params.set("date", formatted);
      }
      router.push("/dashboard/analytics?" + params.toString());
    };

    const handleNext = () => {
      const params = new URLSearchParams(searchParams.toString());
      if (!isAdmin) {
        const nextDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() + 1,
          1
        );
        const formatted = `${nextDate.getFullYear()}-${String(
          nextDate.getMonth() + 1
        ).padStart(2, "0")}-01`;
        params.set("date", formatted);
      } else {
        const nextDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          currentDate.getDate() + 1
        );
        const formatted = `${nextDate.getFullYear()}-${String(
          nextDate.getMonth() + 1
        ).padStart(2, "0")}-${String(nextDate.getDate()).padStart(2, "0")}`;
        params.set("date", formatted);
      }
      router.push("/dashboard/analytics?" + params.toString());
    };

    const handleToday = () => {
      const today = new Date();
      const params = new URLSearchParams(searchParams.toString());
      const formatted = `${today.getFullYear()}-${String(
        today.getMonth() + 1
      ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      params.set("date", formatted);
      router.push("/dashboard/analytics?" + params.toString());
    };

    rightControls = (
      <div className="flex items-center gap-2">
        <StatusFilter />
        <div className="flex items-center gap-1 border rounded-md">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrev}
            className="h-8 w-8 rounded-none"
            title={!isAdmin ? "Previous Month" : "Previous Day"}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            onClick={handleToday}
            className="h-8 rounded-none text-xs px-2 border-x"
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNext}
            className="h-8 w-8 rounded-none"
            title={!isAdmin ? "Next Month" : "Next Day"}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  } else if (pathname === "/dashboard/calendar") {
    const dateParam = searchParams.get("date");
    // Ensure we handle date parsing properly; dateParam could be YYYY-MM-DD
    let currentDate = new Date();
    if (dateParam) {
      // Create date at midnight local time to avoid timezone shift on rendering
      const [year, month, day] = dateParam.split("-").map(Number);
      if (year && month) {
        currentDate = new Date(year, month - 1, day || 1);
      }
    }

    const monthLabel = new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric"
    }).format(currentDate);

    title = monthLabel;
    subtitle = "Monthly attendance calendar view";

    const handlePrevMonth = () => {
      const prevDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
      const params = new URLSearchParams(searchParams.toString());
      const formatted = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-01`;
      params.set("date", formatted);
      router.push("/dashboard/calendar?" + params.toString());
    };

    const handleNextMonth = () => {
      const nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
      const params = new URLSearchParams(searchParams.toString());
      const formatted = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-01`;
      params.set("date", formatted);
      router.push("/dashboard/calendar?" + params.toString());
    };

    const handleToday = () => {
      const today = new Date();
      const params = new URLSearchParams(searchParams.toString());
      const formatted = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      params.set("date", formatted);
      router.push("/dashboard/calendar?" + params.toString());
    };

    rightControls = (
      <div className="flex items-center gap-2">
        {isAdmin && (
          <Select
            value={searchParams.get("employee_id") || "all"}
            onValueChange={(value) => {
              const params = new URLSearchParams(searchParams.toString());
              if (value === "all") {
                params.delete("employee_id");
              } else {
                params.set("employee_id", value);
              }
              router.push("/dashboard/calendar?" + params.toString());
            }}
          >
            <SelectTrigger className="w-[180px]">
              <User className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Select Employee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {employees.map((emp) => (
                <SelectItem key={emp.employee_id} value={emp.employee_id.toString()}>
                  {emp.employee_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="flex items-center gap-1 border rounded-md">
          <Button variant="ghost" size="icon" onClick={handlePrevMonth} className="h-8 w-8 rounded-none">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" onClick={handleToday} className="h-8 rounded-none text-xs px-2 border-x">
            Today
          </Button>
          <Button variant="ghost" size="icon" onClick={handleNextMonth} className="h-8 w-8 rounded-none">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  } else if (pathname.startsWith("/dashboard/leave-requests")) {
    const isList = pathname === "/dashboard/leave-requests";
    const isNew = pathname === "/dashboard/leave-requests/new";
    const printMatch = pathname.match(/^\/dashboard\/leave-requests\/(\d+)\/print$/);
    const detailMatch = pathname.match(/^\/dashboard\/leave-requests\/(\d+)$/);

    if (isList) {
      title = "Leave Requests";
      subtitle = "All requests for leave are handled here";

      // The status menu and employee picker only make sense on the list,
      // so they are only built for this page.
      rightControls = (
        <div className="flex items-center gap-2">
          {/* Everyone gets the status menu, members included. */}
          <StatusFilter options={LEAVE_STATUS_OPTIONS} />
          {/* Only Admin and HR get the employee picker. Members only ever
              see their own requests (the server enforces this). */}
          {canManageLeave && (
            <Select
              value={searchParams.get("employee_id") || "all"}
              onValueChange={(value) => {
                const params = new URLSearchParams(searchParams.toString());
                if (value === "all") {
                  params.delete("employee_id");
                } else {
                  params.set("employee_id", value);
                }
                router.push("/dashboard/leave-requests?" + params.toString());
              }}
            >
              <SelectTrigger className="w-[180px]">
                <User className="w-4 h-4 mr-2" />
                <SelectValue placeholder="All Employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {employees.map((emp) => (
                  <SelectItem key={emp.employee_id} value={emp.employee_id.toString()}>
                    {emp.employee_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      );
    } else if (isNew) {
      // The apply form page. No filters here, so rightControls stays empty.
      title = "New Leave Request";
      subtitle = "Fill in the form to request for leave";
    } else if (printMatch) {
      // The printable form. printMatch[1] is the request number from the address.
      title = `Print Leave Request #${printMatch[1]}`;
      subtitle = "Printable leave application form";
    } else if (detailMatch) {
      // One request's detail page. detailMatch[1] is the request number.
      title = `Leave Request #${detailMatch[1]}`;
      subtitle = "Review the details of this request";
    } else {
      // Any other address under leave-requests: keep a sensible title.
      title = "Leave Requests";
    }
  } else if (pathname === "/dashboard/reports") {
    title = "Reports";
  } else if (pathname === "/dashboard/settings") {
    title = "Settings";
  }

  return (
    <header className="flex h-17.25 shrink-0 bg-sidebar items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-14.25">
      <div className="flex w-full items-center justify-between gap-1 px-4 lg:gap-2 lg:px-6">
        <div className="flex items-center gap-1">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="hidden md:block mx-2 data-[orientation=vertical]:h-7"
          />
          <h1 className="text-lg md:text-lg font-bold text-gray-700 dark:text-gray-200 whitespace-nowrap">
            {title}
          </h1>

          <p className="hidden md:block text-sm text-gray-400 dark:text-gray-300 ml-5">
            {subtitle}
          </p>
        </div>

        <div className="flex items-center gap-1.5 md:gap-2">
          {rightControls}
          {/*<ModeToggle />*/}
          <Button variant="ghost" size="icon" className="shrink-0" asChild>
            <a
              href="https://github.com/akiArchives/Biometric-Attendance-Dashboard"
              rel="noopener noreferrer"
              target="_blank"
              className="size-fit m-0 dark:text-foreground"
            >
              <IconBrandGithub className="size-5 md:size-6 text-gray-700 dark:text-foreground" />
            </a>
          </Button>
        </div>
      </div>
    </header>
  );
}
