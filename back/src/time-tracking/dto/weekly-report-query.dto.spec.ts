import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { WeeklyReportQueryDto } from './weekly-report-query.dto.js';

const errorsFor = (query: object) => validate(plainToInstance(WeeklyReportQueryDto, query));

describe('WeeklyReportQueryDto', () => {
    it.each([
        ['une date réelle', { date: '2026-01-07' }],
        ['un 29 février bissextile', { date: '2028-02-29' }],
        ['aucune date', {}],
        ['une date absente (undefined)', { date: undefined }]
    ])('accepte %s', async (_label, query) => {
        expect(await errorsFor(query)).toHaveLength(0);
    });

    it.each([
        ['un jour inexistant', '2026-02-31'],
        ['un 29 février non bissextile', '2027-02-29'],
        ['un mois inexistant', '2026-13-01'],
        ['du texte', 'abc'],
        ['une date sans zéro initial', '2026-1-5'],
        ['une date sans tirets', '20260105'],
        ['un instant complet', '2026-01-05T10:00:00Z'],
        ['une chaîne vide', ''],
        ['une liste de dates', ['2026-01-05', '2026-01-06']]
    ])('refuse %s', async (_label, date) => {
        const errors = await errorsFor({ date });

        expect(errors).toHaveLength(1);
        expect(errors[0].property).toBe('date');
    });
});
