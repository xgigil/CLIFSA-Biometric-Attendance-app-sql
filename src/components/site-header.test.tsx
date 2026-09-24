// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteHeader } from "./site-header";
import { usePathname, useSearchParams } from "next/navigation";
import * as React from "react";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/dashboard/analytics"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

vi.mock("@/app/dashboard/analytics/actions", () => ({
  getEmployeesAction: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));

vi.mock("@/components/ui/sidebar", () => ({
  SidebarTrigger: () => <button data-testid="sidebar-trigger">Trigger</button>,
}));

describe("SiteHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (usePathname as any).mockReturnValue("/dashboard/analytics");
    (useSearchParams as any).mockReturnValue(new URLSearchParams());
  });

  it("should be exported as a React component function", () => {
    expect(SiteHeader).toBeTypeOf("function");
  });

  it("should return JSX element for admin view", () => {
    const { container } = render(<SiteHeader isAdmin={true} />);
    expect(container).toBeDefined();
  });

  it("should return JSX element for non-admin view", () => {
    const { container } = render(<SiteHeader isAdmin={false} />);
    expect(container).toBeDefined();
  });

  it("renders correct title and subtitle for calendar route", () => {
    (usePathname as any).mockReturnValue("/dashboard/calendar");
    (useSearchParams as any).mockReturnValue(new URLSearchParams({ date: "2026-07-15" }));
    
    render(<SiteHeader isAdmin={true} />);
    expect(screen.getAllByText("July 2026")[0]).toBeDefined();
    expect(screen.getByText("Monthly attendance calendar view")).toBeDefined();
  });

  it("renders weekday, month and day as title for admin daily logs", () => {
    (usePathname as any).mockReturnValue("/dashboard/analytics");
    (useSearchParams as any).mockReturnValue(
      new URLSearchParams({ date: "2026-07-15" }),
    );

    render(<SiteHeader isAdmin={true} />);
    expect(screen.getByText("Saturday, July 15")).toBeDefined();
    expect(screen.getByText("Daily attendance records")).toBeDefined();
  });
});
