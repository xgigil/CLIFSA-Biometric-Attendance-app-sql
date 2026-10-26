"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { deletePendingApplicationAction } from "../apply-actions";
import { reviewLeaveRequestAction } from "../review-actions";
import { ConfirmDialog } from "@/components/confirm-dialog";

const LIST_PATH = "/dashboard/leave-requests";
const NOTE_MAX = 255;

type ConfirmKind = "approved" | "denied" | "delete";

interface ReviewPanelProps {
leaveId: number;
canDelete: boolean;
canReview: boolean;
}

export function ReviewPanel({ leaveId, canDelete, canReview }: ReviewPanelProps) {
const router = useRouter();
const [deleting, setDeleting] = React.useState(false);
const [reviewing, setReviewing] = React.useState(false);
const [note, setNote] = React.useState("");
const [confirmKind, setConfirmKind] = React.useState<ConfirmKind | null>(null);
const [shownKind, setShownKind] = React.useState<ConfirmKind>("approved");

const busy = deleting || reviewing;

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
			setConfirmKind(null);
		}
	} catch (err) {
		toast.error(err instanceof Error ? err.message : "An unexpected error occurred");
		setConfirmKind(null);
	} finally {
		setDeleting(false);
	}
};

const handleReview = async (decision: "approved" | "denied") => {
	if (!note.trim()) {
		toast.error("Review note is required.");
		return;
	}
	setReviewing(true);
	try {
		const res = await reviewLeaveRequestAction({
			leaveId,
			decision,
			review_note: note.trim(),
		});
		if (!res.success) {
			toast.error(res.error || "Failed to review application");
			return;
		}
		toast.success(decision === "approved" ? "Application approved" : "Application denied");
		if (res.balanceWarning) toast.warning(res.balanceWarning);
		setNote("");
		setConfirmKind(null);
		router.refresh();
	} catch (err) {
		toast.error(err instanceof Error ? err.message : "An unexpected error occurred");
	} finally {
		setReviewing(false);
	}
};

const openConfirm = (kind: ConfirmKind) => {
	if (kind !== "delete" && !note.trim()) {
		toast.error("Review note is required.");
		return;
	}
	setShownKind(kind);
	setConfirmKind(kind);
};

const confirmCopy = ({
	approved: {
		title: "Approve this request?",
		description:
			"Approving this request deducts these days from the employee's leave balance.",
		confirmLabel: "Approve request",
		confirmVariant: "default",
	},
	denied: {
		title: "Deny this request?",
		description:
			"The request will remain on file as denied. No leave days will be deducted from the employee's balance.",
		confirmLabel: "Deny request",
		confirmVariant: "destructive",
	},
	delete: {
		title: "Delete pending request?",
		description:
			"This will permanently remove the pending leave request. This action cannot be undone.",
		confirmLabel: "Delete request",
		confirmVariant: "soft-destructive",
	},
} as const)[shownKind];

return (
	<>
		<div className="rounded-lg border p-4 space-y-4">
			<div className="text-sm font-medium">Review</div>

			{canReview && (
				<div className="space-y-2">
					<label htmlFor="review-note" className="text-sm font-medium">
						Review note <span className="text-red-600">*</span>
					</label>
					<Textarea
						id="review-note"
						value={note}
						onChange={(e) => setNote(e.target.value)}
						maxLength={NOTE_MAX}
						rows={3}
						disabled={busy}
						placeholder="Enter your reason or comments before approving or denying..."
					/>
					<div className="flex items-start justify-between gap-3 text-[clamp(0.7rem,1.5vw,0.75rem)] text-muted-foreground">
						<span className="min-w-0">Required for approval or denial</span>
						<span className="shrink-0 tabular-nums">
								{note.length}/{NOTE_MAX}
						</span>
					</div>
				</div>
			)}

			<div className="flex flex-wrap items-center justify-between gap-2">
				<div>
					{canDelete && (
						<Button
							type="button"
							variant="outline"
							className="cursor-pointer"
							disabled={busy}
							onClick={() => openConfirm("delete")}
						>
							Delete
						</Button>
					)}
				</div>
				{canReview && (
					<div className="flex flex-wrap items-center gap-2">
						<Button
							type="button"
							className="cursor-pointer"
							disabled={busy}
							onClick={() => openConfirm("approved")}
						>
							Approve
						</Button>
						<Button
							type="button"
							variant="destructive"
							className="cursor-pointer"
							disabled={busy}
							onClick={() => openConfirm("denied")}
						>
							Deny
						</Button>
					</div>
				)}
			</div>
		</div>

		<ConfirmDialog
			open={confirmKind !== null}
			title={confirmCopy.title}
			description={confirmCopy.description}
			confirmLabel={confirmCopy.confirmLabel}
			confirmVariant={confirmCopy.confirmVariant}
			pending={busy}
			onOpenChange={(open) => {
				if (!open) setConfirmKind(null);
			}}
			onConfirm={() => {
				if (confirmKind === "delete") handleDelete();
				else if (confirmKind === "approved" || confirmKind === "denied") handleReview(confirmKind);
			}}
		/>
	</>
);
}