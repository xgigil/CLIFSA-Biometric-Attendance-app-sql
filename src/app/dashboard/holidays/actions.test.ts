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
    in: vi.fn().mockReturnThis(),
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

/**
 * Like makeChain, but `.in(column, values)` actually filters the rows, the way
 * the database would. This lets tests prove the code asks for the right
 * statuses: rows the query should exclude never reach the action.
 */
function makeFilterableChain(rows: any[], error: { message: string } | null = null) {
  let current = rows;
  const chain = makeChain({ data: rows, error: null });
  chain.in = vi.fn().mockImplementation((column: string, values: unknown[]) => {
    current = current.filter((r) => values.includes(r[column]));
    return chain;
  });
  chain.then = (resolve: any, reject?: any) =>
    Promise.resolve(
      error ? { data: null, error } : { data: current, error: null }
    ).then(resolve, reject);
  return chain;
}

type AdminTables = {
  company_holidays?: any[];
  employee_leaves?: any[];
  employees?: any[];
};

/** Mocks the admin client; returns spies and every chain created per table. */
function mockAdminClient(
  tables: AdminTables = {},
  errors: Partial<Record<keyof AdminTables, { message: string }>> = {}
) {
  const insertSpy = vi.fn().mockResolvedValue({ data: null, error: null });
  const chains: Record<string, any[]> = {};
  const fromSpy = vi.fn().mockImplementation((table: string) => {
    const c = makeFilterableChain(
      tables[table as keyof AdminTables] ?? [],
      errors[table as keyof AdminTables] ?? null
    );
    if (table === "company_holidays") c.insert = insertSpy;
    (chains[table] ||= []).push(c);
    return c;
  });
  vi.mocked(createAdminClient).mockResolvedValue({ from: fromSpy } as any);
  return { insertSpy, fromSpy, chains };
}

function leave(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 5,
    employee_id: 100,
    start_date: "2026-09-11",
    end_date: "2026-09-12",
    status: "approved",
    ...overrides,
  };
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

