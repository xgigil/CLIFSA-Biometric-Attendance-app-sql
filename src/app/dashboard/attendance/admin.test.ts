/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkIsAdmin, checkIsAdminOrHr } from "./admin";
import { validDateRange, RANGE_ERRORS } from "./date-range";
import { updateSystemSettingsAction } from "@/app/dashboard/settings/actions";
import { createClient } from "@/lib/supabase/server";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: vi.fn().mockReturnValue([]),
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}));

/**
 * Builds a fake Supabase client.
 * - user: what auth.getUser() returns (null = signed out)
 * - profile: what profiles.select("role").eq(...).single() returns as `data`
 */
function makeDb(
  user: { id: string } | null,
  profile: { role: string | null } | null
) {
  const single = vi.fn().mockResolvedValue({ data: profile, error: null });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  const db = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
    from,
  } as any;

  return { db, from, select, eq, single };
}

describe("admin helpers and settings permissions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should treat a signed-out user as not an admin", async () => {
    const db = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
      from: vi.fn(),
    } as any;
    expect(await checkIsAdmin(db)).toBe(false);
    expect(db.from).not.toHaveBeenCalled();
  });

  it("should return failure if a non-admin tries to update system settings", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "member-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation(() => {
        const chain: any = {
          select: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { role: "member", status: "approved" },
            error: null,
          }),
        };
        return chain;
      }),
    } as any);

    const res = await updateSystemSettingsAction("09:00", 15);
    expect(res.success).toBe(false);
    expect(res.error).toContain("Forbidden");
  });

  it("should return failure for invalid date ranges and accept a valid range", () => {
    expect(validDateRange("2026-09-22", "2026-09-21")).toBe(
      RANGE_ERRORS.endBeforeStart
    );
    expect(validDateRange("09/21/2026", "2026-09-22")).toBe(
      RANGE_ERRORS.invalidDate
    );
    expect(validDateRange("2026-09-21", "2026-09-22")).toBeNull();
  });
});

describe("role checks: checkIsAdmin vs checkIsAdminOrHr", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("admin → both checks true", async () => {
    const { db } = makeDb({ id: "admin-1" }, { role: "admin" });
    expect(await checkIsAdmin(db)).toBe(true);

    const { db: db2 } = makeDb({ id: "admin-1" }, { role: "admin" });
    expect(await checkIsAdminOrHr(db2)).toBe(true);
  });

  it("hr → checkIsAdmin false, checkIsAdminOrHr true", async () => {
    const { db } = makeDb({ id: "hr-1" }, { role: "hr" });
    expect(await checkIsAdmin(db)).toBe(false);

    const { db: db2 } = makeDb({ id: "hr-1" }, { role: "hr" });
    expect(await checkIsAdminOrHr(db2)).toBe(true);
  });

  it("member → both checks false", async () => {
    const { db } = makeDb({ id: "member-1" }, { role: "member" });
    expect(await checkIsAdmin(db)).toBe(false);

    const { db: db2 } = makeDb({ id: "member-1" }, { role: "member" });
    expect(await checkIsAdminOrHr(db2)).toBe(false);
  });

  it("missing user → both checks false and no profile lookup", async () => {
    const a = makeDb(null, null);
    expect(await checkIsAdmin(a.db)).toBe(false);
    expect(a.from).not.toHaveBeenCalled();

    const b = makeDb(null, null);
    expect(await checkIsAdminOrHr(b.db)).toBe(false);
    expect(b.from).not.toHaveBeenCalled();
  });

  it("null profile → both checks false", async () => {
    const { db } = makeDb({ id: "ghost-1" }, null);
    expect(await checkIsAdmin(db)).toBe(false);

    const { db: db2 } = makeDb({ id: "ghost-1" }, null);
    expect(await checkIsAdminOrHr(db2)).toBe(false);
  });

  it("looks up the role from the profiles table by user id", async () => {
    const { db, from, select, eq } = makeDb({ id: "hr-1" }, { role: "hr" });
    await checkIsAdminOrHr(db);
    expect(from).toHaveBeenCalledWith("profiles");
    expect(select).toHaveBeenCalledWith("role");
    expect(eq).toHaveBeenCalledWith("id", "hr-1");
  });
});