/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { deleteUserAction } from "./actions";
import { createClient, createAdminClient } from "@/lib/supabase/server";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: vi.fn().mockReturnValue([]),
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}));

describe("deleteUserAction Server Action", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.DB_HOST = "127.0.0.1";
    process.env.SESSION_SECRET = "test-session-secret-16";
  });

  it("should return failure response if no authenticated user is found", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    } as any);

    const res = await deleteUserAction("target-123");
    expect(res).toEqual({ success: false, error: "Unauthorized: Please log in." });
  });

  it("should return failure response if caller is not an admin", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "caller-123" } }, error: null }),
      },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { role: "member", status: "approved" }, error: null }),
    } as any);

    const res = await deleteUserAction("target-123");
    expect(res).toEqual({ success: false, error: "Forbidden: Only approved administrators can delete users." });
  });

  it("should return failure response if caller is admin but not approved", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-123" } }, error: null }),
      },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { role: "admin", status: "rejected" }, error: null }),
    } as any);

    const res = await deleteUserAction("target-123");
    expect(res).toEqual({ success: false, error: "Forbidden: Only approved administrators can delete users." });
  });

  it("should return failure response if admin tries to delete themselves", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-123" } }, error: null }),
      },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { role: "admin", status: "approved" }, error: null }),
    } as any);

    const res = await deleteUserAction("admin-123");
    expect(res).toEqual({ success: false, error: "Forbidden: You cannot delete your own account." });
  });

  it("should execute deletion successfully if caller is admin", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-123" } }, error: null }),
      },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { role: "admin", status: "approved" }, error: null }),
    } as any);

    const mockDeleteUser = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createAdminClient).mockResolvedValue({
      auth: {
        admin: {
          deleteUser: mockDeleteUser,
        },
      },
    } as any);

    const res = await deleteUserAction("target-123");
    expect(res.success).toBe(true);
    expect(mockDeleteUser).toHaveBeenCalledWith("target-123");
  });
});
