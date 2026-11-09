export type LeaveDayRow = {
	leave_date: string;
	day_value: 0.5 | 1.0;
};

export function expandHolidayRanges ( holidays: { start_date: string; end_date: string }[]): Set<string> {
	const dates = new Set<string>();
	const MAX = 366;
	
	for (const h of holidays) {
			const start = h.start_date?.substring(0, 10);
			const end = (h.end_date || h.start_date)?.substring(0, 10);
			if (!start || !end || end < start) continue;

			const cursor = new Date(`${start}T12:00:00Z`);
			const last = new Date(`${end}T12:00:00Z`);
			let guard = 0;
			while (cursor <= last && guard < MAX) {
					const y = cursor.getUTCFullYear();
					const m = String(cursor.getUTCMonth() + 1).padStart(2, "0");
					const d = String(cursor.getUTCDate()).padStart(2, "0");
					dates.add(`${y}-${m}-${d}`);
					cursor.setUTCDate(cursor.getUTCDate() + 1);
					guard++;
			}
	}
	return dates;
}

export function buildLeaveDayRows (args: {
	startDate: string;
	endDate: string;
	halfDayDates?: Iterable<string>;
	holidayDates?: Iterable<string>;
}): LeaveDayRow[] {
	const { startDate, endDate } = args;
	if (!startDate || !endDate || endDate < startDate) return [];

  const holidays = new Set(
    [...(args.holidayDates || [])].map((d) => d.substring(0, 10))
  );

  const halfDays = new Set(
    [...(args.halfDayDates ?? [])].map((d) => d.substring(0, 10))
  );

	const rows: LeaveDayRow[] = [];
	const cursor = new Date(`${startDate.substring(0, 10)}T12:00:00Z`);
  const last = new Date(`${endDate.substring(0, 10)}T12:00:00Z`);
  const MAX = 366;
  let guard = 0;

	
  while (cursor <= last && guard < MAX) {
    const y = cursor.getUTCFullYear();
    const m = String(cursor.getUTCMonth() + 1).padStart(2, "0");
    const d = String(cursor.getUTCDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${d}`;
    const dow = cursor.getUTCDay(); // 0=Sun, 6=Sat

    if (dow !== 0 && dow !== 6 && !holidays.has(dateStr)) {
      rows.push({
        leave_date: dateStr,
        day_value: halfDays.has(dateStr) ? 0.5 : 1.0,
      });
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard++;
  }

	return rows;
}


export function sumDayValues (rows: LeaveDayRow[]): number {
	return rows.reduce((sum, row) => sum + row.day_value, 0);
}