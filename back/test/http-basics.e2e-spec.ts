import { createTestApp, type TestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-database.js';
import { FakeClock } from './support/fake-clock.js';
import {
    countRows,
    readPeriods,
    readSubPeriods,
    readWeeklyTarget,
} from './support/queries.js';

describe('API HTTP sur une vraie base', () => {
    let ctx: TestApp;

    beforeAll(async () => {
        ctx = await createTestApp({ clock: new FakeClock() });
    });
    beforeEach(() => resetDatabase(ctx.dataSource));
    afterAll(() => ctx?.app.close());

    it("part d'une base vide, avec les données de référence des migrations", async () => {
        expect(await countRows(ctx.dataSource, 'period')).toBe(0);
        expect(await countRows(ctx.dataSource, 'sub_period')).toBe(0);
        expect(await countRows(ctx.dataSource, 'period_type')).toBe(3);
        expect(await readWeeklyTarget(ctx.dataSource)).toEqual({
            minutes: 2100,
            timeZone: 'Europe/Paris',
        });
    });

    it('POST /api/sessions écrit la session et ses sous-périodes en base', async () => {
        const response = await ctx.api
            .post('/api/sessions')
            .send({
                start: '2026-10-21T08:00:00Z',
                end: '2026-10-21T12:00:00Z',
                note: 'Revue de code',
                subs: [
                    {
                        periodTypeId: 2,
                        start: '2026-10-21T10:00:00Z',
                        end: '2026-10-21T10:30:00Z',
                    },
                ],
            })
            .expect(201);

        // On relit PostgreSQL, pas la réponse de l'API.
        const [period] = await readPeriods(ctx.dataSource);
        expect(period).toMatchObject({
            id: response.body.id,
            note: 'Revue de code',
        });
        expect(period.start.toISOString()).toBe('2026-10-21T08:00:00.000Z');
        expect(period.end?.toISOString()).toBe('2026-10-21T12:00:00.000Z');

        const subs = await readSubPeriods(ctx.dataSource);
        expect(subs).toHaveLength(1);
        expect(subs[0].periodId).toBe(period.id);
        expect(subs[0].periodTypeId).toBe(2);
        expect(subs[0].end?.toISOString()).toBe('2026-10-21T10:30:00.000Z');
    });

    it("PUT /api/preferences/weekly-target modifie l'objectif et lui seul", async () => {
        await ctx.api
            .put('/api/preferences/weekly-target')
            .send({ minutes: 2250 })
            .expect(200, { minutes: 2250 });

        expect(await readWeeklyTarget(ctx.dataSource)).toEqual({
            minutes: 2250,
            timeZone: 'Europe/Paris',
        });
    });

    it("refuse une propriété inconnue (400) : la validation est active et rien n'est écrit", async () => {
        const response = await ctx.api
            .put('/api/preferences/weekly-target')
            .send({ minutes: 2250, surprise: true })
            .expect(400);

        expect(response.body.message).toContain(
            'property surprise should not exist',
        );
        expect((await readWeeklyTarget(ctx.dataSource)).minutes).toBe(2100);
    });
});
