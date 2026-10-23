import { formatClock } from "./format-clock";

describe('formatClock', () => {
  it('format hours, minutes and seconds on two digits', () => {
    expect(formatClock(0)).toBe('00:00:00');
    expect(formatClock(3_725_000)).toBe('01:02:05');
  });

  it('ignore the milliseconds and never go under zero', () => {
    expect(formatClock(1999)).toBe('00:00:01');
    expect(formatClock(-5000)).toBe('00:00:00');
  });
});
