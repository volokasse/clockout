import { SUBTRACTED_TYPES } from './period-types.js';
import { localDateOf, weekDays } from './week-rules.js';
import type { CalendarDate } from './week-rules.js';
import { computeSessionWorkedMs } from './worked-time.js';
import type { TypedTimeSpan } from './worked-time.js';

const MINUTE_MS = 60_000;

export interface WeeklySession {
    id: number;
    start: Date;
    end: Date | null;
    subs: TypedTimeSpan[];
}

export interface DayTotal {
    date: CalendarDate;
    workedMinutes: number;
    sessionCount: number;
}

export interface IncompleteSession {
    id: number;
    date: CalendarDate;
    start: string;
}

export interface WeeklyTotals {
    days: DayTotal[];
    totalMinutes: number;
    incompleteSessions: IncompleteSession[];
}

// Totals of the week starting on the given Monday.
//
// A session counts entirely on the calendar day of its start. Only finished
// sessions are added up: an open session is reported in incompleteSessions and
// never counted. The duration comes from computeSessionWorkedMs. Time is added
// up in milliseconds for each day, then rounded down to minutes once per day,
// so that the minutes shown for each day add up exactly to the total.
export function buildWeeklyTotals(
    weekStart: CalendarDate,
    sessions: WeeklySession[],
    now: Date,
    deducted: readonly number[] = SUBTRACTED_TYPES
): WeeklyTotals {
    const dates = weekDays(weekStart);
    const perDay = new Map(dates.map((date) => [date, { ms: 0, count: 0 }]));
    const incompleteSessions: IncompleteSession[] = [];

    for (const session of sessions) {
        const date = localDateOf(session.start);
        const day = perDay.get(date);
        // Defensive: the query only returns sessions of the week
        if (!day) continue;

        if (session.end === null) {
            incompleteSessions.push({ id: session.id, date, start: session.start.toISOString() });
            continue;
        }
        day.ms += computeSessionWorkedMs(session, session.subs, now, deducted);
        day.count++;
    }

    const days = dates.map((date): DayTotal => {
        const { ms, count } = perDay.get(date)!;
        return { date, workedMinutes: Math.floor(ms / MINUTE_MS), sessionCount: count };
    });
    const totalMinutes = days.reduce((sum, day) => sum + day.workedMinutes, 0);

    return { days, totalMinutes, incompleteSessions };
}

export function computeDelta(totalMinutes: number, targetMinutes: number): number {
    return totalMinutes - targetMinutes;
}
