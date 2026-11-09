/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  setLeaveAction,
  setLeaveForAllAction,
  removeLeaveAction,
  getLeavesForRangedAction,
} from "./actions";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getPool } from "@/lib/db";

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

vi.mock("@/lib/db", () => ({
  getPool: vi.fn(),
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
    then: undefined as any,
  };
  chain.then = (resolve: any, reject?: any) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

/**
 * Mocks the MySQL pool used by insertLeaveWithDayRows.
 * First query = INSERT INTO employee_leaves (returns insertId),
 * subsequent queries = INSERT INTO employee_leave_days.
 */
function mockPoolTransaction(insertId = 42) {
  const query = vi
    .fn()
    .mockResolvedValueOnce([{ insertId }, undefined]) // leave insert
    .mockResolvedValue([{}, undefined]); // day rows (if any)
  const conn = {
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    release: vi.fn(),
    query,
  };
  const getConnection = vi.fn().mockResolvedValue(conn);
  vi.mocked(getPool).mockReturnValue({ getConnection } as any);
  return { conn, query, getConnection };
}

function sqlOf(query: ReturnType<typeof vi.fn>, callIndex: number): string {
  return String(query.mock.calls[callIndex][0]);
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

/** Admin client where the leave type resolves and nothing blocks the write. */
function mockCleanAdminClient() {
  vi.mocked(createAdminClient).mockResolvedValue({
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "leave_type_policies") {
        return makeChain({ data: [{ id: 1 }], error: null });
      }
      return makeChain({ data: [], error: null });
    }),
  } as any);
}

/** Session whose profiles.role is "hr" (Step 2: HR may write leaves). */
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

