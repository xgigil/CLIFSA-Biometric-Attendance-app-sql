import { describe, it, expect, vi } from "vitest";
import SettingsPage, { getStatusBadgeStyle } from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: "light",
    setTheme: vi.fn(),
  }),
}));

vi.mock("./actions", () => ({
  getSettingsPageData: vi.fn().mockResolvedValue({
    user: null,
    role: "member",
    profiles: [],
    employees: [],
    sysSettings: null,
  }),
  updateDisplayNameAction: vi.fn(),
  updateSystemSettingsAction: vi.fn(),
  updateUserRoleAction: vi.fn(),
  updateUserEmployeeAction: vi.fn(),
  updateUserStatusAction: vi.fn(),
  deleteUserAction: vi.fn(),
}))

describe("SettingsPage Component", () => {
  it("should export a function", () => {
    expect(SettingsPage).toBeTypeOf("function");
  });

  describe("getStatusBadgeStyle helper", () => {
    it("should return the correct style class for approved status", () => {
      expect(getStatusBadgeStyle("approved")).toContain("bg-emerald-500/10");
      expect(getStatusBadgeStyle("approved")).toContain("text-emerald-500");
    });

    it("should return the correct style class for rejected status", () => {
      expect(getStatusBadgeStyle("rejected")).toContain("bg-rose-500/10");
      expect(getStatusBadgeStyle("rejected")).toContain("text-rose-500");
    });

    it("should return the correct style class for pending status", () => {
      expect(getStatusBadgeStyle("pending")).toContain("bg-amber-500/10");
      expect(getStatusBadgeStyle("pending")).toContain("text-amber-500");
      expect(getStatusBadgeStyle("pending")).toContain("animate-pulse");
    });
  });
});
