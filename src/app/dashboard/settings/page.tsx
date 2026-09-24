"use client";

import { useState, useEffect } from "react";
import type { AuthUser } from "@/lib/db-client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconLoader2, IconXFilled, IconCheckFilled } from "@tabler/icons-react";
import { useTheme } from "next-themes";
import SettingsLoading from "./loading";
import {
  deleteUserAction,
  getSettingsPageData,
  updateDisplayNameAction,
  updateSystemSettingsAction,
  updateUserEmployeeAction,
  updateUserRoleAction,
  updateUserStatusAction,
} from "./actions";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

// Default settings state
const defaultSettings = {
  // Profile
  adminName: "John Doe",
  adminEmail: "johndoe@clifsa.com",
  // Preferences
  theme: "system",
  defaultHomePage: "dashboard",
  // Shift Rules
  workStartTime: "09:00",
  gracePeriod: "15",
};

interface MemberProfile {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  status: "pending" | "approved" | "rejected";
  employee_id: number | null;
}

export function getStatusBadgeStyle(status: "pending" | "approved" | "rejected") {
  switch (status) {
    case "approved":
      return "bg-emerald-500/10 text-emerald-500 border border-emerald-500";
    case "rejected":
      return "bg-rose-500/10 text-rose-500 border border-rose-500";
    case "pending":
    default:
      return "bg-amber-500/10 text-amber-500 border border-amber-500 animate-pulse";
  }
}

interface Employee {
  employee_id: number;
  employee_name: string;
}