/** Session whose profiles.role is "hr" (Step 2: HR may write holidays). */
function mockHrSession(userId = "hr-1") {
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "profiles") {
        return makeChain({ data: { role: "hr" }, error: null });
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
    const { insertSpy, fromSpy } = mockAdminClient();

    const res = await setHolidayAction({
      start_date: "2026-09-28",
      end_date: "2026-09-28",
      note: "Independence Day",
    });
    expect(res).toEqual({
      success: false,
      // Updated (Step 2): gate is now Admin or HR
      error: "Unauthorized access. Admin or HR privileges required.",
    });
    expect(fromSpy).not.toHaveBeenCalled();
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("should return failure if a non-admin tries to remove a holiday", async () => {
    mockMemberSession();
    const res = await removeHolidayAction(1);
    expect(res).toEqual({
      success: false,
      // Updated (Step 2): gate is now Admin or HR
      error: "Unauthorized access. Admin or HR privileges required.",
    });
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
    const { insertSpy, chains } = mockAdminClient({
      company_holidays: [{ id: 1 }],
    });

    const res = await setHolidayAction({
      start_date: "2026-09-07",
      end_date: "2026-09-07",
      note: "Company Holiday",
    });
    expect(res).toEqual({
      success: false,
      error: "A company holiday already covers part of that range.",
    });
    expect(chains.employee_leaves).toBeUndefined(); // stops before the leave check
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("should return failure with the employee name, dates and status when an approved leave overlaps", async () => {
    mockAdminSession();
    const { insertSpy, chains } = mockAdminClient({
      employee_leaves: [leave({ status: "approved" })],
      employees: [{ employee_id: 100, employee_name: "Alice Reyes" }],
    });

    const res = await setHolidayAction({
      start_date: "2026-09-11",
      end_date: "2026-09-11",
      note: "Blocked",
    });

    expect(res).toEqual({
      success: false,
      error:
        "Cannot set holiday: conflicts with Alice Reyes leave 2026-09-11–2026-09-12 (approved).",
    });
    expect(chains.employee_leaves[0].in).toHaveBeenCalledWith("status", [
      "pending",
      "approved",
    ]);
    expect(chains.employees[0].in).toHaveBeenCalledWith("employee_id", [100]);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("should block the holiday when an employee has an overlapping pending leave", async () => {
    mockAdminSession();
    const { insertSpy } = mockAdminClient({
      employee_leaves: [leave({ id: 6, employee_id: 200, status: "pending" })],
      employees: [{ employee_id: 200, employee_name: "Bob Santos" }],
    });

    const res = await setHolidayAction({
      start_date: "2026-09-11",
      end_date: "2026-09-11",
      note: "Blocked",
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("Bob Santos");
    expect(res.error).toContain("2026-09-11–2026-09-12");
    expect(res.error).toContain("(pending)");
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("should allow the holiday when the only overlapping leaves are denied or cancelled", async () => {
    mockAdminSession("admin-1");
    const { insertSpy, chains } = mockAdminClient({
      employee_leaves: [
        leave({ id: 7, employee_id: 100, status: "denied" }),
        leave({ id: 8, employee_id: 200, status: "cancelled" }),
      ],
      employees: [
        { employee_id: 100, employee_name: "Alice Reyes" },
        { employee_id: 200, employee_name: "Bob Santos" },
      ],
    });

    const res = await setHolidayAction({
      start_date: "2026-09-11",
      end_date: "2026-09-11",
      note: "Founders Day",
    });

    expect(res).toEqual({ success: true });
    // Only pending/approved are requested, so denied/cancelled never count.
    expect(chains.employee_leaves[0].in).toHaveBeenCalledWith("status", [
      "pending",
      "approved",
    ]);
    expect(chains.employees).toBeUndefined(); // no conflicts, so no name lookup
    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        start_date: "2026-09-11",
        end_date: "2026-09-11",
        note: "Founders Day",
        created_by: "admin-1",
      })
    );
  });

  it("should only report blocking leaves when blocking and non-blocking leaves overlap", async () => {
    mockAdminSession();
    const { insertSpy } = mockAdminClient({
      employee_leaves: [
        leave({ id: 7, employee_id: 100, status: "denied" }),
        leave({ id: 8, employee_id: 200, status: "approved" }),
      ],
      employees: [
        { employee_id: 100, employee_name: "Alice Reyes" },
        { employee_id: 200, employee_name: "Bob Santos" },
      ],
    });

    const res = await setHolidayAction({
      start_date: "2026-09-11",
      end_date: "2026-09-11",
      note: "Blocked",
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("Bob Santos");
    expect(res.error).not.toContain("Alice Reyes");
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("should fall back to the employee number when no employee name is found", async () => {
    mockAdminSession();
    mockAdminClient({
      employee_leaves: [leave({ employee_id: 300 })],
      employees: [],
    });

    const res = await setHolidayAction({
      start_date: "2026-09-11",
      end_date: "2026-09-11",
      note: "Blocked",
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("Employee #300 leave 2026-09-11–2026-09-12");
  });

  it("should list at most five conflicts, sorted by name, and summarize the rest", async () => {
    mockAdminSession();
    const names = ["Frank", "Alice", "Carol", "Bob", "Erin", "Dave"];
    mockAdminClient({
      employee_leaves: names.map((_, i) =>
        leave({ id: i + 1, employee_id: 100 + i })
      ),
      employees: names.map((n, i) => ({
        employee_id: 100 + i,
        employee_name: n,
      })),
    });

    const res = await setHolidayAction({
      start_date: "2026-09-11",
      end_date: "2026-09-11",
      note: "Blocked",
    });

    expect(res.success).toBe(false);
    // Alphabetical: Alice, Bob, Carol, Dave, Erin are shown; Frank is the "1 more".
    expect(res.error).toContain("Alice");
    expect(res.error).toContain("Erin");
    expect(res.error).not.toContain("Frank");
    expect(res.error).toMatch(/and 1 more\.$/);
    expect(res.error!.indexOf("Alice")).toBeLessThan(res.error!.indexOf("Bob"));
  });

  it("should fail closed and not create the holiday if the leave conflict query errors", async () => {
    mockAdminSession();
    const { insertSpy } = mockAdminClient(
      {},
      { employee_leaves: { message: "Connection lost" } }
    );

    const res = await setHolidayAction({
      start_date: "2026-09-28",
      end_date: "2026-09-28",
      note: "Independence Day",
    });

    expect(res).toEqual({ success: false, error: "Connection lost" });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("should fail closed and not create the holiday if the holiday overlap query errors", async () => {
    mockAdminSession();
    const { insertSpy } = mockAdminClient(
      {},
      { company_holidays: { message: "Connection lost" } }
    );

    const res = await setHolidayAction({
      start_date: "2026-09-28",
      end_date: "2026-09-28",
      note: "Independence Day",
    });

    expect(res).toEqual({ success: false, error: "Connection lost" });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("should allow an HR user to set a holiday", async () => {
    mockHrSession("hr-1");
    const { insertSpy } = mockAdminClient();

    const res = await setHolidayAction({
      start_date: "2026-09-28",
      end_date: "2026-09-28",
      note: "Independence Day",
    });
    expect(res).toEqual({ success: true });
    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        start_date: "2026-09-28",
        end_date: "2026-09-28",
        note: "Independence Day",
        created_by: "hr-1",
      })
    );
  });

  it("should allow an HR user to remove a holiday", async () => {
    mockHrSession();
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

  it("should still apply holiday rules to HR (overlapping leave blocks the holiday)", async () => {
    mockHrSession();
    const { insertSpy } = mockAdminClient({
      employee_leaves: [leave({ status: "approved" })],
      employees: [{ employee_id: 100, employee_name: "Alice Reyes" }],
    });

    const res = await setHolidayAction({
      start_date: "2026-09-11",
      end_date: "2026-09-11",
      note: "Blocked",
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain("Alice Reyes");
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("should successfully create one company holiday record when an admin sets a holiday", async () => {
    mockAdminSession("admin-1");
    const { insertSpy } = mockAdminClient();

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
    // Simulate first admin already inserted: overlap check finds a row
    const { insertSpy } = mockAdminClient({ company_holidays: [{ id: 99 }] });

    const res = await setHolidayAction({
      start_date: "2026-09-28",
      end_date: "2026-09-28",
      note: "Independence Day",
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain("already covers part of that range");
    expect(insertSpy).not.toHaveBeenCalled();
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