import { PERIOD_TYPE } from './period-types.js';
import { buildWeeklyTotals, computeDelta } from './weekly-report.js';
import type { WeeklySession } from './weekly-report.js';

const WEEK_A = '2026-01-05';
const WEEK_B = '2026-01-12';
const NOW = new Date('2026-01-20T12:00:00Z');

// January is UTC+1 in Paris: '09:00' on the 5th is 08:00Z
const paris = (day: string, time: string) => new Date(`2026-01-${day}T${time}:00+01:00`);

const session = (id: number, day: string, from: string, to: string | null): WeeklySession => ({
    id,
    start: paris(day, from),
    end: to === null ? null : paris(day, to),
    subs: []
});

const sessionAt = (id: number, start: string, end: string | null): WeeklySession => ({
    id,
    start: new Date(start),
    end: end === null ? null : new Date(end),
    subs: []
});

const minutesOf = (totals: ReturnType<typeof buildWeeklyTotals>) =>
    totals.days.map((day) => day.workedMinutes);
const countsOf = (totals: ReturnType<typeof buildWeeklyTotals>) =>
    totals.days.map((day) => day.sessionCount);

// The reference data set, computable by hand (see check-weekly.mjs)
const S1 = session(1, '05', '00:30', '01:30'); // Monday 00:30 Paris = Sunday 23:30Z
const S2 = session(2, '05', '09:00', '12:00');
const S3 = session(3, '07', '08:00', '15:30');
const S4 = session(4, '08', '09:00', '12:00');
const S5: WeeklySession = {
    ...session(5, '08', '13:00', '17:30'),
    subs: [{ periodTypeId: PERIOD_TYPE.BREAK, start: paris('08', '15:00'), end: paris('08', '15:15') }]
};
const S6: WeeklySession = { // Sunday 21:00 -> Monday 01:00, counted on Sunday
    id: 6,
    start: paris('11', '21:00'),
    end: paris('12', '01:00'),
    subs: []
};
const S7 = session(7, '12', '09:00', '10:00');
const DATA_SET = [S1, S2, S3, S4, S5, S6, S7];

describe('buildWeeklyTotals', () => {
    it('retourne sept jours à zéro pour une semaine vide', () => {
        const totals = buildWeeklyTotals(WEEK_A, [], NOW);

        expect(totals.days.map((day) => day.date)).toEqual([
            '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08',
            '2026-01-09', '2026-01-10', '2026-01-11'
        ]);
        expect(totals.days.every((day) => day.workedMinutes === 0 && day.sessionCount === 0)).toBe(true);
        expect(totals.totalMinutes).toBe(0);
        expect(totals.incompleteSessions).toEqual([]);
    });

    it('additionne les sessions d\'un même jour', () => {
        const totals = buildWeeklyTotals(WEEK_A, [
            session(1, '05', '09:00', '12:00'),
            session(2, '05', '13:00', '14:30')
        ], NOW);

        expect(totals.days[0]).toEqual({ date: '2026-01-05', workedMinutes: 270, sessionCount: 2 });
        expect(totals.totalMinutes).toBe(270);
    });

    it('ne compte pas une session ouverte et la signale', () => {
        const totals = buildWeeklyTotals(WEEK_A, [
            session(1, '05', '09:00', '10:00'),
            session(2, '09', '08:00', null)
        ], NOW);

        expect(totals.totalMinutes).toBe(60);
        expect(totals.days[4]).toEqual({ date: '2026-01-09', workedMinutes: 0, sessionCount: 0 });
        expect(totals.incompleteSessions).toEqual([
            { id: 2, date: '2026-01-09', start: '2026-01-09T07:00:00.000Z' }
        ]);
    });

    it('n\'utilise pas now pour une session ouverte : elle ne pèse rien même après des jours', () => {
        const open = session(2, '09', '08:00', null);

        const soon = buildWeeklyTotals(WEEK_A, [open], new Date('2026-01-09T08:00:00Z'));
        const later = buildWeeklyTotals(WEEK_A, [open], new Date('2026-03-01T08:00:00Z'));

        expect(soon.totalMinutes).toBe(0);
        expect(later.totalMinutes).toBe(0);
    });
});

