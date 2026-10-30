import type { Repository } from 'typeorm';
import type { PreferencesService } from '../preferences/preferences.service.js';
import { Period } from './entities/period.entity.js';
import { PERIOD_TYPE } from './period-types.js';
import { WeeklyReportService } from './weekly-report.service.js';

const FROM_CLAUSE = 'period.start >= (CAST(:from AS timestamp) AT TIME ZONE :tz)';
const TO_CLAUSE = 'period.start < (CAST(:to AS timestamp) AT TIME ZONE :tz)';

interface Row {
    id: number;
    start: Date;
    end: Date | null;
    subPeriods: { id: number; start: Date; end: Date | null; periodType: { id: number } }[];
}

const row = (id: number, start: string, end: string | null, subPeriods: Row['subPeriods'] = []): Row => ({
    id,
    start: new Date(start),
    end: end === null ? null : new Date(end),
    subPeriods
});

function createService(rows: Row[] = [], now = '2026-01-20T12:00:00Z', target = 2100) {
    const builder = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue(rows)
    };
    const repository = {
        createQueryBuilder: vi.fn().mockReturnValue(builder)
    };
    const preferences = {
        getWeeklyTargetMinutes: vi.fn().mockResolvedValue(target)
    };

    const service = new WeeklyReportService(
        repository as unknown as Repository<Period>,
        { now: () => new Date(now) },
        preferences as unknown as PreferencesService
    );
    return { service, builder, repository, preferences };
}

describe('WeeklyReportService.weekly : requête', () => {
    it('demande à PostgreSQL les bornes [lundi, lundi suivant[ à Europe/Paris', async () => {
        const { service, builder, repository } = createService();

        await service.weekly('2026-01-07');

        expect(repository.createQueryBuilder).toHaveBeenCalledWith('period');
        expect(builder.where).toHaveBeenCalledWith(FROM_CLAUSE, { from: '2026-01-05', tz: 'Europe/Paris' });
        expect(builder.andWhere).toHaveBeenCalledWith(TO_CLAUSE, { to: '2026-01-12', tz: 'Europe/Paris' });
    });

    it('charge les pauses et leur type, triées par début', async () => {
        const { service, builder } = createService();

        await service.weekly('2026-01-07');

        expect(builder.leftJoinAndSelect).toHaveBeenCalledWith('period.subPeriods', 'sub');
        expect(builder.leftJoinAndSelect).toHaveBeenCalledWith('sub.periodType', 'subType');
        expect(builder.orderBy).toHaveBeenCalledWith('period.start', 'ASC');
        expect(builder.addOrderBy).toHaveBeenCalledWith('sub.start', 'ASC');
    });

    it.each([
        ['un lundi', '2026-01-05'],
        ['un mercredi', '2026-01-07'],
        ['un dimanche', '2026-01-11']
    ])('la même semaine quel que soit le jour demandé : %s', async (_label, date) => {
        const { service, builder } = createService();

        const report = await service.weekly(date);

        expect(report.weekStart).toBe('2026-01-05');
        expect(builder.where).toHaveBeenCalledWith(FROM_CLAUSE, { from: '2026-01-05', tz: 'Europe/Paris' });
    });

    it('passe les jours calendaires, jamais des instants, même à l\'heure d\'été', async () => {
        const { service, builder } = createService();

        await service.weekly('2026-03-25');

        expect(builder.where).toHaveBeenCalledWith(FROM_CLAUSE, { from: '2026-03-23', tz: 'Europe/Paris' });
        expect(builder.andWhere).toHaveBeenCalledWith(TO_CLAUSE, { to: '2026-03-30', tz: 'Europe/Paris' });
    });
});

describe('WeeklyReportService.weekly : semaine par défaut', () => {
    it.each([
        ['mercredi midi', '2026-01-07T12:00:00Z', '2026-01-05'],
        ['dimanche 23:30 à Paris', '2026-01-11T22:30:00Z', '2026-01-05'],
        ['lundi 00:30 à Paris (encore dimanche en UTC)', '2026-01-11T23:30:00Z', '2026-01-12'],
        ['lundi 00:30 à Paris, une semaine plus tôt', '2026-01-04T23:30:00Z', '2026-01-05'],
        ['dimanche 23:30 à Paris, en été', '2026-07-05T21:30:00Z', '2026-06-29']
    ])('sans paramètre : %s -> semaine du %s', async (_label, now, expectedWeek) => {
        const { service } = createService([], now);

        const report = await service.weekly();

        expect(report.weekStart).toBe(expectedWeek);
    });
});

