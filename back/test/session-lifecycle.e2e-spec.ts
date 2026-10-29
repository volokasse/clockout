import { QueryFailedError } from 'typeorm';
import { createTestApp, type TestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-database.js';
import { FakeClock } from './support/fake-clock.js';
import { countRows, readPeriods, readSubPeriods } from './support/queries.js';
import { isUniqueViolation } from '../src/time-tracking/is-unique-violation.js';

const BREAK = 2;
const ROUNDS = 10;

describe('cycle de pointage et unicité de la session ouverte', () => {
    const clock = new FakeClock();
    let ctx: TestApp;

    beforeAll(async () => {
        ctx = await createTestApp({ clock });
    });
    beforeEach(async () => {
        clock.reset();
        await resetDatabase(ctx.dataSource);
    });
    afterAll(async () => {
        await ctx?.app.close();
    });

    it("conserve en base les horaires et la pause d'un cycle complet", async () => {
        await ctx.api.post('/api/time-tracking/start').expect(201); // 09:00
        clock.advanceMinutes(60);
        await ctx.api
            .post('/api/time-tracking/sub')
            .send({ periodTypeId: BREAK })
            .expect(200); // 10:00
        clock.advanceMinutes(15);
        await ctx.api.post('/api/time-tracking/endsub').expect(200); // 10:15
        clock.advanceMinutes(105);
        const end = await ctx.api.post('/api/time-tracking/end').expect(200); // 12:00

        const [period] = await readPeriods(ctx.dataSource);
        expect(period.start.toISOString()).toBe('2026-10-22T09:00:00.000Z');
        expect(period.end?.toISOString()).toBe('2026-10-22T12:00:00.000Z');

        const subs = await readSubPeriods(ctx.dataSource);
        expect(subs).toHaveLength(1);
        expect(subs[0]).toMatchObject({ periodId: period.id, periodTypeId: BREAK });
        expect(subs[0].start.toISOString()).toBe('2026-10-22T10:00:00.000Z');
        expect(subs[0].end?.toISOString()).toBe('2026-10-22T10:15:00.000Z');

        // 3 h de présence moins 15 min de pause
        expect(end.body.workedMs).toBe(165 * 60_000);
        const current = await ctx.api.get('/api/time-tracking/current').expect(200);
        expect(current.body.status).toBe('none');
    });

    it('refuse un second démarrage séquentiel (409) sans rien écrire', async () => {
        await ctx.api.post('/api/time-tracking/start').expect(201);
        await ctx.api.post('/api/time-tracking/start').expect(409);

        expect(await countRows(ctx.dataSource, 'period')).toBe(1);
    });

    it(`deux démarrages simultanés ne créent qu'une session ouverte (${ROUNDS} manches)`, async () => {
        const runRound = async (round: number): Promise<void> => {
            if (round > ROUNDS) return;

            await resetDatabase(ctx.dataSource);

            const responses = await Promise.all([
                ctx.api.post('/api/time-tracking/start'),
                ctx.api.post('/api/time-tracking/start'),
            ]);
            const statuses = responses
                .map((response) => response.status)
                .sort((a, b) => a - b);
            expect(statuses, `manche ${round}`).toEqual([201, 409]);

            // On relit la base : un code HTTP ne prouve pas ce qui est stocké.
            const periods = await readPeriods(ctx.dataSource);
            expect(periods, `manche ${round}`).toHaveLength(1);
            expect(periods[0].end, `manche ${round}`).toBeNull();

            await runRound(round + 1);
        };

        await runRound(1);
    });

    it("PostgreSQL refuse deux sessions ouvertes, même sans passer par l'API", async () => {
        const insertOpenPeriod = () =>
            ctx.dataSource.query('INSERT INTO period ("periodTypeId") VALUES (1)');
        await insertOpenPeriod();

        const error = await insertOpenPeriod().catch((e: unknown) => e);

        expect(error).toBeInstanceOf(QueryFailedError);
        expect(isUniqueViolation(error)).toBe(true);
        expect((error as QueryFailedError).driverError).toMatchObject({
            code: '23505',
            constraint: 'UQ_period_single_open',
        });
        expect(await countRows(ctx.dataSource, 'period')).toBe(1);
    });

    it('PostgreSQL refuse deux pauses ouvertes dans la même session', async () => {
        await ctx.dataSource.query(
            'INSERT INTO period ("periodTypeId") VALUES (1)',
        );
        const [period] = await readPeriods(ctx.dataSource);
        const insertOpenSub = () =>
            ctx.dataSource.query(
                'INSERT INTO sub_period ("periodId", "periodTypeId") VALUES ($1, $2)',
                [period.id, BREAK],
            );
        await insertOpenSub();

        const error = await insertOpenSub().catch((e: unknown) => e);

        expect(isUniqueViolation(error)).toBe(true);
        expect((error as QueryFailedError).driverError).toMatchObject({
            constraint: 'UQ_sub_period_single_open',
        });
    });
});
