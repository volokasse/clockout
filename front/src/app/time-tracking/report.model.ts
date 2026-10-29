/** Mirror of the `GET /api/reports/weekly` response: every figure is computed by the server. */
export interface DayTotal {
  /** Calendar day "YYYY-MM-DD" (Europe/Paris). */
  date: string;
  workedMinutes: number;
  sessionCount: number;
}

export interface IncompleteSession {
  id: number;
  /** Calendar day "YYYY-MM-DD" of the start (Europe/Paris). */
  date: string;
  start: string;
}

export interface WeeklyReport {
  timeZone: string;
  weekStart: string;
  weekEnd: string;
  previousWeekStart: string;
  nextWeekStart: string;
  /** Always 7 entries, Monday to Sunday. */
  days: DayTotal[];
  totalMinutes: number;
  targetMinutes: number;
  deltaMinutes: number;
  incompleteSessions: IncompleteSession[];
}
