import { formatDuration } from "./format-duration"


describe('formatDuration', () => {
  it('display the hours and the minutes', () => {
    expect(formatDuration(26_100_000)).toBe('7h15');
    expect(formatDuration(0)).toBe('0h00');
  });

  it('ignores seconds and does not go under zero', () => {
    expect(formatDuration(119_999)).toBe('0h01');
    expect(formatDuration(-1)).toBe('0h00');
  });
});
