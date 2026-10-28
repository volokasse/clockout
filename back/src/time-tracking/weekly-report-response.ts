import type { DayTotal, IncompleteSession } from './weekly-report.js';
import type { CalendarDate } from './week-rules.js';

export interface WeeklyReportResponse {
    timeZone: string;
    weekStart: CalendarDate;
    weekEnd: CalendarDate;
    previousWeekStart: CalendarDate;
    nextWeekStart: CalendarDate;
    days: DayTotal[];
    totalMinutes: number;
    incompleteSessions: IncompleteSession[];
}
