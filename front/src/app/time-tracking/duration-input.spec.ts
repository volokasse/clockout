import { MAX_WEEKLY_TARGET_MINUTES, splitMinutes, toMinutes } from './duration-input';

describe('toMinutes', () => {
  it.each([
    [0, 0, 0],
    [0, 5, 5],
    [1, 0, 60],
    [7, 30, 450],
    [35, 0, 2100],
    [168, 0, MAX_WEEKLY_TARGET_MINUTES],
  ])('convertit %i h %i min en %i minutes', (hours, minutes, expected) => {
    expect(toMinutes(hours, minutes)).toBe(expected);
  });
});

describe('splitMinutes', () => {
  it.each([
    [0, 0, 0],
    [5, 0, 5],
    [60, 1, 0],
    [450, 7, 30],
    [2100, 35, 0],
    [MAX_WEEKLY_TARGET_MINUTES, 168, 0],
  ])('découpe %i minutes en %i h %i min', (total, hours, minutes) => {
    expect(splitMinutes(total)).toEqual({ hours, minutes });
  });

  it('ne descend jamais sous zéro et ignore les décimales', () => {
    expect(splitMinutes(-30)).toEqual({ hours: 0, minutes: 0 });
    expect(splitMinutes(90.9)).toEqual({ hours: 1, minutes: 30 });
  });

  it.each([0, 1, 59, 60, 61, 450, 2100, MAX_WEEKLY_TARGET_MINUTES])(
    'redonne %i minutes après un aller-retour',
    (total) => {
      const { hours, minutes } = splitMinutes(total);

      expect(toMinutes(hours, minutes)).toBe(total);
    },
  );
});
