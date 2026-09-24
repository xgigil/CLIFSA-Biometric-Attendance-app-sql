"use client";

import { logout } from "@/app/(login)/actions";
import { ShieldAlert, LogOut } from "lucide-react";

export default function RejectedPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="bg-card text-card-foreground border rounded-lg p-8 shadow-sm flex flex-col items-center text-center gap-6">
          <h1 className="text-2xl font-bold tracking-tight text-destructive">Access Declined</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Your registration request has been declined by the system administrators.
            If you believe this is an error or need further assistance, please contact support.
          </p>
          <button
            onClick={() => logout()}
            className="flex items-center justify-center gap-2 bg-destructive text-primary-foreground hover:bg-destructive/80 px-4 py-2 rounded-md font-medium text-sm transition-colors cursor-pointer"
          >
            <LogOut className="size-4" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
