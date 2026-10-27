const pad = (n: number) => String(n).padStart(2, '0');

/** Date locale -> "2026-10-23" (value of <input type="date">) */
export function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function firstDayOfMonth(today = new Date()): string {
  return toDateInput(new Date(today.getFullYear(), today.getMonth(), 1));
}

export function lastDayofMonth(today = new Date()): string {
  return toDateInput(new Date(today.getFullYear(), today.getMonth() + 1, 0));
}

/** "2026-10-01" -> instant ISO of 1st of October 00:00, local time. Edges included. */
export function startOfDay(date: string): string {
  return new Date(`${date}T00:00`).toISOString();
}

/** "2026-10-31" -> instant ISO of 1st of November 00:00, local time. Edges excluded. */
export function startOfNextDay(date: string): string {
  const next = new Date(`${date}T00:00`);
  next.setDate(next.getDate() + 1);
  return next.toISOString();
}
