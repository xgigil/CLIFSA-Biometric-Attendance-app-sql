/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  checkIsAdminOrHr: vi.fn(),
  revalidateAttendancePaths: vi.fn(),
  revalidatePath: vi.fn(),
  poolQuery: vi.fn(),
  getConnection: vi.fn(),
  conn: {
    beginTransaction: vi.fn(),
    commit: vi.fn(),
    rollback: vi.fn(),
    release: vi.fn(),
    query: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: m.createClient,
  createAdminClient: m.createAdminClient,
}));
vi.mock("@/app/dashboard/attendance/date-range", () => ({
  validDateRange: (s: string, e: string) => (e < s ? "End date cannot be before start date" : null),
}));
vi.mock("@/app/dashboard/attendance/admin", () => ({
  checkIsAdminOrHr: m.checkIsAdminOrHr,
  revalidateAttendancePaths: m.revalidateAttendancePaths,
}));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidatePath }));
vi.mock("@/lib/db", () => ({
  getPool: () => ({ query: m.poolQuery, getConnection: m.getConnection }),
}));

import {
  submitLeaveApplicationAction,
  deletePendingApplicationAction,
} from "./apply-actions";

import {
  listLeaveApplicationAction,
  getLeaveApplicationDetailAction,
} from "./read-actions";

// ---------- fake query builder (records every chained call) ----------
type Call = { table: string; method: string; args: any[] };
let calls: Call[] = [];

function makeDb(tables: Record<string, any[]>, user: { id: string } | null) {
  return {
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from(table: string) {
      const b: any = {};
      for (const method of ["select", "eq", "neq", "gte", "lte", "in", "order", "delete"]) {
        b[method] = (...args: any[]) => {
          calls.push({ table, method, args });
          return b;
        };
      }
      b.maybeSingle = async () => ({ data: tables[table]?.[0] ?? null, error: null });
      b.single = b.maybeSingle;
      b.then = (res: any, rej: any) =>
        Promise.resolve({ data: tables[table] ?? [], error: null }).then(res, rej);
      return b;
    },
  };
}

function setup(opts: {
  role?: string;
  employeeId?: number | null;
  signedIn?: boolean;
  tables?: Record<string, any[]>;
}) {
  const { role = "member", employeeId = 1001, signedIn = true, tables = {} } = opts;
  const db = makeDb(
    {
      profiles: [{ role, employee_id: employeeId }],
      leave_type_policies: [{ id: 2, name: "Sick Leave" }], // active type exists
      employee_leaves: [], // no overlap
      company_holidays: [],
      ...tables,
    },
    signedIn ? { id: "user-1" } : null
  );
  m.createClient.mockResolvedValue(db);
  m.createAdminClient.mockResolvedValue(db);
}

// Answers the SQL that submit runs on the transaction connection.
function connQuery(sql: string) {
  if (sql.includes("INSERT INTO employee_leaves")) return Promise.resolve([{ insertId: 77 }]);
  if (sql.includes("INSERT")) return Promise.resolve([{}]);
  if (sql.includes("SELECT pool_id")) return Promise.resolve([[{ pool_id: 1 }]]);
  if (sql.includes("SELECT annual_allotment")) return Promise.resolve([[{ annual_allotment: "15.0" }]]);
  if (sql.includes("SUM(d.day_value)")) return Promise.resolve([[{ used: "4.0" }]]); // 15 - 4 = 11
  return Promise.resolve([[]]);
}

const connCall = (fragment: string) =>
  m.conn.query.mock.calls.find((c: any[]) => String(c[0]).includes(fragment));

const payload = {
  employee_id: 1001,
  start_date: "2026-09-21", // Mon
  end_date: "2026-09-25", // Fri
  leave_type_id: 2,
  note: "Cold",
  applicant_name: "Ana Reyes",
};

beforeEach(() => {
  calls = [];
  vi.clearAllMocks();
  m.getConnection.mockResolvedValue(m.conn);
  m.conn.query.mockImplementation(connQuery);
  m.checkIsAdminOrHr.mockResolvedValue(true);
});

describe("submitLeaveApplicationAction: validation", () => {
  it("fails when not signed in", async () => {
    setup({ signedIn: false });
    const res = await submitLeaveApplicationAction(payload);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/signed in/i);
  });

  it("required reason fails", async () => {
    setup({});
    const res = await submitLeaveApplicationAction({ ...payload, note: "   " });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/reason/i);
    expect(m.getConnection).not.toHaveBeenCalled();
  });

  it("applicant name is required", async () => {
    setup({});
    const res = await submitLeaveApplicationAction({ ...payload, applicant_name: " " });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/name/i);
  });

  it("inactive or unknown leave type fails", async () => {
    setup({ tables: { leave_type_policies: [] } });
    const res = await submitLeaveApplicationAction(payload);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/leave type/i);
    expect(m.getConnection).not.toHaveBeenCalled();
  });

  it("weekend-only range fails with no workdays", async () => {
    setup({});
    const res = await submitLeaveApplicationAction({
      ...payload,
      start_date: "2026-09-26", // Sat
      end_date: "2026-09-27", // Sun
    });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/no workdays/i);
    expect(m.conn.beginTransaction).not.toHaveBeenCalled();
  });
});

