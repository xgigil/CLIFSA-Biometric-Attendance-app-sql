export type ApplicationDetail = {
	leave: {
		id: number; 
		employee_id: number;
		start_date: string;
		end_date: string;
		leave_type_name: string;
		note: string;
		status: string;
		created_at: string;
		reviewed_at: string | null;
		review_note: string | null;
	};

	application: {
		applicant_name: string;
		date_filed: string;
		position: string | null;
		department: string | null;
		beginning_balance: number;
		leave_taken: number;
		allowable_leave: number;
	};

	days: {
		leave_date: string;
		day_value: number;
	} [];

	settings: {
		company_name: string | null;
    company_address: string | null;
    company_phones: string | null;
    company_email: string | null;
    form_title: string | null;
    signatory_name: string | null;
    signatory_title: string | null;
	} | null;
};

function toLocalDate(value: string): Date | null {
  const [y, m, d] = value.substring(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0);
}

export function formatShortDate(value?: string | null): string {
  if (!value) return "";
  const date = toLocalDate(value);
  if (!date) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatFormDate(value?: string | null): string {
  if (!value) return "";
  const date = toLocalDate(value);
  if (!date) return value;
  return date
    .toLocaleDateString("en-US", { month: "long", day: "2-digit", year: "numeric" })
    .toUpperCase();
}

export function formatWeekday(value: string): string {
  const date = toLocalDate(value);
  return date ? date.toLocaleDateString("en-US", { weekday: "short" }) : "";
}

export function formatDays(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

