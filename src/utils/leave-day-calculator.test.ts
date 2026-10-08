import { describe, it, expect } from "vitest"; // for Jest, remove this line (globals are injected)
import {
  buildLeaveDayRows,
  expandHolidayRanges,
  sumDayValues,
} from "./leave-day-calculator"; // adjust to your actual file path

/**
 * Reference calendar (2026):
 *   Sep 21 Mon | 22 Tue | 23 Wed | 24 Thu | 25 Fri | 26 Sat | 27 Sun
 *   Dec 28 Mon | 29 Tue | 30 Wed | 31 Thu
 *   Jan 1 Fri  | 2 Sat  | 3 Sun   (2027)
 */

describe("buildLeaveDayRows", () => {
  it("single weekday (Mon–Mon, no holidays) -> one row of 1.0", () => {
    const rows = buildLeaveDayRows({
      startDate: "2026-09-21",
      endDate: "2026-09-21",
      holidayDates: [],
    });

    expect(rows).toEqual([{ leave_date: "2026-09-21", day_value: 1.0 }]);
    expect(sumDayValues(rows)).toBe(1);
  });

  it("weekend only (Sat–Sun) -> []", () => {
    const rows = buildLeaveDayRows({
      startDate: "2026-09-26",
      endDate: "2026-09-27",
      holidayDates: [],
    });

    expect(rows).toEqual([]);
    expect(sumDayValues(rows)).toBe(0);
  });

  it("mid-week holiday (Mon–Fri, Wed holiday) -> Mon, Tue, Thu, Fri", () => {
    const rows = buildLeaveDayRows({
      startDate: "2026-09-21",
      endDate: "2026-09-25",
      holidayDates: ["2026-09-23"],
    });

    expect(rows.map((r) => r.leave_date)).toEqual([
      "2026-09-21",
      "2026-09-22",
      "2026-09-24",
      "2026-09-25",
    ]);
    expect(rows.every((r) => r.day_value === 1.0)).toBe(true);
    expect(sumDayValues(rows)).toBe(4);
  });

  it("half-day Friday (Mon–Fri, Fri half, Wed holiday) -> sum 3.5", () => {
    const rows = buildLeaveDayRows({
      startDate: "2026-09-21",
      endDate: "2026-09-25",
      halfDayDates: ["2026-09-25"],
      holidayDates: ["2026-09-23"],
    });

    expect(rows).toEqual([
      { leave_date: "2026-09-21", day_value: 1.0 },
      { leave_date: "2026-09-22", day_value: 1.0 },
      { leave_date: "2026-09-24", day_value: 1.0 },
      { leave_date: "2026-09-25", day_value: 0.5 },
    ]);
    expect(sumDayValues(rows)).toBe(3.5);
  });

  it("year-end (Dec 28 – Jan 3, no holidays) spans both years with no weekends", () => {
    const rows = buildLeaveDayRows({
      startDate: "2026-12-28",
      endDate: "2027-01-03",
      holidayDates: [],
    });

    expect(rows.map((r) => r.leave_date)).toEqual([
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
    ]);
    // no Sat (Jan 2) / Sun (Jan 3)
    expect(rows.some((r) => r.leave_date === "2027-01-02")).toBe(false);
    expect(rows.some((r) => r.leave_date === "2027-01-03")).toBe(false);
    expect(sumDayValues(rows)).toBe(5);
  });

  it("half-day on a weekend (Sat half) is skipped", () => {
    const rows = buildLeaveDayRows({
      startDate: "2026-09-26",
      endDate: "2026-09-26",
      halfDayDates: ["2026-09-26"],
      holidayDates: [],
    });

    expect(rows).toEqual([]);
  });

  it("half-day on a holiday is skipped", () => {
    const rows = buildLeaveDayRows({
      startDate: "2026-09-23",
      endDate: "2026-09-23",
      halfDayDates: ["2026-09-23"],
      holidayDates: ["2026-09-23"],
    });

    expect(rows).toEqual([]);
  });

  // --- extra edge cases ---

  it("returns [] when end is before start", () => {
    expect(
      buildLeaveDayRows({
        startDate: "2026-09-25",
        endDate: "2026-09-21",
        holidayDates: [],
      })
    ).toEqual([]);
  });

  it("returns [] for empty start/end", () => {
    expect(
      buildLeaveDayRows({ startDate: "", endDate: "", holidayDates: [] })
    ).toEqual([]);
  });

  it("accepts ISO timestamps (trims to YYYY-MM-DD)", () => {
    const rows = buildLeaveDayRows({
      startDate: "2026-09-21T00:00:00.000Z",
      endDate: "2026-09-22T00:00:00.000Z",
      halfDayDates: ["2026-09-22T08:00:00Z"],
      holidayDates: [],
    });

    expect(rows).toEqual([
      { leave_date: "2026-09-21", day_value: 1.0 },
      { leave_date: "2026-09-22", day_value: 0.5 },
    ]);
  });
});

describe("expandHolidayRanges", () => {
  it("expands a multi-day range inclusively", () => {
    const set = expandHolidayRanges([
      { start_date: "2026-09-23", end_date: "2026-09-25" },
    ]);

    expect([...set].sort()).toEqual(["2026-09-23", "2026-09-24", "2026-09-25"]);
  });

  it("treats a missing end_date as a single day", () => {
    const set = expandHolidayRanges([
      { start_date: "2026-09-23", end_date: "" },
    ]);

    expect([...set]).toEqual(["2026-09-23"]);
  });

  it("expands across a year boundary", () => {
    const set = expandHolidayRanges([
      { start_date: "2026-12-31", end_date: "2027-01-01" },
    ]);

    expect([...set].sort()).toEqual(["2026-12-31", "2027-01-01"]);
  });

  it("ignores invalid ranges (end before start)", () => {
    const set = expandHolidayRanges([
      { start_date: "2026-09-25", end_date: "2026-09-21" },
    ]);

    expect(set.size).toBe(0);
  });

  it("integrates with buildLeaveDayRows", () => {
    const holidayDates = expandHolidayRanges([
      { start_date: "2026-09-23", end_date: "2026-09-24" },
    ]);
    const rows = buildLeaveDayRows({
      startDate: "2026-09-21",
      endDate: "2026-09-25",
      holidayDates,
    });

    expect(rows.map((r) => r.leave_date)).toEqual(["2026-09-21", "2026-09-22", "2026-09-25"]);
  });
});

describe("sumDayValues", () => {
  it("returns 0 for no rows", () => {
    expect(sumDayValues([])).toBe(0);
  });
});