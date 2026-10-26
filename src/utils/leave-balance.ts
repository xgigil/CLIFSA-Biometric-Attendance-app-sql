import type { Pool } from "mysql2/promise";
import { getPool } from "@/lib/db";

export type QueryExecutor = Pick<Pool, "query">;

export type LeaveBalance = {
	poolId: number;
	year: number;
	annualAllotment: number;
	usedApproved: number;
	remainingBalance: number;
};

export type ApplicationSnapshots = {
	beginning_balance: number;
	leave_taken: number;
	allowable_leave: number;
};

export type PoolBalance = {
	poolId: number;
	poolName: string;
	annualAllotment: number;
	usedApproved: number;
	remainingBalance: number; // can be negative on purpose, so over-use stays visible
	year: number;
}

export function computeRemainingBalance(
	allotment: number,
	used: number
): number {
	// Negative results are allowed on purpose, so over-use stays visible
	// instead of being hidden by a clamp to 0.
	return allotment - used;
}

export function computeApplicationSnapshots(args: {
  beginningBalance: number;
  leaveTaken: number;
}): ApplicationSnapshots {
  const { beginningBalance, leaveTaken } = args;
  return {
    beginning_balance: beginningBalance,
    leave_taken: leaveTaken,
    allowable_leave: computeRemainingBalance(beginningBalance, leaveTaken),
  };
}

export async function resolvePoolIdForLeaveType(
	leaveTypeId: number,
	executor: QueryExecutor = getPool()
): Promise<number | null> {
	const [rows] = await executor.query(
			"SELECT pool_id FROM leave_type_policies WHERE id = ? LIMIT 1",
			[leaveTypeId]
	);
	const row = (rows as { pool_id: number | string }[])[0];
	return row ? Number(row.pool_id) : null;
}

export async function getLeaveBalance(args: {
	employeeId: number;
	year: number;
	poolId: number;
	executor?: QueryExecutor;
}): Promise<LeaveBalance> {
	const { employeeId, year, poolId } = args;
	const executor = args.executor ?? getPool();
	
	if (!Number.isInteger(year) || year < 1900 || year > 9999) {
			throw new Error(`Invalid year: ${year}`);
	}

  // 1) Allotment for the pool
	const [ poolRows ] = await executor.query(
			"SELECT annual_allotment FROM leave_balance_pools WHERE id = ? LIMIT 1",
			[poolId]
	);
	const poolRow = (poolRows as { annual_allotment: string | number }[])[0];
	if (!poolRow) {
		throw new Error(`Leave balance pool not found: ${poolId}`);
	}
	const annualAllotment = Number(poolRow.annual_allotment);

	// 2) Approved days used in that calendar year, for that pool.
	// For leaves spanning two years (e.g. Dec 28 to Jan 3), only the day rows dated inside `year` are counted. 
	// Never splits using the parent leave's start_date/end_date.
	const [usedRows] = await executor.query(
		`SELECT COALESCE(SUM(d.day_value), 0) AS used
				FROM employee_leave_days d
				INNER JOIN employee_leaves l ON l.id = d.leave_id
				INNER JOIN leave_type_policies t ON t.id = l.leave_type_id
			WHERE l.employee_id = ?
				AND l.status = 'approved'
				AND t.pool_id = ?
				AND d.leave_date >= ?
				AND d.leave_date <= ?`,
		[employeeId, poolId, `${year}-01-01`, `${year}-12-31`]
	);
	const usedApproved = Number(
		(usedRows as { used: string | number | null }[])[0]?.used ?? 0
	);

	return {
		poolId,
		year,
		annualAllotment,
		usedApproved,
		remainingBalance: computeRemainingBalance(annualAllotment, usedApproved),
	};
}

export async function getLeaveBalanceForLeaveType(args: {
  employeeId: number;
  year: number;
  leaveTypeId: number;
  executor?: QueryExecutor;
}): Promise<LeaveBalance> {
  const executor = args.executor ?? getPool();
  const poolId = await resolvePoolIdForLeaveType(args.leaveTypeId, executor);

  if (poolId === null) {
    throw new Error(`Unknown leave type: ${args.leaveTypeId}`);
  }

  return getLeaveBalance({
    employeeId: args.employeeId,
    year: args.year,
    poolId,
    executor,
  });
}