describe("submitLeaveApplicationAction: overlap", () => {
  it("overlap with an existing pending or approved leave fails", async () => {
    setup({ tables: { employee_leaves: [{ id: 5 }] } });
    const res = await submitLeaveApplicationAction(payload);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/pending or approved/i);
    expect(m.getConnection).not.toHaveBeenCalled();
  });

  it("the overlap query checks BOTH pending and approved", async () => {
    setup({});
    await submitLeaveApplicationAction(payload);
    const statusCall = calls.find(
      (c) => c.table === "employee_leaves" && c.method === "in" && c.args[0] === "status"
    );
    expect(statusCall?.args[1]).toEqual(["pending", "approved"]);
  });
});

describe("submitLeaveApplicationAction: permissions", () => {
  it("member cannot apply for another employee", async () => {
    setup({ role: "member", employeeId: 1001 });
    const res = await submitLeaveApplicationAction({ ...payload, employee_id: 1002 });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/yourself/i);
    expect(m.getConnection).not.toHaveBeenCalled();
  });

  it("member with no linked employee is rejected", async () => {
    setup({ role: "member", employeeId: null });
    const res = await submitLeaveApplicationAction(payload);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/not linked/i);
  });

  it("member can apply for themselves", async () => {
    setup({ role: "member", employeeId: 1001 });
    const res = await submitLeaveApplicationAction(payload);
    expect(res.success).toBe(true);
  });

  it.each(["admin", "hr"])("%s can apply for any employee", async (role) => {
    setup({ role, employeeId: null });
    const res = await submitLeaveApplicationAction({ ...payload, employee_id: 1002 });
    expect(res.success).toBe(true);
    expect(res.leaveId).toBe(77);
  });
});

describe("submitLeaveApplicationAction: what gets written", () => {
  it("writes a pending leave, its day rows and the form row in one transaction", async () => {
    setup({});
    const res = await submitLeaveApplicationAction(payload);

    expect(res).toEqual({ success: true, leaveId: 77 });
    expect(m.conn.beginTransaction).toHaveBeenCalledTimes(1);
    expect(m.conn.commit).toHaveBeenCalledTimes(1);
    expect(m.conn.rollback).not.toHaveBeenCalled();
    expect(m.conn.release).toHaveBeenCalledTimes(1);

    const leaveInsert = connCall("INSERT INTO employee_leaves")!;
    expect(leaveInsert[0]).toContain("'pending'");
    expect(leaveInsert[1]).toEqual([1001, "2026-09-21", "2026-09-25", 2, "Cold", "user-1"]);

    expect(connCall("INSERT INTO employee_leave_days")).toBeDefined();
    expect(connCall("INSERT INTO leave_applications")).toBeDefined();
  });

  it("half-day dates produce 0.5 rows and the right leave_taken snapshot", async () => {
    setup({
      tables: {
        // Wednesday holiday: skipped, not rejected
        company_holidays: [{ start_date: "2026-09-23", end_date: "2026-09-23" }],
      },
    });
    const res = await submitLeaveApplicationAction({
      ...payload,
      halfDayDates: ["2026-09-25"], // Friday is a half day
    });
    expect(res.success).toBe(true);

    const days = connCall("INSERT INTO employee_leave_days")![1][0];
    expect(days).toEqual([
      [77, "2026-09-21", 1],
      [77, "2026-09-22", 1],
      [77, "2026-09-24", 1],
      [77, "2026-09-25", 0.5],
    ]);

    // beginning 15 - 4 used = 11; taken 3.5; allowable 7.5
    const form = connCall("INSERT INTO leave_applications")![1];
    expect(form).toEqual([77, "Ana Reyes", null, null, 11, 3.5, 7.5]);
  });

  it("trims and stores position and department", async () => {
    setup({});
    await submitLeaveApplicationAction({
      ...payload,
      position: "  IT Head ",
      department: " IT Dept. ",
    });
    const form = connCall("INSERT INTO leave_applications")![1];
    expect(form.slice(2, 4)).toEqual(["IT Head", "IT Dept."]);
  });

  it("rolls back and releases when an insert fails", async () => {
    setup({});
    m.conn.query.mockImplementation((sql: string) =>
      sql.includes("INSERT INTO leave_applications")
        ? Promise.reject(new Error("boom"))
        : connQuery(sql)
    );
    const res = await submitLeaveApplicationAction(payload);

    expect(res.success).toBe(false);
    expect(res.error).toBe("boom");
    expect(m.conn.rollback).toHaveBeenCalledTimes(1);
    expect(m.conn.commit).not.toHaveBeenCalled();
    expect(m.conn.release).toHaveBeenCalledTimes(1);
  });
});

