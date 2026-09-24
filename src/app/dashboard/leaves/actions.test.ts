/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  setLeaveAction,
  setLeaveForAllAction,
  removeLeaveAction,
  getLeavesForRangedAction,
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
    then: undefined as any,
  };
  // Make chain awaitable for select queries
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
  const sessionClient = {
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
  };
  vi.mocked(createClient).mockResolvedValue(sessionClient as any);
  return sessionClient;
}

describe("leave actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.SESSION_SECRET = "test-session-secret-16";
  });

  it("should return failure if a non-admin tries to set leave", async () => {
    mockMemberSession();
    const insertSpy = vi.fn();
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockImplementation(() => {
        const c = makeChain({ data: [], error: null });
        c.insert = insertSpy.mockResolvedValue({ data: null, error: null });
        return c;
      }),
    } as any);

    const res = await setLeaveAction({
      employee_id: 100,
      start_date: "2026-09-21",
      end_date: "2026-09-22",
    });
    expect(res).toEqual({
      success: false,
      error: "Unauthorized access. Admin privileges required.",
    });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("should return failure if a non-admin tries to remove leave", async () => {
    mockMemberSession();
    const deleteSpy = vi.fn();
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockImplementation(() => {
        const c = makeChain();
        c.delete = deleteSpy.mockReturnThis();
        return c;
      }),
    } as any);

    const res = await removeLeaveAction(1);
    expect(res.success).toBe(false);
    expect(res.error).toContain("Unauthorized");
  });

  it("should return failure if holiday is used as a leave type", async () => {
    mockAdminSession();
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockReturnValue(makeChain()),
    } as any);

    const res = await setLeaveAction({
      employee_id: 100,
      start_date: "2026-09-21",
      end_date: "2026-09-21",
      leave_type: "holiday",
    });
    expect(res).toEqual({
      success: false,
      error:
        "Holiday is not a leave type. Use Set Holiday to create holidays.",
    });
  });

  it("should return failure if leave overlaps a company holiday", async () => {
    mockAdminSession();
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "company_holidays") {
          return makeChain({ data: [{ id: 1 }], error: null });
        }
        return makeChain({ data: [], error: null });
      }),
    } as any);

    const res = await setLeaveAction({
      employee_id: 100,
      start_date: "2026-09-07",
      end_date: "2026-09-07",
    });
    expect(res).toEqual({
      success: false,
      error: "Cannot set leave on a holiday.",
    });
  });

  it("should return failure if the employee already has overlapping leave", async () => {
    mockAdminSession();
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "company_holidays") {
          return makeChain({ data: [], error: null });
        }
        if (table === "employee_leaves") {
          return makeChain({ data: [{ id: 9 }], error: null });
        }
        return makeChain({ data: [], error: null });
      }),
    } as any);

    const res = await setLeaveAction({
      employee_id: 100,
      start_date: "2026-09-11",
      end_date: "2026-09-12",
    });
    expect(res).toEqual({
      success: false,
      error: "This employee already has a leave covering part of that range.",
    });
  });

  it("should successfully set leave when an admin provides a valid date range", async () => {
    mockAdminSession("admin-1");
    const insertSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockImplementation((table: string) => {
        const c = makeChain({ data: [], error: null });
        if (table === "employee_leaves") {
          c.insert = insertSpy;
        }
        return c;
      }),
    } as any);

    const res = await setLeaveAction({
      employee_id: 100,
      start_date: "2026-09-21",
      end_date: "2026-09-22",
      leave_type: "vacation",
    });
    expect(res.success).toBe(true);
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        employee_id: 100,
        start_date: "2026-09-21",
        end_date: "2026-09-22",
        leave_type: "vacation",
        status: "approved",
        created_by: "admin-1",
      })
    );
  });

  it("should return failure if the leave end date is before the start date", async () => {
    mockAdminSession();
    const res = await setLeaveAction({
      employee_id: 100,
      start_date: "2026-09-22",
      end_date: "2026-09-21",
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain("End date cannot be before start date");
  });

  it("should return failure if the leave date format is invalid", async () => {
    mockAdminSession();
    const res = await setLeaveAction({
      employee_id: 100,
      start_date: "09/21/2026",
      end_date: "2026-09-22",
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain("Invalid date range");
  });

  it("should set leave for all employees but skip anyone already on leave", async () => {
    mockAdminSession("admin-1");
    const inserts: any[] = [];
    let leaveOverlapChecks = 0;
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "employees") {
          return makeChain({
            data: [{ employee_id: 100 }, { employee_id: 200 }],
            error: null,
          });
        }
        if (table === "company_holidays") {
          return makeChain({ data: [], error: null });
        }
        if (table === "employee_leaves") {
          const c = makeChain({ data: [], error: null });
          c.then = (resolve: any, reject?: any) => {
            leaveOverlapChecks++;
            const data = leaveOverlapChecks === 1 ? [{ id: 1 }] : [];
            return Promise.resolve({ data, error: null }).then(resolve, reject);
          };
          c.insert = vi.fn().mockImplementation((row) => {
            inserts.push(row);
            return Promise.resolve({ data: null, error: null });
          });
          return c;
        }
        return makeChain();
      }),
    } as any);

    const res = await setLeaveForAllAction({
      start_date: "2026-09-21",
      end_date: "2026-09-22",
    });
    expect(res.success).toBe(true);
    expect(res).toMatchObject({ created: 1, skipped: 1 });
    expect(inserts).toHaveLength(1);
    expect(inserts[0].employee_id).toBe(200);
  });

  it("should return failure if leave for all employees overlaps a holiday", async () => {
    mockAdminSession();
    const insertSpy = vi.fn();
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "employees") {
          return makeChain({ data: [{ employee_id: 200 }], error: null });
        }
        if (table === "company_holidays") {
          return makeChain({ data: [{ id: 1 }], error: null });
        }
        const c = makeChain();
        c.insert = insertSpy;
        return c;
      }),
    } as any);

    const res = await setLeaveForAllAction({
      start_date: "2026-09-07",
      end_date: "2026-09-07",
    });
    expect(res).toEqual({
      success: false,
      error: "Cannot set leave on a holiday.",
    });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("should successfully remove leave when requested by an admin", async () => {
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

    const res = await removeLeaveAction(42);
    expect(res.success).toBe(true);
    expect(eqSpy).toHaveBeenCalledWith("id", 42);
  });

  it("should allow an admin role to set leave even if approval status is not checked", async () => {
    // Document current weaker check vs Postgres is_admin()
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "pending-admin" } },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation(() =>
        makeChain({ data: { role: "admin" }, error: null })
      ),
    } as any);
    const insertSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockImplementation(() => {
        const c = makeChain({ data: [], error: null });
        c.insert = insertSpy;
        return c;
      }),
    } as any);

    const res = await setLeaveAction({
      employee_id: 100,
      start_date: "2026-09-28",
      end_date: "2026-09-28",
    });
    expect(res.success).toBe(true);
  });

  it("should return all employees' leave records when no employee is specified", async () => {
    const leaves = [
      { id: 1, employee_id: 100, start_date: "2026-09-10", end_date: "2026-09-11" },
      { id: 2, employee_id: 200, start_date: "2026-09-12", end_date: "2026-09-12" },
    ];
    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn().mockImplementation(() =>
        makeChain({ data: leaves, error: null })
      ),
    } as any);

    const res = await getLeavesForRangedAction("2026-09-01", "2026-09-30");
    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(2);
  });

  it("should deny a non-admin leave write before any database insert happens", async () => {
    mockMemberSession();
    const fromSpy = vi.fn();
    vi.mocked(createAdminClient).mockResolvedValue({
      from: fromSpy,
    } as any);

    await setLeaveAction({
      employee_id: 100,
      start_date: "2026-09-21",
      end_date: "2026-09-21",
    });
    expect(fromSpy).not.toHaveBeenCalled();
  });
});
