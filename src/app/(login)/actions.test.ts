import { describe, it, expect, vi, beforeEach } from "vitest";
import { signup } from "./actions";

vi.mock("@/lib/db-server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/db-server";

describe("signup action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success message 'Account created successfully!' on valid registration", async () => {
    const mockSignUp = vi.fn().mockResolvedValue({
      data: { user: { id: "user-123" }, session: null },
      error: null,
    });

    (createClient as any).mockResolvedValue({
      auth: { signUp: mockSignUp },
    });

    const formData = new FormData();
    formData.append("name", "John Doe");
    formData.append("email", "john@example.com");
    formData.append("password", "password123");
    formData.append("confirm-password", "password123");

    const result = await signup(formData);

    expect(result).toEqual({
      success: true,
      message: "Account created successfully!",
    });
  });
});
