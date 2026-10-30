import { NotFoundException } from "@nestjs/common";
import { QueryFailedError, Repository } from "typeorm";
import { Period } from "./entities/period.entity.js";
import { HistoryService } from "./history.service.js";
import { PERIOD_TYPE } from "./period-types.js";
import type { SessionInput } from "./dto/session-input.dto.js";
import { SessionConflictError, SessionValidationError } from "./session-errors.js";

const NOW = new Date('2026-10-23T12:00:00Z');
const at = (time: string) => new Date(`2026-10-22T${time}:00Z`);

const input = (overrides: Partial<SessionInput> = {}): SessionInput => ({
    start: at('09:00'),
    end: at('17:30'),
    note: null,
    subs: [{ periodTypeId: PERIOD_TYPE.BREAK, start: at('12:00'), end: at('13:00') }],
    ...overrides
});

function createService(clashes: unknown[] = [], existing: unknown = { id: 1 }) {
    const manager = {
        query: vi.fn().mockResolvedValue(undefined),
        find: vi.fn().mockResolvedValue(clashes),
        findOne: vi.fn().mockResolvedValue(existing),
        save: vi.fn(async (_target: unknown, data: object | object[]) =>
            Array.isArray(data)
                ? data.map((row, index) => ({ id: 100 + index, ...row }))
                : { id: 42, ...data }),
        update: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined)
    };
    const repository = {
        manager: { transaction: vi.fn((work: (m: typeof manager) => unknown) => work(manager)) }
    } as unknown as Repository<Period>;

    const service = new HistoryService(repository, { now: () => NOW });
    return { service, manager };
}

describe('HistoryService.create', () => {
    it('crée la session et ses pauses dans une transaction verrouillée', async () => {
        const { service, manager } = createService();

        const result = await service.create(input());

        expect(manager.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock($1)', [5001]);
        expect(result.id).toBe(42);
        expect(result.status).toBe('closed');
        expect(result.subs).toHaveLength(1);
        expect(result.elapsedMs).toBe(510 * 60_000);
    });

    it('refuse un chevauchement sans rien écrire', async () => {
        const { service, manager } = createService([{ id: 7, start: at('08:00'), end: at('10:00') }]);

        await expect(service.create(input())).rejects.toThrow(SessionValidationError);
        expect(manager.save).not.toHaveBeenCalled();
    });

    it('signale les horaires incohérents avec le code attendu', async () => {
        const { service } = createService();

        const error = await service.create(input({ end: at('08:00'), subs: [] })).catch((e) => e);

        expect(error).toBeInstanceOf(SessionValidationError);
        expect(error.violations.map((v: { code: string }) => v.code)).toEqual(['SESSION_END_BEFORE_START']);
    });

    it('traduit un refus de l\'index unique en conflit', async () => {
        const { service, manager } = createService();
        const driverError = Object.assign(new Error('duplicate key'), { code: '23505' });
        manager.save.mockRejectedValueOnce(new QueryFailedError('INSERT', [], driverError));

        await expect(service.create(input({ end: null, subs: [] }))).rejects.toThrow(SessionConflictError);
    });
});

describe('HistoryService.update', () => {
    it('remplace la session et ses pauses', async () => {
        const { service, manager } = createService();

        const result = await service.update(1, input({ note: 'corrigée' }));

        expect(manager.update).toHaveBeenCalledWith(Period, 1, expect.objectContaining({ note: 'corrigée' }));
        expect(manager.delete).toHaveBeenCalledTimes(1);
        expect(result.id).toBe(1);
        expect(result.note).toBe('corrigée');

        const order = [manager.update, manager.delete, manager.save].map((fn) =>
            fn.mock.invocationCallOrder[0]);
        expect(order).toEqual([...order].sort((a, b) => a - b));
    });

    it('répond 404 pour une session inconnue, sans rien modifier', async () => {
        const { service, manager } = createService([], null);

        await expect(service.update(99, input())).rejects.toThrow(NotFoundException);
        expect(manager.update).not.toHaveBeenCalled();
        expect(manager.delete).not.toHaveBeenCalled();
    });

    it('refuse une correction invalide sans modifier ni supprimer quoi que ce soit', async () => {
        const { service, manager } = createService();

        const invalid = input({ subs: [{ periodTypeId: PERIOD_TYPE.BREAK, start: at('08:00'), end: at('08:30') }] });

        await expect(service.update(1, invalid)).rejects.toThrow(SessionValidationError);
        expect(manager.update).not.toHaveBeenCalled();
        expect(manager.delete).not.toHaveBeenCalled();
        expect(manager.save).not.toHaveBeenCalled();
    });

    it('exclut la session corrigée de la recherche de chevauchements', async () => {
        const { service, manager } = createService();

        await service.update(5, input());

        const where = manager.find.mock.calls[0][1].where as { id: unknown }[];
        expect(where).toHaveLength(2);
        expect(where.every((condition) => condition.id !== undefined)).toBe(true);
    });

    it('laisse remonter une erreur survenue en cours d\'écriture (la transaction annule tout)', async () => {
        const { service, manager } = createService();
        manager.save.mockRejectedValueOnce(new Error('disk full'));

        await expect(service.update(1, input())).rejects.toThrow('disk full');
    });
});

it('déduit la pause du temps travaillé : 09:00-17:30 avec une pause 12:30-13:30 = 7h30', async () => {
    const { service } = createService();

    const result = await service.create(input({
        subs: [{ periodTypeId: PERIOD_TYPE.BREAK, start: at('12:30'), end: at('13:30') }]
    }));

    expect(result.elapsedMs).toBe(510 * 60_000);
    expect(result.workedMs).toBe(450 * 60_000);
});

it('ne déduit pas une veille du temps travaillé', async () => {
    const { service } = createService();

    const result = await service.create(input({
        subs: [{ periodTypeId: PERIOD_TYPE.SCOUTING, start: at('12:30'), end: at('13:30') }]
    }));

    expect(result.workedMs).toBe(510 * 60_000);
});

it('recalcule le temps travaillé quand la pause est corrigée : 7h45 au lieu de 7h30', async () => {
    const { service } = createService();
    const withBreak = (end: string) => input({
        subs: [{ periodTypeId: PERIOD_TYPE.BREAK, start: at('12:30'), end: at(end) }]
    });

    const before = await service.update(1, withBreak('13:30'));
    const after = await service.update(1, withBreak('13:15'));

    expect(before.workedMs).toBe(450 * 60_000);
    expect(after.workedMs).toBe(465 * 60_000);
});
