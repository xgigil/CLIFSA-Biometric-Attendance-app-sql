/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createAttendanceLogAction,
  updateAttendanceLogAction,
  deleteAttendanceLogAction,
  getEmployeesAction,
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

function makeChain(result: { data: any; error: any } = { data: [], error: null }) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue(result),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  };
  chain.then = (resolve: any, reject?: any) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

describe("attendance log and employee list permissions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.SESSION_SECRET = "test-session-secret-16";
  });

  it("should return failure if a non-admin tries to change attendance logs", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "m1" } },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation(() =>
        makeChain({ data: { role: "member" }, error: null })
      ),
    } as any);

    const insert = await createAttendanceLogAction({
      employee_id: 100,
      employee_name: "Emp A",
      log_date: "2026-09-10",
      log_time: "09:05",
    });
    expect(insert).toEqual({
      success: false,
      error: "Unauthorized. Admin role required.",
    });

    const update = await updateAttendanceLogAction(1, {
      log_date: "2026-09-10",
      log_time: "09:05",
    });
    expect(update.success).toBe(false);

    const del = await deleteAttendanceLogAction(1);
    expect(del.success).toBe(false);
  });

  it("should allow an admin to add an attendance log even on a leave day", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "admin-1" } },
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
        const c = makeChain();
        c.insert = insertSpy;
        return c;
      }),
    } as any);

    const res = await createAttendanceLogAction({
      employee_id: 100,
      employee_name: "Emp A",
      log_date: "2026-09-10",
      log_time: "09:05",
    });
    expect(res.success).toBe(true);
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        employee_id: 100,
        log_date: "2026-09-10",
        log_time: "09:05:00",
      })
    );
  });

  it("should return the full active employee list from the employee fetch action", async () => {
    const employees = [
      { employee_id: 100, employee_name: "Emp A" },
      { employee_id: 200, employee_name: "Emp B" },
    ];
    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn().mockImplementation(() =>
        makeChain({ data: employees, error: null })
      ),
    } as any);

    const res = await getEmployeesAction();
    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(2);
  });
});
