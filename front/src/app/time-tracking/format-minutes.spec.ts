import { formatMinutes, formatSignedMinutes } from './format-minutes';

describe('formatMinutes', () => {
  it.each([
    [0, '0h00'],
    [5, '0h05'],
    [59, '0h59'],
    [60, '1h00'],
    [450, '7h30'],
    [1380, '23h00'],
    [2100, '35h00'],
    [10_080, '168h00'],
  ])('affiche %i minutes sous la forme « %s »', (minutes, expected) => {
    expect(formatMinutes(minutes)).toBe(expected);
  });

  it('ne descend jamais sous zéro et ignore les décimales', () => {
    expect(formatMinutes(-10)).toBe('0h00');
    expect(formatMinutes(89.9)).toBe('1h29');
  });
});

describe('formatSignedMinutes', () => {
  it.each([
    [-75, '-1h15'],
    [-720, '-12h00'],
    [-1, '-0h01'],
    [30, '+0h30'],
    [90, '+1h30'],
    [0, '0h00'],
    [0.5, '0h00'],
    [-0.5, '0h00'],
    [-1.5, '-0h01'],
  ])("affiche l'écart %s sous la forme « %s »", (delta, expected) => {
    expect(formatSignedMinutes(delta)).toBe(expected);
  });

  it('utilise le tiret ASCII et une espace simple', () => {
    const text = formatSignedMinutes(-75);

    expect(text.charCodeAt(0)).toBe(0x2d);
    expect(text).toMatch(/^-1h15$/);
  });
});
