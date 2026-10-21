import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdminOrHrRole } from "@/app/dashboard/attendance/roles";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getLeaveApplicationDetailAction } from "../read-actions";
import { DetailActions } from "./delete-button";
import {
  formatShortDate,
  formatFormDate,
  formatWeekday,
  formatDays,
  type ApplicationDetail,
} from "../format";

const LIST_PATH = "/dashboard/leave-requests";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{children || "-"}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  if (status === "pending")
    return (
      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-300">
        {label}
      </Badge>
    );
  if (status === "approved")
    return (
      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300">
        {label}
      </Badge>
    );
  return <Badge variant="secondary">{label}</Badge>;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LeaveApplicationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const leaveId = parseInt(id, 10);

  const res = await getLeaveApplicationDetailAction(leaveId);
  if (!res.success || !res.data) {
    return (
      <div className="w-full my-6 px-6 space-y-3">
        <p className="text-sm text-red-500">{res.error || "Application not found."}</p>
        <Link href={LIST_PATH} className="text-sm underline">
          Back to applications
        </Link>
      </div>
    );
  }

  const { leave, application, days } = res.data as ApplicationDetail;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id || "")
    .maybeSingle();
  const isManager = isAdminOrHrRole(profile?.role);

  const canDelete = isManager && leave.status === "pending";

  return (
    <div className="w-full my-6 px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Leave Request #{leave.id}</h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <StatusBadge status={leave.status} />
              <span>Filed {formatShortDate(application.date_filed)}</span>
            </div>
          </div>
          <DetailActions leaveId={leave.id} canDelete={canDelete} />
        </div>

        <div className="grid grid-cols-1 gap-4 rounded-lg border p-4 sm:grid-cols-2">
          <Field label="Name">{application.applicant_name}</Field>
          <Field label="Type of leave">{leave.leave_type_name}</Field>
          <Field label="Position">{application.position}</Field>
          <Field label="Department / Section">{application.department}</Field>
          <Field label="From">{formatFormDate(leave.start_date)}</Field>
          <Field label="To">{formatFormDate(leave.end_date)}</Field>
          <div className="sm:col-span-2">
            <Field label="Reason(s)">{leave.note}</Field>
          </div>
        </div>

        <div className="rounded-lg border p-4 space-y-3">
          <div className="text-sm font-medium">Personal action (as filed)</div>
          <div className="grid grid-cols-4 gap-3 text-center">
            <div>
              <div className="text-xs text-muted-foreground">Beginning balance</div>
              <div className="font-medium">{formatDays(application.beginning_balance)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Leave taken</div>
              <div className="font-medium">{formatDays(application.leave_taken)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Allowable leave</div>
              <div className="font-medium">{formatDays(application.allowable_leave)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total # of days</div>
              <div className="font-medium">{formatDays(application.leave_taken)}</div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            These figures are a snapshot taken when the form was filed.
          </p>
        </div>

        <div className="rounded-lg border p-4 space-y-2">
          <div className="text-sm font-medium">Counted leave days</div>
          {days.length === 0 ? (
            <p className="text-sm text-muted-foreground">No counted leave days.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              {days.map((d) => (
                <div key={d.leave_date} className="flex justify-between rounded border px-2 py-1">
                  <span>
                    {formatWeekday(d.leave_date)} {d.leave_date.substring(5)}
                  </span>
                  <span className="text-muted-foreground">
                    {d.day_value === 0.5 ? "half day" : "1"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {leave.reviewed_at && (
          <div className="rounded-lg border p-4 text-sm">
            Reviewed {formatShortDate(leave.reviewed_at)}
            {leave.review_note ? `: ${leave.review_note}` : ""}
          </div>
        )}
      </div>
    </div>
  );
}