export default function SettingsPage() {
  const { setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [settings, setSettings] = useState(defaultSettings);
  const [role, setRole] = useState<"admin" | "member" | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [profiles, setProfiles] = useState<MemberProfile[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);
  const [isUpdatingEmployee, setIsUpdatingEmployee] = useState<string | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<MemberProfile | null>(null);

  const updateSetting = (key: keyof typeof defaultSettings, value: string) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  useEffect(() => {
    // Load local settings
    const saved = localStorage.getItem("clifsa_attendance_settings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSettings((prev) => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    }

    const fetchUserAndProfiles = async () => {
      try {
        // Server action: previously a browser-side supabase.from() call.
        const data = await getSettingsPageData();
        if (data.user) {
          setCurrentUser(data.user);
          updateSetting("adminEmail", data.user.email || "");
          const displayName = data.user.user_metadata?.full_name || data.user.user_metadata?.name || "";
          if (displayName) {
            updateSetting("adminName", displayName);
          }
          setRole(data.role);
          setProfiles(data.profiles);
          setEmployees(data.employees);
          if (data.sysSettings) {
            setSettings((prev) => ({
              ...prev,
              workStartTime: data.sysSettings?.work_start_time ?? "09:00",
              gracePeriod:
                data.sysSettings?.grace_period !== null &&
                data.sysSettings?.grace_period !== undefined
                  ? String(data.sysSettings.grace_period)
                  : prev.gracePeriod,
            }));
          }
        }
      } catch (e) {
        console.error("Failed to load user credentials or profiles", e);
        setRole("member");
      } finally {
        setMounted(true);
      }
    };

    fetchUserAndProfiles();
  }, []);

  if (!mounted) {
    return <SettingsLoading />;
  }

  const handleSaveAll = async () => {
    const timeRegex = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
    if (!timeRegex.test(settings.workStartTime)) {
      toast.error("Standard Work Start Time must be in 24h format (e.g. 09:00 or 17:30).");
      return;
    }

    setIsSaving(true);
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      localStorage.setItem(
        "clifsa_attendance_settings",
        JSON.stringify(settings),
      );

      // Apply theme
      setTheme(settings.theme);

      if (
        currentUser &&
        settings.adminName !== (currentUser.user_metadata?.full_name || currentUser.user_metadata?.name)
      ) {
        const result = await updateDisplayNameAction(settings.adminName);
        if (!result.success) throw new Error(result.error);
        if (result.user) {
          setCurrentUser(result.user);
          setProfiles((prev) =>
            prev.map((p) =>
              p.id === result.user?.id ? { ...p, name: settings.adminName } : p
            )
          );
        }
      }

      if (role === "admin") {
        const settingsResult = await updateSystemSettingsAction(
          settings.workStartTime,
          parseInt(settings.gracePeriod, 10) || 0,
        );
        if (!settingsResult.success) throw new Error(settingsResult.error);
      }

      toast.success("Settings saved successfully.");
    } catch (e) {
      console.error(e);
      toast.error("Failed to save settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRoleChange = async (
    userId: string,
    newRole: "admin" | "member",
  ) => {
    if (role !== "admin") {
      toast.error("You must be an administrator to perform this action.");
      return;
    }

    if (userId === currentUser?.id) {
      toast.error("You cannot change your own role.");
      return;
    }

    setIsUpdatingRole(userId);
    try {
      const result = await updateUserRoleAction(userId, newRole);
      if (!result.success) throw new Error(result.error);

      setProfiles((prev) =>
        prev.map((p) => (p.id === userId ? { ...p, role: newRole } : p)),
      );

      toast.success("User role updated successfully.");
    } catch (e) {
      console.error("Failed to update user role", e);
      toast.error("Failed to update user role.");
    } finally {
      setIsUpdatingRole(null);
    }
  };

  const handleEmployeeChange = async (
    userId: string,
    employeeId: number | null
  ) => {
    if (role !== "admin") {
      toast.error("You must be an administrator to perform this action.");
      return;
    }

    setIsUpdatingEmployee(userId);
    try {
      const result = await updateUserEmployeeAction(userId, employeeId);
      if (!result.success) throw new Error(result.error);

      setProfiles((prev) =>
        prev.map((p) => (p.id === userId ? { ...p, employee_id: employeeId } : p))
      );

      toast.success("Employee mapping updated successfully.");
    } catch (e) {
      console.error(e);
      toast.error("Failed to update employee mapping.");
    } finally {
      setIsUpdatingEmployee(null);
    }
  };

  const handleStatusChange = async (
    userId: string,
    newStatus: "pending" | "approved" | "rejected"
  ) => {
    if (role !== "admin") {
      toast.error("You must be an administrator to perform this action.");
      return;
    }

    if (userId === currentUser?.id) {
      toast.error("You cannot change your own status.");
      return;
    }

    const targetProfile = profiles.find((p) => p.id === userId);
    if (newStatus === "approved" && targetProfile && targetProfile.role === "member" && !targetProfile.employee_id) {
      toast.error("Please map this user to an Employee ID before approving.");
      return;
    }

    setIsUpdatingStatus(userId);
    try {
      const result = await updateUserStatusAction(userId, newStatus);
      if (!result.success) throw new Error(result.error);

      setProfiles((prev) =>
        prev.map((p) => (p.id === userId ? { ...p, status: newStatus } : p))
      );

      toast.success("User status updated successfully.");
    } catch (e) {
      console.error(e);
      toast.error("Failed to update user status.");
    } finally {
      setIsUpdatingStatus(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    const targetUserId = userToDelete.id;
    setIsDeletingUser(targetUserId);
    try {
      const res = await deleteUserAction(targetUserId);
      if (res.success) {
        setProfiles((prev) => prev.filter((p) => p.id !== targetUserId));
        setUserToDelete(null);
        toast.success("User account deleted successfully.");
      } else {
        setUserToDelete(null);
        toast.error(res.error || "Failed to delete user account.");
      }
    } catch (e) {
      console.error(e);
      setUserToDelete(null);
      toast.error(e instanceof Error ? e.message : "Failed to delete user account.");
    } finally {
      setIsDeletingUser(null);
    }
  };

  const getStatusBadge = (status: "pending" | "approved" | "rejected") => {
    const label = status === "rejected" ? "Declined" : status === "approved" ? "Approved" : "Pending Approval";
    return <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadgeStyle(status)}`}>{label}</span>;
  };

  const showAdminSettings = role === "admin";

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-10 space-y-10 bg-background min-h-full animate-fade-in">
      {/* HEADER */}

      <div className="space-y-8">
        {/* ACCOUNT PROFILE */}
        <div className="space-y-5 border-b pb-8">
          <div className="flex items-center gap-2 text-foreground font-semibold text-lg pb-2">
            <h2 className="">Account Profile</h2>
          </div>

          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-border/10 pb-4 gap-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium text-foreground">
                  Display Name
                </Label>
                <p className="text-xs text-muted-foreground">
                  Customize how your name appears on the system.
                </p>
              </div>
              <Input
                id="adminName"
                value={settings.adminName}
                onChange={(e) => updateSetting("adminName", e.target.value)}
                placeholder="Enter display name"
                className="w-fit border-border"
              />
            </div>

            <div className="flex items-center justify-between border-b border-border/10 pb-4 gap-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium text-foreground">
                  Account Email
                </Label>
                <p className="text-xs text-muted-foreground">
                  Your registered login email address.
                </p>
              </div>
              <Input
                id="adminEmail"
                type="email"
                value={settings.adminEmail}
                disabled
                className="w-fit"
              />
            </div>
          </div>
        </div>

        {/*PREFERENCES */}
        <div className="space-y-5 border-b pb-8">
          <div className="flex items-center gap-2 text-foreground font-semibold text-lg pb-2">
            <h2>Preferences</h2>
          </div>

          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-border/10 pb-4 gap-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium text-foreground">
                  Appearance
                </Label>
                <p className="text-xs text-muted-foreground">
                  Customize how the dashboard theme looks on your device.
                </p>
              </div>
              <Select
                value={settings.theme}
                onValueChange={(val) => updateSetting("theme", val)}
              >
                <SelectTrigger className="w-36 h-9 bg-muted/20 border-border justify-between">
                  <SelectValue placeholder="Theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between pb-2 gap-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium text-foreground">
                  Default Landing Page
                </Label>
                <p className="text-xs text-muted-foreground">
                  Choose which tab you land on when logging in.
                </p>
              </div>
              <Select
                value={settings.defaultHomePage}
                onValueChange={(val) => updateSetting("defaultHomePage", val)}
              >
                <SelectTrigger className="w-36 h-9 bg-muted/20 border-border justify-between">
                  <SelectValue placeholder="Default Page" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dashboard">Dashboard</SelectItem>
                  <SelectItem value="logs">Daily Logs</SelectItem>
                  <SelectItem value="reports">Reports</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>


        {/* SHIFT RULES (ADMIN ONLY) */}
        {showAdminSettings && (<div className="space-y-5 border-b pb-8">
          <div className="flex items-center gap-2 text-foreground font-semibold text-lg pb-2">
            <h2>Shift Rules</h2>
          </div>

          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-border/10 pb-4 gap-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium text-foreground">
                  Standard Work Start Time (24h)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Set the official daily start time for calculating late arrivals.
                </p>
              </div>
              <Input
                id="workStartTime"
                type="text"
                value={settings.workStartTime}
                onChange={(e) =>
                  updateSetting("workStartTime", e.target.value)
                }
                placeholder="e.g. 09:00"
                className="w-36 h-9 justify-between bg-muted/10 border-border focus:bg-transparent"
              />
            </div>

            <div className="flex items-center justify-between pb-2 gap-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium text-foreground">
                  Late Grace Period
                </Label>
                <p className="text-xs text-muted-foreground">
                  Allow a buffer period after work start time before marking attendance as late.
                </p>
              </div>
              <Select
                value={settings.gracePeriod}
                onValueChange={(val) => updateSetting("gracePeriod", val)}
              >
                <SelectTrigger
                  id="gracePeriod"
                  className="w-36 h-9 justify-between bg-muted/20 border-border"
                >
                  <SelectValue placeholder="Select minutes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No Grace Period</SelectItem>
                  <SelectItem value="5">5 Minutes</SelectItem>
                  <SelectItem value="10">10 Minutes</SelectItem>
                  <SelectItem value="15">15 Minutes</SelectItem>
                  <SelectItem value="30">30 Minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>)}

        {/* MEMBERS LIST (ADMIN ONLY) */}
        {showAdminSettings && profiles.length > 0 && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-foreground font-semibold text-lg pb-2">
              <h2>Workspace Members</h2>
            </div>
            <div className="border border-border rounded-xl overflow-hidden bg-muted/5">
              <table className="w-full border-collapse text-sm text-left">
                <thead>
                  <tr className="bg-muted/10 text-muted-foreground font-medium border-b border-border">
                    <th className="p-3">Name</th>
                    <th className="p-3">Email Address</th>
                    <th className="p-3">Linked Employee</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {profiles.map((profile) => (
                    <tr
                      key={profile.id}
                      className="hover:bg-muted/5 transition-colors"
                    >
                      <td className="p-3 text-foreground font-medium">
                        {profile.name || "—"}
                      </td>
                      <td className="p-3 text-foreground font-medium">
                        {profile.email}
                      </td>
                      <td className="p-3">
                        {profile.role === "admin" ? (
                          <span className="text-xs text-muted-foreground">N/A (Admin)</span>
                        ) : (
                          <Select
                            value={profile.employee_id !== null ? String(profile.employee_id) : "unlinked"}
                            onValueChange={(val) =>
                              handleEmployeeChange(
                                profile.id,
                                val === "unlinked" ? null : parseInt(val, 10)
                              )
                            }
                            disabled={isUpdatingEmployee === profile.id}
                          >
                            <SelectTrigger className="w-48 h-8 bg-muted/20 border-border justify-between inline-flex text-xs">
                              <SelectValue placeholder="Select Employee..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unlinked">Unlinked</SelectItem>
                              {employees.map((emp) => (
                                <SelectItem key={emp.employee_id} value={String(emp.employee_id)}>
                                  {emp.employee_name} ({emp.employee_id})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                      <td className="p-3">
                        {getStatusBadge(profile.status)}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isUpdatingRole === profile.id || isUpdatingStatus === profile.id ? (
                            <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground mr-3">
                              <IconLoader2 className="h-3 w-3 animate-spin" />
                              Updating...
                            </div>
                          ) : (
                            <>
                              <Select
                                value={profile.role}
                                onValueChange={(val) =>
                                  handleRoleChange(
                                    profile.id,
                                    val as "admin" | "member",
                                  )
                                }
                                disabled={profile.id === currentUser?.id} // Prevent editing self
                              >
                                <SelectTrigger className="w-28 h-8 bg-muted/20 border-border justify-between inline-flex text-xs">
                                  <SelectValue placeholder="Role" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="member">Member</SelectItem>
                                </SelectContent>
                              </Select>

                              {profile.id !== currentUser?.id && (
                                <>
                                  {profile.status !== "approved" && (
                                    <button
                                      onClick={() => handleStatusChange(profile.id, "approved")}
                                      className="p-1.5 border-2 border-emerald-500/90 rounded-md text-emerald-500/90 cursor-pointer transition-colors hover:bg-emerald-500/90 hover:text-emerald-100"
                                      title="Approve User"
                                      >
                                      <IconCheckFilled className="size-4" />
                                    </button>
                                  )}
                                  {profile.status !== "rejected" && (
                                    <button
                                      onClick={() => handleStatusChange(profile.id, "rejected")}
                                      className="p-1.5 border-2 border-rose-500/90 rounded-md text-rose-500/90 cursor-pointer transition-colors hover:bg-rose-500/90 hover:text-rose-100"
                                      title="Reject User"
                                      >
                                        <IconXFilled className="size-4" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => setUserToDelete(profile)}
                                    className="p-1.5 border-2 border-border rounded-md text-muted-foreground hover:text-destructive hover:border-destructive/20 cursor-pointer transition-colors"
                                    title="Delete User"
                                  >
                                    <Trash2 className="size-4" />
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SAVE BUTTON */}
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSaveAll}
            disabled={isSaving}
            className="px-6 py-5 text-sm"
          >
            {isSaving && <IconLoader2 className="h-4 w-4 animate-spin mr-2" />}
            Save Changes
          </Button>
        </div>
      </div>

      <Dialog open={!!userToDelete} onOpenChange={(open) => !open && !isDeletingUser && setUserToDelete(null)}>
        <DialogContent showCloseButton={!isDeletingUser}>
          <DialogHeader>
            <DialogTitle>Delete User Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete <strong>{userToDelete?.email}</strong>?
              This will delete their login credentials and all associated profile records. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              onClick={() => setUserToDelete(null)}
              disabled={!!isDeletingUser}
              className="px-4 py-2 text-sm font-medium text-foreground bg-muted hover:bg-muted/80 rounded-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteConfirm}
              disabled={!!isDeletingUser}
              className="px-4 py-2 text-sm font-medium text-white bg-destructive hover:bg-destructive/90 rounded-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 transition-colors"
            >
              {isDeletingUser ? "Deleting..." : "Delete User"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