describe("deletePendingApplicationAction", () => {
  it("Admin/HR can delete a pending application", async () => {
    setup({ role: "hr", tables: { employee_leaves: [{ id: 5, status: "pending" }] } });
    m.poolQuery.mockResolvedValue([{ affectedRows: 1 }]);

    const res = await deletePendingApplicationAction(5);

    expect(res.success).toBe(true);
    const [sql, params] = m.poolQuery.mock.calls[0];
    expect(sql).toContain("DELETE FROM employee_leaves");
    expect(sql).toContain("status = 'pending'");
    expect(params).toEqual([5]);
  });

  it("a non-pending application is rejected", async () => {
    setup({ tables: { employee_leaves: [{ id: 5, status: "approved" }] } });
    const res = await deletePendingApplicationAction(5);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/only pending/i);
    expect(m.poolQuery).not.toHaveBeenCalled();
  });

  it("a non-manager cannot delete", async () => {
    setup({ tables: { employee_leaves: [{ id: 5, status: "pending" }] } });
    m.checkIsAdminOrHr.mockResolvedValue(false);
    const res = await deletePendingApplicationAction(5);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/admin or hr/i);
    expect(m.poolQuery).not.toHaveBeenCalled();
  });

  it("a missing application is reported as not found", async () => {
    setup({ tables: { employee_leaves: [] } });
    const res = await deletePendingApplicationAction(999);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/not found/i);
  });

  it("if it was approved between the check and the DELETE, nothing is deleted", async () => {
    setup({ tables: { employee_leaves: [{ id: 5, status: "pending" }] } });
    m.poolQuery.mockResolvedValue([{ affectedRows: 0 }]);
    const res = await deletePendingApplicationAction(5);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/only pending/i);
  });
});

describe("listLeaveApplicationAction", () => {
  const leaveRows = [
    { id: 5, employee_id: 1001, leave_type_id: 2, status: "approved", created_at: "2026-09-01" },
    { id: 6, employee_id: 1001, leave_type_id: 2, status: "pending", created_at: "2026-09-02" },
    { id: 7, employee_id: 1001, leave_type_id: 2, status: "approved", created_at: "2026-09-03" }, // Set Leave
  ];
  const appRows = [
    { leave_id: 5, applicant_name: "A", date_filed: "2026-09-01", beginning_balance: "15.0", leave_taken: "1.0", allowable_leave: "14.0" },
    { leave_id: 6, applicant_name: "A", date_filed: "2026-09-02", beginning_balance: "14.0", leave_taken: "0.5", allowable_leave: "13.5" },
  ];

  it("a member is scoped to their own employee, ignoring the filter", async () => {
    setup({
      role: "member",
      employeeId: 1001,
      tables: { employee_leaves: leaveRows, leave_applications: appRows },
    });
    await listLeaveApplicationAction({ employeeId: 1002 });
    const scope = calls.find(
      (c) => c.table === "employee_leaves" && c.method === "eq" && c.args[0] === "employee_id"
    );
    expect(scope?.args[1]).toBe(1001);
  });

  it("drops Set Leave rows (no form row) and lists pending first", async () => {
    setup({
      role: "hr",
      tables: { employee_leaves: leaveRows, leave_applications: appRows },
    });
    const res = await listLeaveApplicationAction();
    expect(res.success).toBe(true);
    expect((res.data as any[]).map((r) => r.id)).toEqual([6, 5]);
    expect((res.data as any[])[0].leave_taken).toBe(0.5); // converted to a number
  });
});

describe("getLeaveApplicationDetailAction", () => {
  it("a member cannot open another employee's application", async () => {
    setup({
      role: "member",
      employeeId: 1001,
      tables: { employee_leaves: [{ id: 5, employee_id: 1002, leave_type_id: 2, status: "pending" }] },
    });
    const res = await getLeaveApplicationDetailAction(5);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/not found/i);
  });

  it("a leave with no form row (Set Leave) has no detail page", async () => {
    setup({
      role: "admin",
      tables: {
        employee_leaves: [{ id: 5, employee_id: 1001, leave_type_id: 2, status: "approved" }],
        leave_applications: [],
      },
    });
    const res = await getLeaveApplicationDetailAction(5);
    expect(res.success).toBe(false);
  });
});