describe('buildWeeklyTotals : jeu de données calculable à la main', () => {
    it.each([
        ['semaine A', WEEK_A, [240, 0, 450, 435, 0, 0, 240], [2, 0, 1, 2, 0, 0, 1], 1365],
        ['semaine B', WEEK_B, [60, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0, 0], 60]
    ])('%s', (_label, week, minutes, counts, total) => {
        // The whole data set is given each time: sessions of the other week are ignored
        const totals = buildWeeklyTotals(week, DATA_SET, NOW);

        expect(minutesOf(totals)).toEqual(minutes);
        expect(countsOf(totals)).toEqual(counts);
        expect(totals.totalMinutes).toBe(total);
    });

    it('déduit les pauses par défaut (jeudi : 255 + 180 = 435)', () => {
        const totals = buildWeeklyTotals(WEEK_A, [S4, S5], NOW);

        expect(totals.days[3].workedMinutes).toBe(435);
    });

    it('ne déduit rien quand le paramètre deducted est vide (jeudi 450, total 1380)', () => {
        const totals = buildWeeklyTotals(WEEK_A, DATA_SET, NOW, []);

        expect(totals.days[3].workedMinutes).toBe(450);
        expect(totals.totalMinutes).toBe(1380);
    });

    it('session 09:00-17:30 avec une pause 12:30-13:30 : 7h30, puis 7h45 si la pause est corrigée à 12:30-13:15', () => {
        const withBreak = (end: string): WeeklySession => ({
            ...session(8, '06', '09:00', '17:30'),
            subs: [{ periodTypeId: PERIOD_TYPE.BREAK, start: paris('06', '12:30'), end: paris('06', end) }]
        });

        const before = buildWeeklyTotals(WEEK_A, [withBreak('13:30')], NOW);
        const after = buildWeeklyTotals(WEEK_A, [withBreak('13:15')], NOW);

        expect(before.days[1].workedMinutes).toBe(450);
        expect(after.days[1].workedMinutes).toBe(465);
        expect(after.totalMinutes - before.totalMinutes).toBe(15);
    });

    it('compte la session qui franchit minuit le dimanche, jour de son début, et pas dans la semaine suivante', () => {
        const a = buildWeeklyTotals(WEEK_A, [S6], NOW);
        const b = buildWeeklyTotals(WEEK_B, [S6], NOW);

        expect(a.days[6]).toEqual({ date: '2026-01-11', workedMinutes: 240, sessionCount: 1 });
        expect(b.totalMinutes).toBe(0);
        expect(b.days[0].sessionCount).toBe(0);
    });

    it('ne déduit que les types demandés (une veille n\'est pas une pause)', () => {
        const withScouting: WeeklySession = {
            ...S5,
            subs: [{ periodTypeId: PERIOD_TYPE.SCOUTING, start: paris('08', '15:00'), end: paris('08', '15:15') }]
        };

        const totals = buildWeeklyTotals(WEEK_A, [withScouting], NOW, [PERIOD_TYPE.BREAK]);

        expect(totals.days[3].workedMinutes).toBe(270);
    });
});

describe('buildWeeklyTotals : frontière dimanche / lundi à Paris', () => {
    it.each([
        ['dimanche 23:59:59.999 (hiver)', '2026-01-11T22:59:59.999Z', 6, '2026-01-05'],
        ['lundi 00:00:00.000 (hiver)', '2026-01-11T23:00:00.000Z', 0, '2026-01-12'],
        ['dimanche 23:59:59.999 (été)', '2026-07-05T21:59:59.999Z', 6, '2026-06-29'],
        ['lundi 00:00:00.000 (été)', '2026-07-05T22:00:00.000Z', 0, '2026-07-06'],
        ['dimanche 23:30 (été)', '2026-07-05T21:30:00.000Z', 6, '2026-06-29']
    ])('%s : jour %i de la semaine du %s', (_label, start, dayIndex, week) => {
        const startMs = new Date(start).getTime();
        const only = sessionAt(1, start, new Date(startMs + 60_000).toISOString());

        const totals = buildWeeklyTotals(week, [only], NOW);

        expect(totals.days[dayIndex].sessionCount).toBe(1);
        expect(totals.days[dayIndex].workedMinutes).toBe(1);
        expect(totals.totalMinutes).toBe(1);
    });
});

describe('buildWeeklyTotals : le piège UTC', () => {
    // Monday 05/01 00:30 in Paris is still Sunday 04/01 in UTC
    const trap = sessionAt(1, '2026-01-04T23:30:00Z', '2026-01-05T00:30:00Z');

    it('range une session de lundi 00:30 (Paris) le lundi, pas le dimanche d\'avant', () => {
        const current = buildWeeklyTotals(WEEK_A, [trap], NOW);
        const previous = buildWeeklyTotals('2025-12-29', [trap], NOW);

        expect(current.days[0]).toEqual({ date: '2026-01-05', workedMinutes: 60, sessionCount: 1 });
        expect(previous.totalMinutes).toBe(0);
        expect(previous.days[6].sessionCount).toBe(0);
    });
});

