import { Repository } from "typeorm";
import { Period } from "./entities/period.entity.js";
import { TimeTrackingService } from "./time-tracking.service.js";
import { InvalidTransitionError } from "./session-transitions.js";
import { PERIOD_TYPE } from "./period-types.js";


const NOW = new Date('2026-10-22T09:00:00Z');

function createService(openPeriod: unknown = null, subPeriods: unknown[] = []) {
    const manager = {
        findOne: vi.fn().mockResolvedValue(openPeriod),
        find: vi.fn().mockResolvedValue(subPeriods),
        save: vi.fn(async (_target: unknown, data: object) => ({ id: 42, ...data })),
        update: vi.fn().mockResolvedValue(undefined)
    };

    const repository = {
        manager: { transaction: vi.fn((work: (m: typeof manager) => unknown) => work(manager)) }
    } as unknown as Repository<Period>;

    const service = new TimeTrackingService(repository, { now: () => NOW });
    return { service, manager };
}

describe('TimeTrackingService', () => {
    it('starts a session with clock time', async () => {
        const { service, manager } = createService(null);

        const result = await service.start();

        expect(result.status).toBe('period');
        expect(result.session?.start).toBe(NOW.toISOString());
        expect(manager.save).toHaveBeenCalledTimes(1);
    });

    it('refuses an endsub when no sub is active', async () => {
        const openPeriod = { id: 1, start: NOW, end: null };
        const { service, manager } = createService(openPeriod, []);

        await expect(service.endSub()).rejects.toThrow(InvalidTransitionError);
        expect(manager.update).not.toHaveBeenCalled();
    });

    it('end the sub and the session when we end period while a sub is active', async () => {
        const openPeriod = { id: 1, start: NOW, end: null };
        const openSub = { id: 7, start: NOW, end: null, periodType: { id: PERIOD_TYPE.BREAK }};
        const { service, manager } = createService(openPeriod, [openSub]);

        const result = await service.end();

        expect(result.status).toBe('none');
        expect(manager.update).toHaveBeenCalledTimes(2);
    });

    it('endSub deducts the breaks but not the scoutings from the worked time', async () => {
        const openPeriod = { id: 1, start: new Date('2026-10-22T07:00:00Z'), end: null };
        const subs = [
            { id: 7, start: new Date('2026-10-22T07:30:00Z'), end: new Date('2026-10-22T07:45:00Z'), periodType: { id: PERIOD_TYPE.SCOUTING } },
            { id: 8, start: new Date('2026-10-22T08:30:00Z'), end: null, periodType: { id: PERIOD_TYPE.BREAK } }
        ];
        const { service } = createService(openPeriod, subs);

        const result = await service.endSub();

        expect(result.elapsedMs).toBe(120 * 60_000);
        expect(result.workedMs).toBe(90 * 60_000); // 120 - 30 of break (08:30 -> NOW), the scouting counts as work
    });

    it('end deducts a running break from the worked time', async () => {
        const openPeriod = { id: 1, start: new Date('2026-10-22T07:00:00Z'), end: null };
        const openSub = { id: 7, start: new Date('2026-10-22T08:00:00Z'), end: null, periodType: { id: PERIOD_TYPE.BREAK } };
        const { service } = createService(openPeriod, [openSub]);

        const result = await service.end();

        expect(result.workedMs).toBe(60 * 60_000); // 120 - 60 of break (08:00 -> NOW)
    });

});
