"use server";

import { createClient } from "@/lib/supabase/server";
import { checkIsAdminOrHr } from "../../attendance/admin";
import { revalidatePath } from "next/cache"

export type LeavePool = {
	id: number;
	pool_name: string;
	annual_allotment: number;
};

export type LeaveTypePolicy = {
	id: number;
	name: string;
	pool_id: number;
	is_active: boolean;
};

export type LeaveFormHeader = {
	company_name: string | null;
	company_address: string | null;
	company_phones: string | null;
	company_email: string | null;
	form_title: string | null;
	signatory_name: string | null;
	signatory_title: string | null;
};

const HEADER_COLUMNS = [
	"company_name",
	"company_address",
	"company_phones",
	"company_email",
	"form_title",
	"signatory_name",
	"signatory_title",
] as const;

function revalidateLeavePolicyPaths() {
	revalidatePath("/dashboard");
  revalidatePath("/dashboard/leave-requests/new");
  revalidatePath("/dashboard/leave-requests", "layout");
}

type Db = Awaited<ReturnType<typeof createClient>>;

const FORBIDDEN_ERROR = "Forbidden: Only approved Admin or HR can edit leave rules.";

async function validateTypeInput(db: Db, rawName: string, rawPoolId: number)
: Promise<{ error: string } | { name: string; poolId: number }> {
	const name = typeof rawName === "string" ? rawName.trim() : "";
  if (!name) return { error: "Leave type name is required." };
  if (name.length > 64) return { error: "Leave type name must be 64 characters or less." };

	const poolId = Number(rawPoolId);
	if (!Number.isInteger(poolId) || poolId <= 0) return { error: "Leave pool not found." };

	const { data: pool, error } = await db
		.from("leave_balance_pools")
		.select("id")
		.eq("id", poolId)
		.maybeSingle();
	if (error) return { error: error.message };
	if (!pool) return { error: "Leave pool not found." };

	return { name, poolId };
}

function friendlyTypeError(message: string): string {
  return /Duplicate entry/i.test(message)
    ? "A leave type with that name already exists."
    : message;
}

const DEACTIVATE_INSTEAD =
  "This leave type is used by existing leaves. Deactivate it instead.";

// Admin/HR only. Loads everything the Leave Rules and Leave Form Header
// sections need, in one trip: pools, leave types, and the form header.
export async function getLeavePolicySettingsAction() {
	try {
		const db = await createClient();

		if (!(await checkIsAdminOrHr(db))) {
			return {
				success: false as const, error: FORBIDDEN_ERROR
			};
		}

		const [poolsRes, typesRes, headerRes] = await Promise.all([
			db.from("leave_balance_pools")
				.select("id, pool_name, annual_allotment")
				.order("id", { ascending: true }),
			
			db.from("leave_type_policies")
				.select("id, name, pool_id, is_active")
				.order("name", { ascending: true }),

			db.from("system_settings")
				.select(HEADER_COLUMNS.join(", "))
				.eq("id", 1)
				.maybeSingle(),
		]);

		if (poolsRes.error) return { success: false as const, error: poolsRes.error.message };
    if (typesRes.error) return { success: false as const, error: typesRes.error.message };
    if (headerRes.error) return { success: false as const, error: headerRes.error.message };

		// convert DECIMAL columns to numbers
		const pools: LeavePool[] = (
      (poolsRes.data || []) as {
        id: number | string;
        pool_name: string;
        annual_allotment: number | string;
      }[]
    ).map((p) => ({
      id: Number(p.id),
      pool_name: p.pool_name,
      annual_allotment: Number(p.annual_allotment),
    }));

		// convert BOOLEAN columns to booleans
		const types: LeaveTypePolicy[] = (
      (typesRes.data || []) as {
        id: number | string;
        name: string;
        pool_id: number | string;
        is_active: number | string | boolean;
      }[]
    ).map((t) => ({
      id: Number(t.id),
      name: t.name,
      pool_id: Number(t.pool_id),
      is_active: Boolean(Number(t.is_active)),
    }));

		// If the settings row is missing, every header field comes back as null.
		const row = (headerRes.data || {}) as Partial<Record<(typeof HEADER_COLUMNS)[number], string | null>>;
    const header: LeaveFormHeader = {
      company_name: row.company_name ?? null,
      company_address: row.company_address ?? null,
      company_phones: row.company_phones ?? null,
      company_email: row.company_email ?? null,
      form_title: row.form_title ?? null,
      signatory_name: row.signatory_name ?? null,
      signatory_title: row.signatory_title ?? null,
    };

    return { success: true as const, data: { pools, types, header } };

	} catch (err: unknown) {
		return { 
			success: false as const, error: err instanceof Error ? err.message : "An unknown error occurred."
		 };
	}
}

