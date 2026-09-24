/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkIsAdmin } from "./admin";
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
