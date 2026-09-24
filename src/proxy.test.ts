/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { proxy } from "./proxy";
import { NextRequest } from "next/server";
import { createDbClient } from "@/lib/db-client";

vi.mock("@/lib/db-client", () => ({
  createDbClient: vi.fn(),
}));

describe("Next.js Middleware Routing", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const mockDbClient = (user: any, status: string = "approved") => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: user ? { status } : null,
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
    const mockGetUser = vi.fn().mockResolvedValue({ data: { user }, error: null });

    vi.mocked(createDbClient).mockReturnValue({
      auth: { getUser: mockGetUser },
      from: mockFrom,
    } as any);
  };

  it("should redirect unauthenticated users accessing /dashboard to /sign-in", async () => {
    mockDbClient(null);
    const req = new NextRequest(new URL("http://localhost:3000/dashboard"));
    const res = await proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/sign-in");
  });

  it("should redirect pending users accessing /dashboard to /pending-approval", async () => {
    mockDbClient({ id: "user-123" }, "pending");
    const req = new NextRequest(new URL("http://localhost:3000/dashboard"));
    const res = await proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/pending-approval");
  });

  it("should redirect rejected users accessing /dashboard to /rejected", async () => {
    mockDbClient({ id: "user-123" }, "rejected");
    const req = new NextRequest(new URL("http://localhost:3000/dashboard"));
    const res = await proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/rejected");
  });

  it("should redirect approved users accessing /pending-approval to /dashboard", async () => {
    mockDbClient({ id: "user-123" }, "approved");
    const req = new NextRequest(new URL("http://localhost:3000/pending-approval"));
    const res = await proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/dashboard");
  });

  it("should allow approved users to access /dashboard without redirect", async () => {
    mockDbClient({ id: "user-123" }, "approved");
    const req = new NextRequest(new URL("http://localhost:3000/dashboard"));
    const res = await proxy(req);
    expect(res.status).not.toBe(307);
  });
});
