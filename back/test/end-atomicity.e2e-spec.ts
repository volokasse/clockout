import { EntityManager } from 'typeorm';
import { createTestApp, type TestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-database.js';
import { FakeClock } from './support/fake-clock.js';
import { readPeriods, readSubPeriods } from './support/queries.js';
import { Period } from '../src/time-tracking/entities/period.entity.js';
import { SubPeriod } from '../src/time-tracking/entities/sub-period.entity.js';

const BREAK = 2;

describe("clôture d'une session pendant une pause", () => {
    const clock = new FakeClock();
    let ctx: TestApp;

    beforeAll(async () => {
        ctx = await createTestApp({ clock });
    });
    beforeEach(async () => {
        clock.reset();
        await resetDatabase(ctx.dataSource);
        // État de départ : session ouverte à 09:00, pause ouverte à 10:00.
        await ctx.api.post('/api/time-tracking/start').expect(201);
        clock.advanceMinutes(60);
        await ctx.api
            .post('/api/time-tracking/sub')
            .send({ periodTypeId: BREAK })
            .expect(200);
        clock.advanceMinutes(30); // il est 10:30 quand on clôture
    });
    afterEach(() => {
        vi.restoreAllMocks(); // une panne simulée ne doit jamais survivre à son test
    });
    afterAll(async () => {
        await ctx?.app.close();
    });

    it('ferme la pause et la session avec la même heure', async () => {
        await ctx.api.post('/api/time-tracking/end').expect(200);

        const [period] = await readPeriods(ctx.dataSource);
        const [sub] = await readSubPeriods(ctx.dataSource);
        expect(sub.end?.toISOString()).toBe('2026-10-22T10:30:00.000Z');
        expect(period.end?.toISOString()).toBe('2026-10-22T10:30:00.000Z');
    });

    it('annule la fermeture de la pause si la fermeture de la session échoue', async () => {
        // La 1re écriture (SubPeriod) passe vraiment ; la 2e (Period) tombe en panne.
        // Appelée plus bas avec le bon `this` : la règle unbound-method ne le voit pas.
        // oxlint-disable-next-line typescript/unbound-method
        const realUpdate = EntityManager.prototype.update as (
            ...args: unknown[]
        ) => Promise<unknown>;
        const update = vi
            .spyOn(EntityManager.prototype, 'update')
            .mockImplementation(function (this: EntityManager, target, ...rest) {
                if (target === Period)
                    throw new Error('panne simulée entre les deux écritures');
                return realUpdate.call(this, target, ...rest) as never;
            });

        await ctx.api.post('/api/time-tracking/end').expect(500);

        // Les deux écritures ont bien été tentées, dans cet ordre...
        expect(update.mock.calls.map(([target]) => target)).toEqual([
            SubPeriod,
            Period,
        ]);
        // ...mais rien n'est resté : la transaction a été annulée.
        const [period] = await readPeriods(ctx.dataSource);
        const [sub] = await readSubPeriods(ctx.dataSource);
        expect(sub.end).toBeNull();
        expect(period.end).toBeNull();
        const current = await ctx.api.get('/api/time-tracking/current').expect(200);
        expect(current.body.status).toBe('subed');

        // Reprise : la panne levée, la même clôture réussit.
        vi.restoreAllMocks();
        await ctx.api.post('/api/time-tracking/end').expect(200);
        expect((await readPeriods(ctx.dataSource))[0].end?.toISOString()).toBe(
            '2026-10-22T10:30:00.000Z',
        );
        expect((await readSubPeriods(ctx.dataSource))[0].end?.toISOString()).toBe(
            '2026-10-22T10:30:00.000Z',
        );
    });
});
