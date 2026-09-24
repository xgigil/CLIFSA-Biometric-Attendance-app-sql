export const DATE_RANGE = /^\d{4}-\d{2}-\d{2}$/;

export const RANGE_ERRORS = {
    invalidDate: "Invalid date range. Expected format: YYYY-MM-DD",
    endBeforeStart: "End date cannot be before start date",
} as const;

export function validDateRange(start_date: string, end_date: string): string | null {
    if (!DATE_RANGE.test(start_date) || !DATE_RANGE.test(end_date)) {
        return RANGE_ERRORS.invalidDate;
    }
    if (end_date < start_date) {
        return RANGE_ERRORS.endBeforeStart;
    }
    return null;
}