describe('WeeklyReportService.weekly : réponse', () => {
    it('renseigne le fuseau, les bornes et les semaines voisines', async () => {
        const { service } = createService();

        const report = await service.weekly('2026-01-07');

        expect(report).toMatchObject({
            timeZone: 'Europe/Paris',
            weekStart: '2026-01-05',
            weekEnd: '2026-01-11',
            previousWeekStart: '2025-12-29',
            nextWeekStart: '2026-01-12'
        });
        expect(report.days).toHaveLength(7);
    });

    it('calcule les semaines voisines à travers un changement d\'année et d\'heure', async () => {
        const { service } = createService();

        const march = await service.weekly('2026-03-29');
        const october = await service.weekly('2026-10-25');

        expect([march.weekStart, march.weekEnd, march.previousWeekStart, march.nextWeekStart])
            .toEqual(['2026-03-23', '2026-03-29', '2026-03-16', '2026-03-30']);
        expect([october.weekStart, october.weekEnd, october.previousWeekStart, october.nextWeekStart])
            .toEqual(['2026-10-19', '2026-10-25', '2026-10-12', '2026-10-26']);
    });

    it('ajoute l\'objectif et l\'écart', async () => {
        const { service, preferences } = createService([
            row(1, '2026-01-05T08:00:00Z', '2026-01-05T11:00:00Z'),
            row(2, '2026-01-07T07:00:00Z', '2026-01-07T14:30:00Z')
        ], '2026-01-20T12:00:00Z', 2100);

        const report = await service.weekly('2026-01-07');

        expect(preferences.getWeeklyTargetMinutes).toHaveBeenCalledTimes(1);
        expect(report.totalMinutes).toBe(630);
        expect(report.targetMinutes).toBe(2100);
        expect(report.deltaMinutes).toBe(-1470);
    });

    it('un écart positif quand l\'objectif est dépassé', async () => {
        const { service } = createService([
            row(1, '2026-01-05T08:00:00Z', '2026-01-05T11:00:00Z')
        ], '2026-01-20T12:00:00Z', 120);

        const report = await service.weekly('2026-01-07');

        expect(report.deltaMinutes).toBe(60);
    });

    it('une semaine vide : sept zéros, aucune session ouverte, écart = -objectif', async () => {
        const { service } = createService([], '2026-01-20T12:00:00Z', 2100);

        const report = await service.weekly('2030-06-12');

        expect(report.days.every((day) => day.workedMinutes === 0 && day.sessionCount === 0)).toBe(true);
        expect(report.totalMinutes).toBe(0);
        expect(report.deltaMinutes).toBe(-2100);
        expect(report.incompleteSessions).toEqual([]);
    });
});

describe('WeeklyReportService.weekly : sessions', () => {
    it('range une session de dimanche 23:30 (Paris) sur le dimanche de la bonne semaine', async () => {
        const { service } = createService([
            row(1, '2026-01-11T22:30:00Z', '2026-01-11T22:50:00Z') // Sunday 23:30 -> 23:50 in Paris
        ]);

        const report = await service.weekly('2026-01-07');

        expect(report.days[6]).toEqual({ date: '2026-01-11', workedMinutes: 20, sessionCount: 1 });
    });

    it('range une session de lundi 00:30 (Paris) sur le lundi, pas sur le dimanche UTC', async () => {
        const { service } = createService([
            row(1, '2026-01-04T23:30:00Z', '2026-01-05T00:30:00Z')
        ]);

        const report = await service.weekly('2026-01-07');

        expect(report.days[0]).toEqual({ date: '2026-01-05', workedMinutes: 60, sessionCount: 1 });
    });

    it('signale une session ouverte sans la compter', async () => {
        const { service } = createService([
            row(1, '2026-01-05T08:00:00Z', '2026-01-05T09:00:00Z'),
            row(12, '2026-01-09T07:00:00Z', null)
        ]);

        const report = await service.weekly('2026-01-07');

        expect(report.totalMinutes).toBe(60);
        expect(report.incompleteSessions).toEqual([
            { id: 12, date: '2026-01-09', start: '2026-01-09T07:00:00.000Z' }
        ]);
    });

    it('déduit les pauses : il faut que le service transmette le type de chaque pause', async () => {
        // If the mapping of the sub periods lost their type, nothing would be deducted
        const { service } = createService([
            row(5, '2026-01-08T12:00:00Z', '2026-01-08T16:30:00Z', [
                { id: 1, start: new Date('2026-01-08T14:00:00Z'), end: new Date('2026-01-08T14:15:00Z'), periodType: { id: PERIOD_TYPE.BREAK } }
            ])
        ]);

        const report = await service.weekly('2026-01-07');

        expect(report.days[3].workedMinutes).toBe(255); // 270 - 15
    });

    it('ne déduit pas les veilles : elles comptent comme du travail', async () => {
        const { service } = createService([
            row(5, '2026-01-08T12:00:00Z', '2026-01-08T16:30:00Z', [
                { id: 1, start: new Date('2026-01-08T14:00:00Z'), end: new Date('2026-01-08T14:15:00Z'), periodType: { id: PERIOD_TYPE.BREAK } },
                { id: 2, start: new Date('2026-01-08T15:00:00Z'), end: new Date('2026-01-08T15:10:00Z'), periodType: { id: PERIOD_TYPE.SCOUTING } }
            ])
        ]);

        const report = await service.weekly('2026-01-07');

        expect(report.days[3].workedMinutes).toBe(255); // 270 - 15 (the scouting is not deducted)
    });


    it('transmet l\'erreur de la base', async () => {
        const { service, builder } = createService();
        builder.getMany.mockRejectedValueOnce(new Error('connection lost'));

        await expect(service.weekly('2026-01-07')).rejects.toThrow('connection lost');
    });
});
