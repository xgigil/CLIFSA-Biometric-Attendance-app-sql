import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));

vi.mock("@/lib/db", () => ({
  getPool: () => ({ query: mockQuery }),
}));

import {
  computeRemainingBalance,
  computeApplicationSnapshots,
  resolvePoolIdForLeaveType,
  getLeaveBalance,
  getLeaveBalanceForLeaveType,
} from "./leave-balance";

beforeEach(() => {
  mockQuery.mockReset();
});

describe("computeRemainingBalance", () => {
  it("unused pool -> full allotment", () => {
    expect(computeRemainingBalance(15, 0)).toBe(15);
  });

  it("subtracts usage", () => {
    expect(computeRemainingBalance(15, 4)).toBe(11);
  });

  it("allows negative so over-use is visible", () => {
    expect(computeRemainingBalance(15, 16)).toBe(-1);
  });
});

describe("computeApplicationSnapshots", () => {
  it("beginning 10, taken 3.5 -> allowable 6.5", () => {
    expect(
      computeApplicationSnapshots({ beginningBalance: 10, leaveTaken: 3.5 })
    ).toEqual({ beginning_balance: 10, leave_taken: 3.5, allowable_leave: 6.5 });
  });

  it("half-day taken -> leave_taken 0.5", () => {
    expect(
      computeApplicationSnapshots({ beginningBalance: 11, leaveTaken: 0.5 })
    ).toEqual({ beginning_balance: 11, leave_taken: 0.5, allowable_leave: 10.5 });
  });
});

describe("resolvePoolIdForLeaveType", () => {
  it("returns the pool id as a number", async () => {
    mockQuery.mockResolvedValueOnce([[{ pool_id: "2" }]]);
    await expect(resolvePoolIdForLeaveType(5)).resolves.toBe(2);
    expect(mockQuery.mock.calls[0][1]).toEqual([5]);
  });

  it("returns null for an unknown type", async () => {
    mockQuery.mockResolvedValueOnce([[]]);
    await expect(resolvePoolIdForLeaveType(999)).resolves.toBeNull();
  });

  it("does not filter on is_active (deactivated types still resolve)", async () => {
    mockQuery.mockResolvedValueOnce([[{ pool_id: 1 }]]);
    await resolvePoolIdForLeaveType(1);
    expect(mockQuery.mock.calls[0][0]).not.toMatch(/is_active/i);
  });
});

describe("getLeaveBalance", () => {
  it("unused pool: remainingBalance equals allotment", async () => {
    mockQuery
      .mockResolvedValueOnce([[{ annual_allotment: "15.0" }]])
      .mockResolvedValueOnce([[{ used: "0" }]]);

    const result = await getLeaveBalance({ employeeId: 1001, year: 2026, poolId: 1 });

    expect(result).toEqual({
      poolId: 1,
      year: 2026,
      annualAllotment: 15,
      usedApproved: 0,
      remainingBalance: 15,
    });
  });

  it("approved usage: remainingBalance = allotment - used (string DECIMALs converted)", async () => {
    mockQuery
      .mockResolvedValueOnce([[{ annual_allotment: "15.0" }]])
      .mockResolvedValueOnce([[{ used: "4.5" }]]);

    const result = await getLeaveBalance({ employeeId: 1001, year: 2026, poolId: 1 });

    expect(result.usedApproved).toBe(4.5);
    expect(result.remainingBalance).toBe(10.5);
  });

  it("only counts approved leaves (SQL filter for pending/denied/cancelled)", async () => {
    mockQuery
      .mockResolvedValueOnce([[{ annual_allotment: 15 }]])
      .mockResolvedValueOnce([[{ used: 0 }]]);

    await getLeaveBalance({ employeeId: 1001, year: 2026, poolId: 1 });

    const usedSql = mockQuery.mock.calls[1][0] as string;
    expect(usedSql).toContain("l.status = 'approved'");
  });

  it("binds employee, pool and the calendar-year bounds", async () => {
    mockQuery
      .mockResolvedValueOnce([[{ annual_allotment: 15 }]])
      .mockResolvedValueOnce([[{ used: 0 }]]);

    await getLeaveBalance({ employeeId: 1001, year: 2026, poolId: 3 });

    expect(mockQuery.mock.calls[1][1]).toEqual([1001, 3, "2026-01-01", "2026-12-31"]);
  });

  it("year filter: a different year uses different bounds", async () => {
    mockQuery
      .mockResolvedValueOnce([[{ annual_allotment: 15 }]])
      .mockResolvedValueOnce([[{ used: 0 }]]);

    await getLeaveBalance({ employeeId: 1001, year: 2027, poolId: 1 });

    expect(mockQuery.mock.calls[1][1]).toEqual([1001, 1, "2027-01-01", "2027-12-31"]);
  });

  it("treats a NULL SUM as 0", async () => {
    mockQuery
      .mockResolvedValueOnce([[{ annual_allotment: 15 }]])
      .mockResolvedValueOnce([[{ used: null }]]);

    const result = await getLeaveBalance({ employeeId: 1001, year: 2026, poolId: 1 });
    expect(result.usedApproved).toBe(0);
    expect(result.remainingBalance).toBe(15);
  });

  it("allows negative remainingBalance when over-used", async () => {
    mockQuery
      .mockResolvedValueOnce([[{ annual_allotment: 15 }]])
      .mockResolvedValueOnce([[{ used: "16" }]]);

    const result = await getLeaveBalance({ employeeId: 1001, year: 2026, poolId: 1 });
    expect(result.remainingBalance).toBe(-1);
  });

  it("throws when the pool does not exist", async () => {
    mockQuery.mockResolvedValueOnce([[]]);
    await expect(
      getLeaveBalance({ employeeId: 1001, year: 2026, poolId: 999 })
    ).rejects.toThrow(/pool not found/i);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it("throws on an invalid year", async () => {
    await expect(
      getLeaveBalance({ employeeId: 1001, year: 26, poolId: 1 })
    ).rejects.toThrow(/invalid year/i);
  });

  it("uses a provided executor instead of the default pool", async () => {
    const custom = vi
      .fn()
      .mockResolvedValueOnce([[{ annual_allotment: 15 }]])
      .mockResolvedValueOnce([[{ used: 1 }]]);

    const result = await getLeaveBalance({
      employeeId: 1001,
      year: 2026,
      poolId: 1,
      executor: { query: custom } as never,
    });

    expect(custom).toHaveBeenCalledTimes(2);
    expect(mockQuery).not.toHaveBeenCalled();
    expect(result.remainingBalance).toBe(14);
  });
});

describe("getLeaveBalanceForLeaveType", () => {
  it("resolves the pool then computes the balance", async () => {
    mockQuery
      .mockResolvedValueOnce([[{ pool_id: 1 }]]) // resolve pool
      .mockResolvedValueOnce([[{ annual_allotment: "15.0" }]]) // allotment
      .mockResolvedValueOnce([[{ used: "4.0" }]]); // usage

    const result = await getLeaveBalanceForLeaveType({
      employeeId: 1001,
      year: 2026,
      leaveTypeId: 1,
    });

    expect(result.poolId).toBe(1);
    expect(result.remainingBalance).toBe(11);
  });

  it("throws for an unknown leave type", async () => {
    mockQuery.mockResolvedValueOnce([[]]);
    await expect(
      getLeaveBalanceForLeaveType({ employeeId: 1001, year: 2026, leaveTypeId: 999 })
    ).rejects.toThrow(/unknown leave type/i);
  });
});