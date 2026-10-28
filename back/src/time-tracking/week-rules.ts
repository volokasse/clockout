// Calendar rules of the weekly report.
//
// - A week runs from Monday 00:00 (included) to the next Monday 00:00
//   (excluded), in the REPORT_TIME_ZONE time zone.
// - A session belongs to the calendar day (in that time zone) on which it
//   STARTS, and so to the week of that day. A session that crosses midnight is
//   counted entirely on its start day.
// - Calendar days are plain 'YYYY-MM-DD' strings. They are manipulated with
//   pure UTC arithmetic, so daylight saving time never shifts a day. The only
//   place where a time zone matters is localDateOf(), which converts an instant
//   into the calendar day it falls on.
// - The week boundaries, as instants, are NOT computed here: PostgreSQL does it
//   (see WeeklyReportService), because it knows the daylight saving time rules.

export const REPORT_TIME_ZONE = 'Europe/Paris';

export const DAYS_IN_WEEK = 7;

// A calendar day, formatted 'YYYY-MM-DD'. It has no time and no time zone.
export type CalendarDate = string;

const DAY_MS = 86_400_000;

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

// PostgreSQL has no year 0, and the report also computes the day after the week:
// the first and the last year are left out so that every neighbouring day exists.
const FIRST_DATE: CalendarDate = '0001-01-01';
const LAST_DATE: CalendarDate = '9998-12-31';

// Midnight UTC of a calendar day, in milliseconds.
function toUtcMs(date: CalendarDate): number {
    const [year, month, day] = date.split('-').map(Number);
    // setUTCFullYear, unlike Date.UTC, does not map the years 0 to 99 to 1900-1999
    const instant = new Date(0);
    instant.setUTCFullYear(year, month - 1, day);
    return instant.getTime();
}

function fromUtcMs(ms: number): CalendarDate {
    return new Date(ms).toISOString().slice(0, 10);
}

// The round trip rejects the days that do not exist, such as 2026-02-31
// (which Date would silently turn into 2026-03-03).
export function isCalendarDate(value: string): value is CalendarDate {
    return CALENDAR_DATE.test(value)
        && value >= FIRST_DATE
        && value <= LAST_DATE
        && fromUtcMs(toUtcMs(value)) === value;
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
    return fromUtcMs(toUtcMs(date) + days * DAY_MS);
}

export function mondayOf(date: CalendarDate): CalendarDate {
    const dayOfWeek = new Date(toUtcMs(date)).getUTCDay(); // 0 = Sunday
    const sinceMonday = (dayOfWeek + 6) % DAYS_IN_WEEK;
    return addDays(date, -sinceMonday);
}

// The seven days of the week, Monday first.
export function weekDays(weekStart: CalendarDate): CalendarDate[] {
    return Array.from({ length: DAYS_IN_WEEK }, (_, index) => addDays(weekStart, index));
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
    let formatter = formatters.get(timeZone);
    if (!formatter) {
        formatter = new Intl.DateTimeFormat('en-US', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        formatters.set(timeZone, formatter);
    }
    return formatter;
}

// The calendar day on which an instant falls in the given time zone.
export function localDateOf(instant: Date, timeZone: string = REPORT_TIME_ZONE): CalendarDate {
    const parts = formatterFor(timeZone).formatToParts(instant);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((candidate) => candidate.type === type)!.value;
    // Intl does not pad the year: the year 1 would come out as '1', not '0001'
    return `${part('year').padStart(4, '0')}-${part('month')}-${part('day')}`;
}