// Admin/HR only. Changes how many days a pool grants per year. Only the allotment can change here.
export async function updatePoolAllotmentAction(
  poolId: number,
  annualAllotment: number
) {
  try {
    const db = await createClient();

    if (!(await checkIsAdminOrHr(db))) {
      return {
        success: false as const, error: FORBIDDEN_ERROR,
      };
    }

    // The id must be a real positive whole number.
    const id = Number(poolId);
    if (!Number.isInteger(id) || id <= 0) {
      return { success: false as const, error: "Leave pool not found." };
    }

		// Validate the allotment.
		const value = annualAllotment;
    const tenths = typeof value === "number" ? value * 10 : NaN;
    const isValid =
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= 9999.9 &&
      Math.abs(tenths - Math.round(tenths)) < 1e-9;
    if (!isValid) {
      return {
        success: false as const,
        error: "Annual allotment must be from 0 to 9999.9, with at most one decimal place.",
      };
    }

		// Makes sure that a pool exists, so a wrong id gets a clear message instead of a silent "0 rows changed" error.
    const { data: pool, error: lookupError } = await db
      .from("leave_balance_pools")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (lookupError) return { success: false as const, error: lookupError.message };
    if (!pool) return { success: false as const, error: "Leave pool not found." };

		// Round to one decimal so a value like 14.500000000001 is stored cleanly.
    const { error } = await db
      .from("leave_balance_pools")
      .update({ annual_allotment: Math.round(tenths) / 10 })
      .eq("id", id);
    if (error) return { success: false as const, error: error.message };

    revalidateLeavePolicyPaths();
    return { success: true as const };
  } catch (err: unknown) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Failed to update the annual allotment.",
    };
  }
}

// Admin/HR only. Adds a new leave type.
export async function addLeaveTypeAction(name: string, poolId: number) {
	try {
		const db = await createClient();
		if (!(await checkIsAdminOrHr(db))) {
			return {
				success: false as const, error: FORBIDDEN_ERROR
			};
		}

		const input = await validateTypeInput(db, name, poolId);
    if ("error" in input) return { success: false as const, error: input.error };

    const { error } = await db
      .from("leave_type_policies")
      .insert({ name: input.name, pool_id: input.poolId, is_active: 1 });
    if (error) return { success: false as const, error: friendlyTypeError(error.message) };

    revalidateLeavePolicyPaths();
    return { success: true as const };
	} catch (err: unknown) {
		return {
			success: false as const, error: err instanceof Error ? err.message : "Failed to add the leave type."
		};
	}
}

// Admin/HR only. Renames a leave type and/or moves it to another pool.
// A pool move changes balances: approved days of this type are charged to
// the new pool on the next read. Filed forms keep their old snapshots.
export async function updateLeaveTypeAction(
  id: number,
  changes: { name: string; poolId: number }
) {
  try {
    const db = await createClient();
    if (!(await checkIsAdminOrHr(db))) {
      return { success: false as const, error: FORBIDDEN_ERROR };
    }

    const typeId = Number(id);
    if (!Number.isInteger(typeId) || typeId <= 0) {
      return { success: false as const, error: "Leave type not found." };
    }

    const input = await validateTypeInput(db, changes?.name, changes?.poolId);
    if ("error" in input) return { success: false as const, error: input.error };

    const { data: current, error: lookupError } = await db
      .from("leave_type_policies")
      .select("id")
      .eq("id", typeId)
      .maybeSingle();
    if (lookupError) return { success: false as const, error: lookupError.message };
    if (!current) return { success: false as const, error: "Leave type not found." };

    const { error } = await db
      .from("leave_type_policies")
      .update({ name: input.name, pool_id: input.poolId })
      .eq("id", typeId);
    if (error) return { success: false as const, error: friendlyTypeError(error.message) };

    revalidateLeavePolicyPaths();
    return { success: true as const };
  } catch (err: unknown) {
    return {
      success: false as const,
      error: friendlyTypeError(err instanceof Error ? err.message : "Failed to update the leave type."),
    };
  }
}

