"use client";

import * as React from "react";
import { IconLoader2 } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FORM_HEADER_FALLBACKS } from "@/app/dashboard/leave-requests/form-header";
import {
updateLeaveFormHeaderAction,
type LeaveFormHeader,
} from "./leave-policy-actions";

interface FormHeaderSectionProps {
// What is stored in the database. A null field means "use the paper-form text".
header: LeaveFormHeader;
// Reloads the settings data after a successful save.
onChanged: () => Promise<void>;
}

// The seven fields, in the order they appear on the form.
const FIELDS: { key: keyof LeaveFormHeader; label: string; hint?: string }[] = [
{ key: "company_name", label: "Company name" },
{ key: "company_address", label: "Address" },
{ key: "company_phones", label: "Phones" },
{ key: "company_email", label: "Email", hint: 'Printed as "Email: ..." on the form, so enter only the address.' },
{ key: "signatory_name", label: "Signatory name" },
{ key: "signatory_title", label: "Signatory title" },
];

export function FormHeaderSection({ header, onChanged }: FormHeaderSectionProps) {
// Only what the person has typed and not saved yet. A field with no entry
// simply shows its saved value. After a save, the entries are cleared.
const [edits, setEdits] = React.useState<Partial<Record<keyof LeaveFormHeader, string>>>({});
const [isSaving, setIsSaving] = React.useState(false);

const baseline = (key: keyof LeaveFormHeader): string =>
	header[key] || FORM_HEADER_FALLBACKS[key];

const valueOf = (key: keyof LeaveFormHeader): string => edits[key] ?? baseline(key);

const isDirty = FIELDS.some(({ key }) => edits[key] !== undefined && edits[key] !== baseline(key));

const handleSave = async () => {
	const input = {} as LeaveFormHeader;
	for (const { key } of FIELDS) {
		const text = valueOf(key).trim();
		input[key] = text === FORM_HEADER_FALLBACKS[key] ? null : text;
	}

	setIsSaving(true);
	try {
		const res = await updateLeaveFormHeaderAction(input);
		if (!res.success) {
			toast.error(res.error || "Failed to save the form header.");
			return;
		}
		toast.success("Form header saved.");
		setEdits({});
		await onChanged();
	} catch (e) {
		toast.error(e instanceof Error ? e.message : "Failed to save the form header.");
	} finally {
		setIsSaving(false);
	}
};

return (
	<div className="space-y-5 border-b pb-8">
		<div className="flex items-center gap-2 text-foreground font-semibold text-lg pb-2">
			<h2>Leave Form Printed Header</h2>
		</div>
		<p className="text-xs text-muted-foreground -mt-3">
			This text appears at the top and bottom of the printed leave form. Clearing a field
			and saving restores the paper-form text.
		</p>

		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
			{FIELDS.map(({ key, label, hint }) => (
				<div
					key={key}
					// Address and company name are long, so they get the full width.
					className={`space-y-1.5 ${key === "company_name" || key === "company_address" ? "sm:col-span-2" : ""}`}
				>
					<Label htmlFor={`header-${key}`} className="text-sm font-medium text-foreground">
						{label}
					</Label>
					<Input
						id={`header-${key}`}
						value={valueOf(key)}
						maxLength={255}
						disabled={isSaving}
						onChange={(e) => setEdits((prev) => ({ ...prev, [key]: e.target.value }))}
						className="border-border"
					/>
					{hint && <p className="text-xs text-muted-foreground">{hint}</p>}
				</div>
			))}
		</div>

		{/* This is its own Save button. The page's "Save Changes" button does not
				save these fields. */}
		<div className="flex justify-end">
			<Button
				type="button"
				onClick={handleSave}
				disabled={isSaving || !isDirty}
				className="cursor-pointer"
			>
				{isSaving && <IconLoader2 className="h-4 w-4 animate-spin mr-2" />}
				Save Header
			</Button>
		</div>
	</div>
);
}