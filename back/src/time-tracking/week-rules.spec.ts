import { addDays, isCalendarDate, localDateOf, mondayOf, REPORT_TIME_ZONE, weekDays } from './week-rules.js';

describe('mondayOf', () => {
    it.each([
        ['un lundi reste lui-même', '2026-01-05', '2026-01-05'],
        ['un mardi', '2026-01-06', '2026-01-05'],
        ['un jeudi', '2026-01-08', '2026-01-05'],
        ['un dimanche appartient à la semaine qui finit', '2026-01-11', '2026-01-05'],
        ['le lundi suivant ouvre une nouvelle semaine', '2026-01-12', '2026-01-12'],
        ['un jeudi 1er janvier retombe sur l\'année précédente', '2026-01-01', '2025-12-29'],
        ['le 29 février 2028 (un mardi)', '2028-02-29', '2028-02-28'],
        ['le dimanche du passage à l\'heure d\'été', '2026-03-29', '2026-03-23'],
        ['le dimanche du passage à l\'heure d\'hiver', '2026-10-25', '2026-10-19']
    ])('%s : %s -> %s', (_label, date, expected) => {
        expect(mondayOf(date)).toBe(expected);
    });
});

describe('addDays', () => {
    it.each([
        ['fin de mois', '2026-01-31', 1, '2026-02-01'],
        ['fin d\'année', '2026-12-31', 1, '2027-01-01'],
        ['29 février d\'une année bissextile', '2028-02-28', 1, '2028-02-29'],
        ['après le 29 février', '2028-02-29', 1, '2028-03-01'],
        ['fin février d\'une année ordinaire', '2027-02-28', 1, '2027-03-01'],
        ['semaine précédente', '2026-01-05', -7, '2025-12-29'],
        ['semaine suivante', '2026-01-05', 7, '2026-01-12'],
        ['la veille du passage à l\'heure d\'été', '2026-03-28', 1, '2026-03-29'],
        ['le lendemain du passage à l\'heure d\'été', '2026-03-29', 1, '2026-03-30'],
        ['le lendemain du passage à l\'heure d\'hiver', '2026-10-25', 1, '2026-10-26'],
        ['zéro jour', '2026-01-05', 0, '2026-01-05']
    ])('%s : %s %i jour(s) -> %s', (_label, date, days, expected) => {
        expect(addDays(date, days)).toBe(expected);
    });
});

describe('weekDays', () => {
    it('retourne sept jours, du lundi au dimanche', () => {
        expect(weekDays('2026-01-05')).toEqual([
            '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08',
            '2026-01-09', '2026-01-10', '2026-01-11'
        ]);
    });

    it('reste à sept jours calendaires pendant la semaine du changement d\'heure', () => {
        expect(weekDays('2026-03-23')).toEqual([
            '2026-03-23', '2026-03-24', '2026-03-25', '2026-03-26',
            '2026-03-27', '2026-03-28', '2026-03-29'
        ]);
        expect(weekDays('2026-10-19')).toHaveLength(7);
        expect(weekDays('2026-10-19')[6]).toBe('2026-10-25');
    });
});

describe('localDateOf', () => {
    it('utilise Europe/Paris par défaut', () => {
        expect(REPORT_TIME_ZONE).toBe('Europe/Paris');
        expect(localDateOf(new Date('2026-01-04T23:30:00Z'))).toBe('2026-01-05');
    });

    it.each([
        ['lundi 00:30 à Paris = dimanche 23:30 UTC', '2026-01-04T23:30:00Z', '2026-01-05'],
        ['dimanche 23:59:59 à Paris (hiver)', '2026-01-11T22:59:59Z', '2026-01-11'],
        ['lundi 00:00 à Paris (hiver)', '2026-01-11T23:00:00Z', '2026-01-12'],
        ['dimanche 23:59:59 à Paris (été)', '2026-07-05T21:59:59Z', '2026-07-05'],
        ['lundi 00:00 à Paris (été)', '2026-07-05T22:00:00Z', '2026-07-06'],
        ['dimanche 23:30 à Paris (été)', '2026-07-05T21:30:00Z', '2026-07-05'],
        ['dimanche 00:00 du passage à l\'heure d\'été', '2026-03-28T23:00:00Z', '2026-03-29'],
        ['dimanche 23:59:59 du passage à l\'heure d\'été', '2026-03-29T21:59:59Z', '2026-03-29'],
        ['lundi 00:00 après le passage à l\'heure d\'été', '2026-03-29T22:00:00Z', '2026-03-30'],
        ['dimanche 23:59:59 du passage à l\'heure d\'hiver', '2026-10-25T22:59:59Z', '2026-10-25'],
        ['lundi 00:00 après le passage à l\'heure d\'hiver', '2026-10-25T23:00:00Z', '2026-10-26'],
        ['le 29 février 2028', '2028-02-29T12:00:00Z', '2028-02-29'],
        ['la première année, complétée à quatre chiffres', '0001-01-01T12:00:00Z', '0001-01-01'],
        ['une année avant 1000, complétée à quatre chiffres', '0999-12-31T12:00:00Z', '0999-12-31'],
        ['la dernière année acceptée', '9998-12-31T12:00:00Z', '9998-12-31']
    ])('%s : %s -> %s', (_label, instant, expected) => {
        expect(localDateOf(new Date(instant))).toBe(expected);
    });

    it('accepte un autre fuseau', () => {
        const instant = new Date('2026-01-04T23:30:00Z');

        expect(localDateOf(instant, 'UTC')).toBe('2026-01-04');
        expect(localDateOf(instant, 'Asia/Tokyo')).toBe('2026-01-05');
        expect(localDateOf(instant, 'America/Los_Angeles')).toBe('2026-01-04');
    });
});

describe('isCalendarDate', () => {
    it.each(['2026-01-05', '2026-12-31', '2028-02-29', '2000-02-29', '0001-01-01', '9998-12-31'])('accepte %s', (value) => {
        expect(isCalendarDate(value)).toBe(true);
    });

    it.each([
        ['2026-02-31'],
        ['2027-02-29'],
        ['2100-02-29'],
        ['2026-13-01'],
        ['2026-00-10'],
        ['2026-01-00'],
        ['2026-01-32'],
        ['2026-1-5'],
        ['20260105'],
        ['abc'],
        [''],
        [' 2026-01-05'],
        ['2026-01-05T10:00:00Z'],
        ['0000-01-01'],
        ['9999-01-01']
    ])('refuse %j', (value) => {
        expect(isCalendarDate(value)).toBe(false);
    });
});