// Admin/HR only. Turns a leave type off or back on.
// Deactivating is always allowed, even when leaves use the type:
// no day rows are deleted, the type just drops off the apply form and Set
// Leave, and its approved days still count toward the pool.
export async function setLeaveTypeActiveAction(id: number, isActive: boolean) {
  try {
    const db = await createClient();
    if (!(await checkIsAdminOrHr(db))) {
      return { success: false as const, error: FORBIDDEN_ERROR };
    }

    const typeId = Number(id);
    if (!Number.isInteger(typeId) || typeId <= 0) {
      return { success: false as const, error: "Leave type not found." };
    }

    const { data: current, error: lookupError } = await db
      .from("leave_type_policies")
      .select("id")
      .eq("id", typeId)
      .maybeSingle();
    if (lookupError) return { success: false as const, error: lookupError.message };
    if (!current) return { success: false as const, error: "Leave type not found." };

    const { error } = await db
      .from("leave_type_policies")
      .update({ is_active: isActive ? 1 : 0 })
      .eq("id", typeId);
    if (error) return { success: false as const, error: error.message };

    revalidateLeavePolicyPaths();
    return { success: true as const };
  } catch (err: unknown) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Failed to update the leave type.",
    };
  }
}

// Admin/HR only. Permanently deletes a leave type, but only when no leave has
// ever used it. Otherwise the person is told to deactivate it instead, so old
// leaves keep a valid reference and their days keep counting.
export async function deleteLeaveTypeAction(id: number) {
  try {
    const db = await createClient();
    if (!(await checkIsAdminOrHr(db))) {
      return { success: false as const, error: FORBIDDEN_ERROR };
    }

    const typeId = Number(id);
    if (!Number.isInteger(typeId) || typeId <= 0) {
      return { success: false as const, error: "Leave type not found." };
    }

    const { data: current, error: lookupError } = await db
      .from("leave_type_policies")
      .select("id")
      .eq("id", typeId)
      .maybeSingle();
    if (lookupError) return { success: false as const, error: lookupError.message };
    if (!current) return { success: false as const, error: "Leave type not found." };

    const { data: usedBy, error: usedError } = await db
      .from("employee_leaves")
      .select("id")
      .eq("leave_type_id", typeId);
    if (usedError) return { success: false as const, error: usedError.message };
    if (usedBy && usedBy.length > 0) {
      return { success: false as const, error: DEACTIVATE_INSTEAD };
    }

    const { error } = await db.from("leave_type_policies").delete().eq("id", typeId);
    if (error) {
      if (/foreign key constraint fails/i.test(error.message)) {
        return { success: false as const, error: DEACTIVATE_INSTEAD };
      }
      return { success: false as const, error: error.message };
    }

    revalidateLeavePolicyPaths();
    return { success: true as const };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete the leave type.";
    return {
      success: false as const,
      error: /foreign key constraint fails/i.test(message) ? DEACTIVATE_INSTEAD : message,
    };
  }
}

// Admin/HR only. Saves the form header text. A blank field makes the printed
// form use its default text. If any field is too long, nothing is saved.
export async function updateLeaveFormHeaderAction(input: LeaveFormHeader) {
  try {
    const db = await createClient();
    if (!(await checkIsAdminOrHr(db))) {
      return { success: false as const, error: FORBIDDEN_ERROR };
    }

    const payload: Record<string, string | null> = {};
    for (const column of HEADER_COLUMNS) {
      const raw = input?.[column];
      const value = typeof raw === "string" ? raw.trim() : "";
      if (value.length > 255) {
        return {
          success: false as const,
          error: "Each form header field must be 255 characters or less.",
        };
      }
      payload[column] = value === "" ? null : value;
    }

    const { data: row, error: lookupError } = await db
      .from("system_settings")
      .select("id")
      .eq("id", 1)
      .maybeSingle();
    if (lookupError) return { success: false as const, error: lookupError.message };
    if (!row) return { success: false as const, error: "Form settings were not found." };

    const { error } = await db.from("system_settings").update(payload).eq("id", 1);
    if (error) return { success: false as const, error: error.message };

    revalidateLeavePolicyPaths();
    return { success: true as const };
  } catch (err: unknown) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Failed to save the form header.",
    };
  }
}