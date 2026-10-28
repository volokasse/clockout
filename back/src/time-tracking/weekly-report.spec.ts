import { buildWeeklyTotals, computeDelta } from './weekly-report.js';
import type { WeeklySession } from './weekly-report.js';

const WEEK = '2026-01-05';
const NOW = new Date('2026-01-20T12:00:00Z');

// January is UTC+1 in Paris: '09:00' on the 5th is 08:00Z
const paris = (day: string, time: string) => new Date(`2026-01-${day}T${time}:00+01:00`);

const session = (id: number, day: string, from: string, to: string | null): WeeklySession => ({
    id,
    start: paris(day, from),
    end: to === null ? null : paris(day, to),
    subs: []
});

describe('buildWeeklyTotals', () => {
    it('retourne sept jours à zéro pour une semaine vide', () => {
        const totals = buildWeeklyTotals(WEEK, [], NOW);

        expect(totals.days.map((day) => day.date)).toEqual([
            '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08',
            '2026-01-09', '2026-01-10', '2026-01-11'
        ]);
        expect(totals.days.every((day) => day.workedMinutes === 0 && day.sessionCount === 0)).toBe(true);
        expect(totals.totalMinutes).toBe(0);
        expect(totals.incompleteSessions).toEqual([]);
    });

    it('additionne les sessions d\'un même jour', () => {
        const totals = buildWeeklyTotals(WEEK, [
            session(1, '05', '09:00', '12:00'),
            session(2, '05', '13:00', '14:30')
        ], NOW);

        expect(totals.days[0]).toEqual({ date: '2026-01-05', workedMinutes: 270, sessionCount: 2 });
        expect(totals.totalMinutes).toBe(270);
    });

    it('ne compte pas une session ouverte et la signale', () => {
        const totals = buildWeeklyTotals(WEEK, [
            session(1, '05', '09:00', '10:00'),
            session(2, '09', '08:00', null)
        ], NOW);

        expect(totals.totalMinutes).toBe(60);
        expect(totals.days[4]).toEqual({ date: '2026-01-09', workedMinutes: 0, sessionCount: 0 });
        expect(totals.incompleteSessions).toEqual([
            { id: 2, date: '2026-01-09', start: '2026-01-09T07:00:00.000Z' }
        ]);
    });
});

describe('computeDelta', () => {
    it.each([
        ['sous l\'objectif', 1380, 2100, -720],
        ['au-dessus de l\'objectif', 2250, 2100, 150],
        ['exactement l\'objectif', 2100, 2100, 0],
        ['sans objectif', 450, 0, 450],
        ['semaine vide', 0, 2100, -2100]
    ])('%s : %i - %i = %i', (_label, total, target, expected) => {
        expect(computeDelta(total, target)).toBe(expected);
    });
});
