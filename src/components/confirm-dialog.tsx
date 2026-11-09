
"use client";

import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
Dialog,
DialogContent,
DialogDescription,
DialogFooter,
DialogHeader,
DialogTitle,
} from "@/components/ui/dialog";

type ConfirmVariant = "default" | "destructive" | "soft-destructive" | "soft-default";

interface ConfirmDialogProps {
open: boolean;
title: string;
description: string;
confirmLabel: string;
confirmVariant?: ConfirmVariant;
pending?: boolean;
onConfirm: () => void;
onOpenChange: (open: boolean) => void;
}

export function ConfirmDialog({
open,
title,
description,
confirmLabel,
confirmVariant = "default",
pending = false,
onConfirm,
onOpenChange,
}: ConfirmDialogProps) {
	const confirmButtonClassName = {
		default: "h-9 cursor-pointer px-4",
		"soft-default":
			"h-9 cursor-pointer border border-blue-200 bg-blue-100 px-4 text-blue-700 hover:bg-blue-200 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900",
		destructive:
			"h-9 cursor-pointer bg-destructive px-4 text-white hover:bg-destructive/90",
		"soft-destructive":
			"h-9 cursor-pointer border border-red-200 bg-red-100 px-4 text-red-700 hover:bg-red-200 dark:border-red-900 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900",
	}[confirmVariant];

return (
	<Dialog
		open={open}
		onOpenChange={(next) => !pending && onOpenChange(next)}
	>
		<DialogContent
			showCloseButton={false}
			className="gap-6 rounded-2xl p-6 sm:max-w-[480px]"
		>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				className="absolute top-4 right-4 cursor-pointer text-muted-foreground hover:bg-muted hover:text-foreground"
				disabled={pending}
				onClick={() => onOpenChange(false)}
			>
				<XIcon />
				<span className="sr-only">Close</span>
			</Button>

			<DialogHeader className="gap-3 pr-8">
				<DialogTitle className="text-xl font-semibold">
					{title}
				</DialogTitle>
				<DialogDescription className="text-base text-muted-foreground">
					{description}
				</DialogDescription>
			</DialogHeader>

			<DialogFooter className="-mx-6 -mb-6 border-t bg-muted/40 p-6">
				<Button
					type="button"
					variant="outline"
					className="h-9 cursor-pointer px-4"
					disabled={pending}
					onClick={() => onOpenChange(false)}
				>
					Cancel
				</Button>

				<Button
					type="button"
					className={confirmButtonClassName}
					disabled={pending}
					onClick={onConfirm}
				>
					{pending && <Spinner className="mr-1 size-3" />}
					{confirmLabel}
				</Button>
			</DialogFooter>
		</DialogContent>
	</Dialog>
);
}
