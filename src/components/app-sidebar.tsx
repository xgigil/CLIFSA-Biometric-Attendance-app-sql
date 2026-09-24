"use client";

import * as React from "react";
import { ChevronRightIcon, FingerprintPattern, Settings2 } from "lucide-react";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  IconDashboard,
  IconCalendar,
  IconListDetails,
  IconPlus,
  IconFlag,
  IconCalendarEvent,
} from "@tabler/icons-react";
import { AddAttendanceDialog } from "@/components/attendance/add-attendance-dialog";
import { SetLeaveDialog } from "@/components/attendance/set-leave-dialog";
import { SetHolidayDialog } from "@/components/attendance/set-holiday-dialog";

const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: (
        <IconDashboard
          style={{ width: "1rem", height: "1rem" }}
          strokeWidth={2.5}
        />
      ),
    },
    {
      title: "Calendar",
      url: "/dashboard/calendar",
      icon: (
        <IconCalendar
          style={{ width: "1rem", height: "1rem" }}
          strokeWidth={2.5}
        />
      ),
    },
    {
      title: "Daily Logs",
      url: "/dashboard/analytics",
      icon: (
        <IconListDetails
          style={{ width: "1rem", height: "1rem" }}
          strokeWidth={2.5}
        />
      ),
    },
    {
      title: "Settings",
      url: "/dashboard/settings",
      icon: (
        <Settings2 style={{ width: "1rem", height: "1rem" }} strokeWidth={2.5} />
      ),
    },
  ],
};

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user?: {
    name: string;
    email: string;
    avatar: string;
    role?: string;
  };
}

export function AppSidebar({ user, ...props }: AppSidebarProps) {
  const { state, isMobile } = useSidebar();
  const isIconCollapsed = state === "collapsed" && !isMobile;
  const [isAddAttendanceOpen, setIsAddAttendanceOpen] = React.useState(false);
  const [isSetLeaveOpen, setIsSetLeaveOpen] = React.useState(false);
  const [isSetHolidayOpen, setIsSetHolidayOpen] = React.useState(false);

  const actionButtonClassName =
    "w-full h-10 gap-2 rounded-full border border-border bg-background font-semibold text-xs justify-start px-4 hover:!bg-gray-100 hover:!text-gray-700 dark:hover:!bg-gray-100 dark:hover:!text-gray-700 aria-expanded:!bg-gray-100 aria-expanded:!text-gray-700 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:h-9 items-center flex";

  return (
    <Sidebar variant="sidebar" {...props}>
      <SidebarHeader>
        <div className="my-2 mx-2 flex items-center gap-2">
          <FingerprintPattern className="size-8 text-sidebar-primary dark:text-blue-400 group-data-[collapsible=icon]:size-6" />
          <div className="grid text-left text-md leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate font-black text-sidebar-primary dark:text-blue-100">
              C L I F S A
            </span>
            <span className="truncate text-xs text-sidebar-primary dark:text-blue-300">
              Biometric Logs
            </span>
          </div>
        </div>
        <Separator
          orientation="horizontal"
          className="mx-1 data-horizontal:w-auto group-data-[collapsible=icon]:self-stretch group-data-[collapsible=icon]:mx-1"
        />
      </SidebarHeader>

      <SidebarContent className="">

        {user?.role === "admin" && (
          <>
            <div className="px-2.5 py-2 group-data-[collapsible=icon]:px-1.5 group-data-[collapsible=icon]:py-1.5 animate-fade-in group-data-[collapsible=icon]:my-2">
              <Button
                className="w-full h-10 gap-2 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs justify-start px-4 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:items-center items-center align-center flex"
                title="Add Attendance"
                onClick={() => setIsAddAttendanceOpen(true)}
              >
                <IconPlus className="size-4 shrink-0" />
                <span className="group-data-[collapsible=icon]:hidden">Add Attendance</span>
              </Button>
            </div>

            <div className="px-2.5 pb-2 group-data-[collapsible=icon]:px-1.5">
              {isIconCollapsed ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className={actionButtonClassName}
                      title="Leave & Holiday"
                    >
                      <IconCalendarEvent className="size-4 shrink-0" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    side="right"
                    align="start"
                    sideOffset={8}
                    className="min-w-44 rounded-lg"
                  >
                    <DropdownMenuItem
                      className="gap-2 text-xs font-medium cursor-pointer hover:bg-sidebar-accent hover:text-white focus:bg-sidebar-accent focus:text-white"
                      onClick={() => setIsSetLeaveOpen(true)}
                    >
                      <IconCalendar className="size-4 shrink-0" />
                      Set Leave
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="gap-2 text-xs font-medium cursor-pointer hover:bg-sidebar-accent hover:text-white focus:bg-sidebar-accent focus:text-white"
                      onClick={() => setIsSetHolidayOpen(true)}
                    >
                      <IconFlag className="size-4 shrink-0" />
                      Set Holiday
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Collapsible defaultOpen={false} className="group/leave-holiday">
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className={actionButtonClassName}
                      title="Leave & Holiday"
                    >
                      <IconCalendarEvent className="size-4 shrink-0" />
                      <span className="group-data-[collapsible=icon]:hidden">
                        Leave & Holiday
                      </span>
                      <ChevronRightIcon className="ml-auto size-4 shrink-0 transition-transform group-data-[collapsible=icon]:hidden group-data-[state=open]/leave-holiday:rotate-90" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 ml-3.5 flex flex-col gap-2 border-l border-sidebar-border pl-2.5">
                      <Button
                        variant="ghost"
                        className={actionButtonClassName}
                        title="Set Leave"
                        onClick={() => setIsSetLeaveOpen(true)}
                      >
                        <IconCalendar className="size-4 shrink-0" />
                        <span>Set Leave</span>
                      </Button>
                      <Button
                        variant="ghost"
                        className={actionButtonClassName}
                        title="Set Holiday"
                        onClick={() => setIsSetHolidayOpen(true)}
                      >
                        <IconFlag className="size-4 shrink-0" />
                        <span>Set Holiday</span>
                      </Button>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          </>
        )}
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter className="p-3 group-data-[collapsible=icon]:p-2">
        {user && <NavUser user={user} />}
      </SidebarFooter>
      <AddAttendanceDialog
        open={isAddAttendanceOpen}
        onOpenChange={setIsAddAttendanceOpen}
      />
      <SetLeaveDialog open={isSetLeaveOpen} onOpenChange={setIsSetLeaveOpen} />
      <SetHolidayDialog open={isSetHolidayOpen} onOpenChange={setIsSetHolidayOpen} />
    </Sidebar>
  );
}
