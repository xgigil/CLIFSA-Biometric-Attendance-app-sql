/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  setHolidayAction,
  removeHolidayAction,
  getHolidaysForRangeAction,
} from "./actions";
import { createClient, createAdminClient } from "@/lib/supabase/server";

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

type TableResult = { data: any; error: any };

function makeChain(result: TableResult = { data: [], error: null }) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue(result),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  chain.then = (resolve: any, reject?: any) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

function mockMemberSession() {
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "member-1" } },
        error: null,
      }),
    },
    from: vi.fn().mockImplementation(() =>
      makeChain({ data: { role: "member" }, error: null })
    ),
  } as any);
}

function mockAdminSession(userId = "admin-1") {
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "profiles") {
        return makeChain({ data: { role: "admin" }, error: null });
      }
      return makeChain({ data: [], error: null });
    }),
  } as any);
}

describe("holiday actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.SESSION_SECRET = "test-session-secret-16";
  });

  it("should return failure if a non-admin tries to set a holiday", async () => {
    mockMemberSession();
    const insertSpy = vi.fn();
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockImplementation(() => {
        const c = makeChain();
        c.insert = insertSpy;
        return c;
      }),
    } as any);

    const res = await setHolidayAction({
      start_date: "2026-09-28",
      end_date: "2026-09-28",
      note: "Independence Day",
    });
    expect(res).toEqual({
      success: false,
      error: "Unauthorized access. Admin privileges required.",
    });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("should return failure if a non-admin tries to remove a holiday", async () => {
    mockMemberSession();
    const res = await removeHolidayAction(1);
    expect(res.success).toBe(false);
    expect(res.error).toContain("Unauthorized");
  });

  it("should return failure if the holiday end date is before the start date", async () => {
    mockAdminSession();
    const res = await setHolidayAction({
      start_date: "2026-09-29",
      end_date: "2026-09-28",
      note: "X",
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain("End date cannot be before start date");
  });

  it("should return failure if the holiday date format is invalid", async () => {
    mockAdminSession();
    const res = await setHolidayAction({
      start_date: "28-09-2026",
      end_date: "2026-09-28",
      note: "X",
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain("Invalid date range");
  });

  it("should return failure if the holiday note is blank", async () => {
    mockAdminSession();
    const res = await setHolidayAction({
      start_date: "2026-09-28",
      end_date: "2026-09-28",
      note: "   ",
    });
    expect(res).toEqual({
      success: false,
      error: "Note is required to identify this holiday.",
    });
  });

  it("should return failure if a holiday already covers that date range", async () => {
    mockAdminSession();
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "company_holidays") {
          return makeChain({ data: [{ id: 1 }], error: null });
        }
        return makeChain({ data: [], error: null });
      }),
    } as any);

    const res = await setHolidayAction({
      start_date: "2026-09-07",
      end_date: "2026-09-07",
      note: "Company Holiday",
    });
    expect(res).toEqual({
      success: false,
      error: "A company holiday already covers part of that range.",
    });
  });

  it("should return failure if setting a holiday overlaps an employee's approved leave", async () => {
    mockAdminSession();
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "company_holidays") {
          return makeChain({ data: [], error: null });
        }
        if (table === "employee_leaves") {
          return makeChain({ data: [{ id: 5 }], error: null });
        }
        return makeChain();
      }),
    } as any);

    const res = await setHolidayAction({
      start_date: "2026-09-11",
      end_date: "2026-09-11",
      note: "Blocked",
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain("already have approved leave");
  });

  it("should successfully create one company holiday record when an admin sets a holiday", async () => {
    mockAdminSession("admin-1");
    const insertSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockImplementation((table: string) => {
        const c = makeChain({ data: [], error: null });
        if (table === "company_holidays") {
          c.insert = insertSpy;
        }
        return c;
      }),
    } as any);

    const res = await setHolidayAction({
      start_date: "2026-09-28",
      end_date: "2026-09-28",
      note: "Independence Day",
    });
    expect(res.success).toBe(true);
    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        start_date: "2026-09-28",
        end_date: "2026-09-28",
        note: "Independence Day",
        created_by: "admin-1",
      })
    );
  });

  it("should successfully remove a holiday when requested by an admin", async () => {
    mockAdminSession();
    const eqSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockImplementation(() => {
        const c = makeChain();
        c.delete = vi.fn().mockReturnThis();
        c.eq = eqSpy;
        return c;
      }),
    } as any);

    const res = await removeHolidayAction(7);
    expect(res.success).toBe(true);
    expect(eqSpy).toHaveBeenCalledWith("id", 7);
  });

  it("should return failure if the holiday id is invalid", async () => {
    const res = await removeHolidayAction(0);
    expect(res).toEqual({
      success: false,
      error: "Invalid holiday id.",
    });
  });

  it("should return failure if a second admin tries to set the same holiday range", async () => {
    mockAdminSession("admin-2");
    // Simulate first admin already inserted — overlap check finds a row
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "company_holidays") {
          return makeChain({ data: [{ id: 99 }], error: null });
        }
        return makeChain({ data: [], error: null });
      }),
    } as any);

    const res = await setHolidayAction({
      start_date: "2026-09-28",
      end_date: "2026-09-28",
      note: "Independence Day",
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain("already covers part of that range");
  });

  it("should allow any signed-in user to read company holidays for a date range", async () => {
    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn().mockImplementation(() =>
        makeChain({
          data: [
            {
              id: 1,
              start_date: "2026-09-07",
              end_date: "2026-09-07",
              note: "Company Holiday",
            },
          ],
          error: null,
        })
      ),
    } as any);

    const res = await getHolidaysForRangeAction("2026-09-01", "2026-09-30");
    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(1);
  });
});
