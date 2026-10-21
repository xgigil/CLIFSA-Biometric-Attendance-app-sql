"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { deletePendingApplicationAction } from "../apply-actions";

const LIST_PATH = "/dashboard/leave-requests";

interface DetailActionsProps {
  leaveId: number;
  canDelete: boolean;
}

export function DetailActions({ leaveId, canDelete }: DetailActionsProps) {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await deletePendingApplicationAction(leaveId);
      if (res.success) {
        toast.success("Application deleted");
        router.push(LIST_PATH);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to delete application");
        setConfirming(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An unexpected error occurred");
      setConfirming(false);
    } finally {
      setDeleting(false);
    }
  };

  // While confirming, only the delete prompt is shown.
  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-rose-600">
          Delete this pending application?
        </span>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={deleting}
          onClick={handleDelete}
        >
          {deleting && <Spinner className="size-3 mr-1" />} Confirm
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={deleting}
          onClick={() => setConfirming(false)}
        >
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" asChild>
        <Link href={LIST_PATH}>Back to list</Link>
      </Button>
      <Button asChild>
        <Link href={`${LIST_PATH}/${leaveId}/print`}>Print</Link>
      </Button>
      {canDelete && (
        <Button type="button" variant="outline" onClick={() => setConfirming(true)}>
          Delete
        </Button>
      )}
    </div>
  );
}