describe('buildWeeklyTotals : changements d\'heure', () => {
    it('passage à l\'heure d\'hiver : 01:30 CEST -> 03:30 CET dure 180 minutes réelles', () => {
        const long = sessionAt(1, '2026-10-24T23:30:00Z', '2026-10-25T02:30:00Z'); // 01:30 CEST -> 03:30 CET

        const totals = buildWeeklyTotals('2026-10-19', [long], NOW);

        expect(totals.days[6]).toEqual({ date: '2026-10-25', workedMinutes: 180, sessionCount: 1 });
    });

    it('passage à l\'heure d\'été : 01:30 CET -> 03:30 CEST dure 60 minutes réelles', () => {
        const short = sessionAt(1, '2026-03-29T00:30:00Z', '2026-03-29T01:30:00Z'); // 01:30 CET -> 03:30 CEST

        const totals = buildWeeklyTotals('2026-03-23', [short], NOW);

        expect(totals.days[6]).toEqual({ date: '2026-03-29', workedMinutes: 60, sessionCount: 1 });
    });

    it('la semaine de 167h (mars) comme celle de 169h (octobre) comptent sept jours', () => {
        expect(buildWeeklyTotals('2026-03-23', [], NOW).days).toHaveLength(7);
        expect(buildWeeklyTotals('2026-10-19', [], NOW).days).toHaveLength(7);
    });

    it('une session du lundi qui suit le changement d\'heure est dans la semaine suivante', () => {
        const monday = sessionAt(1, '2026-03-29T22:00:00Z', '2026-03-29T23:00:00Z'); // Monday 30/03 00:00 CEST

        expect(buildWeeklyTotals('2026-03-23', [monday], NOW).totalMinutes).toBe(0);
        expect(buildWeeklyTotals('2026-03-30', [monday], NOW).days[0].workedMinutes).toBe(60);
    });
});

describe('buildWeeklyTotals : arrondi', () => {
    it('additionne les millisecondes d\'un jour avant d\'arrondir : 90 s + 90 s = 3 min', () => {
        const totals = buildWeeklyTotals(WEEK_A, [
            sessionAt(1, '2026-01-05T08:00:00Z', '2026-01-05T08:01:30Z'),
            sessionAt(2, '2026-01-05T09:00:00Z', '2026-01-05T09:01:30Z')
        ], NOW);

        expect(totals.days[0].workedMinutes).toBe(3);
    });

    it('arrondit à la minute inférieure : 59,999 s = 0 min', () => {
        const totals = buildWeeklyTotals(WEEK_A, [
            sessionAt(1, '2026-01-05T08:00:00.000Z', '2026-01-05T08:00:59.999Z')
        ], NOW);

        expect(totals.days[0]).toEqual({ date: '2026-01-05', workedMinutes: 0, sessionCount: 1 });
    });

    it('arrondit jour par jour : le total est la somme des minutes affichées', () => {
        // 40 s on three different days: 0 min each, so 0 min in total (not floor(120 s) = 2)
        const forty = (day: string) =>
            sessionAt(Number(day), `2026-01-${day}T08:00:00Z`, `2026-01-${day}T08:00:40Z`);

        const totals = buildWeeklyTotals(WEEK_A, [forty('05'), forty('06'), forty('07')], NOW);

        expect(minutesOf(totals)).toEqual([0, 0, 0, 0, 0, 0, 0]);
        expect(totals.totalMinutes).toBe(0);
    });

    it('le total est toujours la somme des sept jours', () => {
        const totals = buildWeeklyTotals(WEEK_A, DATA_SET, NOW);

        expect(totals.totalMinutes).toBe(minutesOf(totals).reduce((sum, minutes) => sum + minutes, 0));
    });
});

describe('buildWeeklyTotals : sessions hors semaine', () => {
    it('ignore une session dont le jour de début est hors de la semaine', () => {
        const totals = buildWeeklyTotals(WEEK_A, [
            session(1, '04', '09:00', '10:00'),
            session(2, '12', '09:00', '10:00'),
            session(3, '07', '09:00', '10:00')
        ], NOW);

        expect(totals.totalMinutes).toBe(60);
        expect(totals.days[2].sessionCount).toBe(1);
    });

    it('ignore aussi une session ouverte hors semaine', () => {
        const totals = buildWeeklyTotals(WEEK_A, [session(1, '14', '09:00', null)], NOW);

        expect(totals.incompleteSessions).toEqual([]);
    });
});

describe('buildWeeklyTotals : dates extrêmes', () => {
    it.each([
        ['le 1er janvier de l\'an 1', '0001-01-01T10:00:00Z', '0001-01-01', 0],
        ['la fin de l\'an 999', '0999-12-31T10:00:00Z', '0999-12-30', 1],
        ['la fin de l\'an 9998', '9998-12-31T10:00:00Z', '9998-12-28', 3]
    ])('compte une session de %s', (_label, start, week, dayIndex) => {
        const hourLater = new Date(new Date(start).getTime() + 3_600_000).toISOString();

        const totals = buildWeeklyTotals(week, [sessionAt(1, start, hourLater)], NOW);

        expect(totals.days[dayIndex].sessionCount).toBe(1);
        expect(totals.totalMinutes).toBe(60);
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
