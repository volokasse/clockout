import { firstDayOfMonth, lastDayofMonth, startOfDay, startOfNextDay, toDateInput } from "./date-range";

describe('date-range', () => {
  it('format a local date with a date field', () => {
    expect(toDateInput(new Date(2026, 9, 5))).toBe('2026-10-05');
  });

  it('gives the first and last day of month', () => {
    const today = new Date(2026, 9, 23);

    expect(firstDayOfMonth(today)).toBe('2026-10-01');
    expect(lastDayofMonth(today)).toBe('2026-10-31');
  });

  it('manage february in a bisextile year', () => {
    expect(lastDayofMonth(new Date(2028, 1, 10))).toBe('2028-02-29');
  });

  it('converts a date on local brackets [start, end[', () => {
    expect(new Date(startOfDay('2026-10-31')).getHours()).toBe(0);
    expect(new Date(startOfNextDay('2026-10-31')).getDate()).toBe(1);
    expect(new Date(startOfNextDay('2026-10-31')).getMonth()).toBe(10);
  });
});
