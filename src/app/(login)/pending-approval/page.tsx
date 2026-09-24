"use client";

import { logout } from "@/app/(login)/actions";
import { ShieldAlert, LogOut } from "lucide-react";

export default function PendingApprovalPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="flex items-center gap-2 self-center font-medium">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldAlert className="size-4 animate-pulse" />
          </div>
          Attendance Dashboard
        </div>
        <div className="bg-card text-card-foreground border rounded-lg p-8 shadow-sm flex flex-col items-center text-center gap-6">
          <h1 className="text-2xl font-bold tracking-tight">Registration Pending</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Your account has been successfully created and is waiting for administrator approval. 
            Please contact your system administrator or check back later once your account is reviewed.
          </p>
          <button
            onClick={() => logout()}
            className="flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md font-medium text-sm transition-colors cursor-pointer"
          >
            <LogOut className="size-4" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