describe("leave actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.SESSION_SECRET = "test-session-secret-16";
  });

  it("should return failure if a non-admin tries to set leave", async () => {
    mockMemberSession();
    mockCleanAdminClient();

    const res = await setLeaveAction({
      employee_id: 100,
      start_date: "2026-09-21",
      end_date: "2026-09-22",
      note: "Personal matters",
    });
    expect(res).toEqual({
      success: false,
      // Updated (Step 2): gate is now Admin or HR
      error: "Unauthorized access. Admin or HR privileges required.",
    });
    expect(getPool).not.toHaveBeenCalled();
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
    expect(res).toEqual({
      success: false,
      // Updated (Step 2): gate is now Admin or HR
      error: "Unauthorized access. Admin or HR privileges required.",
    });
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it("should return failure if note is missing or only whitespace", async () => {
    mockAdminSession();
    mockCleanAdminClient();

    const resEmpty = await setLeaveAction({
      employee_id: 100,
      start_date: "2026-09-21",
      end_date: "2026-09-21",
      leave_type_id: 1,
      note: "",
    });
    expect(resEmpty).toEqual({
      success: false,
      error: "Reason for leave is required.",
    });
    expect(getPool).not.toHaveBeenCalled();

    const resSpaces = await setLeaveAction({
      employee_id: 100,
      start_date: "2026-09-21",
      end_date: "2026-09-21",
      leave_type_id: 1,
      note: "   ",
    });
    expect(resSpaces).toEqual({
      success: false,
      error: "Reason for leave is required.",
    });
    expect(getPool).not.toHaveBeenCalled();
  });

  it("should return failure if no valid leave type can be resolved", async () => {
    mockAdminSession();
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockImplementation(() =>
        makeChain({ data: [], error: null })
      ),
    } as any);

    const res = await setLeaveAction({
      employee_id: 100,
      start_date: "2026-09-21",
      end_date: "2026-09-21",
      note: "Personal matters",
    });
    expect(res).toEqual({
      success: false,
      error: "Invalid or inactive leave type.",
    });
    expect(getPool).not.toHaveBeenCalled();
  });

  it("should return failure if leave overlaps a company holiday", async () => {
    mockAdminSession();
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "leave_type_policies") {
          return makeChain({ data: [{ id: 1 }], error: null });
        }
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
      leave_type_id: 1,
      note: "Personal matters",
    });
    expect(res).toEqual({
      success: false,
      error: "Cannot set leave on a holiday.",
    });
    expect(getPool).not.toHaveBeenCalled();
  });

  it("should return failure if the employee already has overlapping leave", async () => {
    mockAdminSession();
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "leave_type_policies") {
          return makeChain({ data: [{ id: 1 }], error: null });
        }
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
      leave_type_id: 1,
      note: "Personal matters",
    });
    expect(res).toEqual({
      success: false,
      error: "This employee already has a leave covering part of that range.",
    });
    expect(getPool).not.toHaveBeenCalled();
  });

  it("should successfully set leave when an admin provides a valid date range", async () => {
    mockAdminSession("admin-1");
    mockCleanAdminClient();
    const { conn, query, getConnection } = mockPoolTransaction(42);

    const res = await setLeaveAction({
      employee_id: 100,
      start_date: "2026-09-21", // Monday
      end_date: "2026-09-22", // Tuesday
      leave_type_id: 1,
      note: "Personal matters",
    });
    expect(res.success).toBe(true);

    // Transaction lifecycle
    expect(getConnection).toHaveBeenCalledTimes(1);
    expect(conn.beginTransaction).toHaveBeenCalledTimes(1);
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.rollback).not.toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalledTimes(1);

    // 1st query: parent leave row
    expect(query).toHaveBeenCalledTimes(2);
    expect(sqlOf(query, 0)).toContain("INSERT INTO employee_leaves");
    expect(query.mock.calls[0][1]).toEqual([
      100,
      "2026-09-21",
      "2026-09-22",
      1,
      "Personal matters",
      "admin-1",
    ]);

    // 2nd query: child day rows, linked to the new leave id
    expect(sqlOf(query, 1)).toContain("INSERT INTO employee_leave_days");
    expect(query.mock.calls[1][1]).toEqual([
      [
        [42, "2026-09-21", 1],
        [42, "2026-09-22", 1],
      ],
    ]);
  });

  it("should skip weekend days when writing leave day rows", async () => {
    mockAdminSession("admin-1");
    mockCleanAdminClient();
    const { query } = mockPoolTransaction(7);

    const res = await setLeaveAction({
      employee_id: 100,
      start_date: "2026-09-18", // Friday
      end_date: "2026-09-21", // Monday
      leave_type_id: 1,
      note: "Long weekend",
    });
    expect(res.success).toBe(true);

    expect(sqlOf(query, 1)).toContain("INSERT INTO employee_leave_days");
    expect(query.mock.calls[1][1]).toEqual([
      [
        [7, "2026-09-18", 1],
        [7, "2026-09-21", 1],
      ],
    ]);
  });

  it("should roll back and release the connection if the insert fails", async () => {
    mockAdminSession("admin-1");
    mockCleanAdminClient();
    const { conn, query } = mockPoolTransaction();
    query.mockReset();
    query.mockRejectedValueOnce(new Error("Duplicate entry"));

    const res = await setLeaveAction({
      employee_id: 100,
      start_date: "2026-09-21",
      end_date: "2026-09-22",
      leave_type_id: 1,
      note: "Personal matters",
    });

    expect(res).toEqual({ success: false, error: "Duplicate entry" });
    expect(conn.beginTransaction).toHaveBeenCalledTimes(1);
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.commit).not.toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  it("should return failure if the leave end date is before the start date", async () => {
    mockAdminSession();
    const res = await setLeaveAction({
      employee_id: 100,
      start_date: "2026-09-22",
      end_date: "2026-09-21",
      note: "Personal matters",
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain("End date cannot be before start date");
    expect(getPool).not.toHaveBeenCalled();
  });

  it("should return failure if the leave date format is invalid", async () => {
    mockAdminSession();
    const res = await setLeaveAction({
      employee_id: 100,
      start_date: "09/21/2026",
      end_date: "2026-09-22",
      note: "Personal matters",
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain("Invalid date range");
    expect(getPool).not.toHaveBeenCalled();
  });

  it("should set leave for all employees but skip anyone already on leave", async () => {
    mockAdminSession("admin-1");
    let leaveOverlapChecks = 0;
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "leave_type_policies") {
          return makeChain({ data: [{ id: 1 }], error: null });
        }
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
          // Overlap checks: first employee (100) has leave, second (200) doesn't.
          const c = makeChain({ data: [], error: null });
          c.then = (resolve: any, reject?: any) => {
            leaveOverlapChecks++;
            const data = leaveOverlapChecks === 1 ? [{ id: 1 }] : [];
            return Promise.resolve({ data, error: null }).then(resolve, reject);
          };
          return c;
        }
        return makeChain();
      }),
    } as any);
    const { conn, query, getConnection } = mockPoolTransaction(42);

    const res = await setLeaveForAllAction({
      start_date: "2026-09-21",
      end_date: "2026-09-22",
      leave_type_id: 1,
      note: "Personal matters",
    });
    expect(res.success).toBe(true);
    expect(res).toMatchObject({ created: 1, skipped: 1 });

    // Only employee 200 was written, in exactly one transaction
    expect(getConnection).toHaveBeenCalledTimes(1);
    expect(conn.beginTransaction).toHaveBeenCalledTimes(1);
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.rollback).not.toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalledTimes(1);

    expect(query).toHaveBeenCalledTimes(2);
    expect(sqlOf(query, 0)).toContain("INSERT INTO employee_leaves");
    expect(query.mock.calls[0][1]).toEqual([
      200,
      "2026-09-21",
      "2026-09-22",
      1,
      "Personal matters",
      "admin-1",
    ]);
    expect(sqlOf(query, 1)).toContain("INSERT INTO employee_leave_days");
    expect(query.mock.calls[1][1]).toEqual([
      [
        [42, "2026-09-21", 1],
        [42, "2026-09-22", 1],
      ],
    ]);
  });

  it("should return failure if leave for all employees overlaps a holiday", async () => {
    mockAdminSession();
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "leave_type_policies") {
          return makeChain({ data: [{ id: 1 }], error: null });
        }
        if (table === "employees") {
          return makeChain({ data: [{ employee_id: 200 }], error: null });
        }
        if (table === "company_holidays") {
          return makeChain({ data: [{ id: 1 }], error: null });
        }
        return makeChain();
      }),
    } as any);

    const res = await setLeaveForAllAction({
      start_date: "2026-09-07",
      end_date: "2026-09-07",
      leave_type_id: 1,
      note: "Personal matters",
    });
    expect(res).toEqual({
      success: false,
      error: "Cannot set leave on a holiday.",
    });
    expect(getPool).not.toHaveBeenCalled();
  });

  it("should successfully remove leave when requested by an admin", async () => {
    mockAdminSession();
    const eqSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    const deleteSpy = vi.fn().mockReturnThis();
    const fromSpy = vi.fn().mockImplementation(() => {
      const c = makeChain();
      c.delete = deleteSpy;
      c.eq = eqSpy;
      return c;
    });
    vi.mocked(createAdminClient).mockResolvedValue({ from: fromSpy } as any);

    const res = await removeLeaveAction(42);
    expect(res.success).toBe(true);

    // Only the parent row is deleted here. Child rows in employee_leave_days
    // are removed by the database via ON DELETE CASCADE on leave_id; a unit
    // mock cannot verify that, so it should be covered by a schema/integration test.
    expect(fromSpy).toHaveBeenCalledWith("employee_leaves");
    expect(deleteSpy).toHaveBeenCalled();
    expect(eqSpy).toHaveBeenCalledWith("id", 42);
    expect(getPool).not.toHaveBeenCalled();
  });

  it("should allow an HR user to set leave", async () => {
    mockHrSession("hr-1");
    mockCleanAdminClient();
    const { conn, query } = mockPoolTransaction(42);

    const res = await setLeaveAction({
      employee_id: 100,
      start_date: "2026-09-21", // Monday
      end_date: "2026-09-22", // Tuesday
      leave_type_id: 1,
      note: "Personal matters",
    });
    expect(res).toEqual({ success: true });

    expect(conn.beginTransaction).toHaveBeenCalledTimes(1);
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.rollback).not.toHaveBeenCalled();
    expect(sqlOf(query, 0)).toContain("INSERT INTO employee_leaves");
    expect(query.mock.calls[0][1]).toEqual([
      100,
      "2026-09-21",
      "2026-09-22",
      1,
      "Personal matters",
      "hr-1",
    ]);
    expect(sqlOf(query, 1)).toContain("INSERT INTO employee_leave_days");
    expect(query.mock.calls[1][1]).toEqual([
      [
        [42, "2026-09-21", 1],
        [42, "2026-09-22", 1],
      ],
    ]);
  });

  it("should allow an HR user to set leave for all employees", async () => {
    mockHrSession("hr-1");
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "leave_type_policies") {
          return makeChain({ data: [{ id: 1 }], error: null });
        }
        if (table === "employees") {
          return makeChain({ data: [{ employee_id: 200 }], error: null });
        }
        return makeChain({ data: [], error: null });
      }),
    } as any);
    const { conn, query } = mockPoolTransaction(42);

    const res = await setLeaveForAllAction({
      start_date: "2026-09-21",
      end_date: "2026-09-22",
      leave_type_id: 1,
      note: "Team offsite",
    });
    expect(res).toMatchObject({ success: true, created: 1, skipped: 0 });
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(sqlOf(query, 0)).toContain("INSERT INTO employee_leaves");
    expect(query.mock.calls[0][1][0]).toBe(200);
    expect(query.mock.calls[0][1][5]).toBe("hr-1");
  });

  it("should allow an HR user to remove leave", async () => {
    mockHrSession();
    const eqSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    const deleteSpy = vi.fn().mockReturnThis();
    const fromSpy = vi.fn().mockImplementation(() => {
      const c = makeChain();
      c.delete = deleteSpy;
      c.eq = eqSpy;
      return c;
    });
    vi.mocked(createAdminClient).mockResolvedValue({ from: fromSpy } as any);

    const res = await removeLeaveAction(42);
    expect(res.success).toBe(true);
    expect(fromSpy).toHaveBeenCalledWith("employee_leaves");
    expect(deleteSpy).toHaveBeenCalled();
    expect(eqSpy).toHaveBeenCalledWith("id", 42);
  });

  it("should still apply leave rules to HR (holiday overlap blocks the leave)", async () => {
    mockHrSession();
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "leave_type_policies") {
          return makeChain({ data: [{ id: 1 }], error: null });
        }
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
      leave_type_id: 1,
      note: "Personal matters",
    });
    expect(res).toEqual({
      success: false,
      error: "Cannot set leave on a holiday.",
    });
    expect(getPool).not.toHaveBeenCalled();
  });

  it("should allow an admin role to set leave even if approval status is not checked", async () => {
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
    mockCleanAdminClient();
    const { conn, query } = mockPoolTransaction();

    const res = await setLeaveAction({
      employee_id: 100,
      start_date: "2026-09-28",
      end_date: "2026-09-28",
      leave_type_id: 1,
      note: "Personal matters",
    });
    expect(res.success).toBe(true);
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(sqlOf(query, 0)).toContain("INSERT INTO employee_leaves");
    expect(query.mock.calls[0][1][5]).toBe("pending-admin");
  });

  it("should return all employees' leave records when no employee is specified", async () => {
    const leaves = [
      {
        id: 1,
        employee_id: 100,
        start_date: "2026-09-10",
        end_date: "2026-09-11",
        leave_type_id: 1,
        note: "Personal matters",
      },
      {
        id: 2,
        employee_id: 200,
        start_date: "2026-09-12",
        end_date: "2026-09-12",
        leave_type_id: 1,
        note: "Team offsite",
      },
    ];
    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "leave_type_policies") {
          return makeChain({
            data: [{ id: 1, name: "Vacation" }],
            error: null,
          });
        }
        return makeChain({ data: leaves, error: null });
      }),
    } as any);

    const res = await getLeavesForRangedAction("2026-09-01", "2026-09-30");
    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(2);
    expect(res.data?.[0]).toMatchObject({ leave_type_name: "Vacation" });
  });

  it("should deny a non-admin leave write before any database write happens", async () => {
    mockMemberSession();
    const fromSpy = vi.fn();
    vi.mocked(createAdminClient).mockResolvedValue({
      from: fromSpy,
    } as any);

    await setLeaveAction({
      employee_id: 100,
      start_date: "2026-09-21",
      end_date: "2026-09-21",
      note: "Personal matters",
    });
    expect(fromSpy).not.toHaveBeenCalled();
    expect(getPool).not.toHaveBeenCalled();
  });
});