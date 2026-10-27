import { PERIOD_TYPE } from "./period-types.js";
import { computeElapsedMs, computeSessionWorkedMs, computeWorkedMs } from "./worked-time.js";

const at = (time: string) => new Date(`2026-10-22T${time}:00Z`);
const MINUTE = 60_000;
const NOW = new Date('2026-10-23T12:00:00Z');

const session = { start: at('09:00'), end: at('17:30') };
const breakOf = (start: string, end: string) => ({
    start: at(start),
    end: at(end),
    periodTypeId: PERIOD_TYPE.BREAK
});

describe('computeElapsedMs', () => {
    it('retourne la durée entre le début et la fin', () => {
        expect(computeElapsedMs(session, NOW)).toBe(510 * MINUTE);
    });

    it('utilise now pour une session ouverte', () => {
        expect(computeElapsedMs({ start: at('09:00'), end: null }, at('10:30'))).toBe(90 * MINUTE);
    });
});

describe('correction d\'une pause : le temps travaillé suit', () => {
    it('passer une pause de 60 à 45 minutes augmente le temps travaillé de 15 minutes', () => {
        const before = computeWorkedMs(session, [breakOf('12:00', '13:00')], NOW);
        const after = computeWorkedMs(session, [breakOf('12:00', '12:45')], NOW);

        expect(after - before).toBe(15 * MINUTE);
    });

    it('même résultat via computeSessionWorkedMs quand les pauses sont déduites', () => {
        const deduct = [PERIOD_TYPE.BREAK];
        const before = computeSessionWorkedMs(session, [breakOf('12:00', '13:00')], NOW, deduct);
        const after = computeSessionWorkedMs(session, [breakOf('12:00', '12:45')], NOW, deduct);

        expect(after - before).toBe(15 * MINUTE);
        expect(before).toBe(450 * MINUTE);
    });

    it('rien n\'est déduit par défaut : la correction ne change pas le temps travaillé', () => {
        const before = computeSessionWorkedMs(session, [breakOf('12:00', '13:00')], NOW);
        const after = computeSessionWorkedMs(session, [breakOf('12:00', '12:45')], NOW);

        expect(before).toBe(510 * MINUTE);
        expect(after).toBe(before);
    });

    it('une veille n\'est pas déduite quand seules les pauses le sont', () => {
        const scouting = { start: at('14:00'), end: at('15:00'), periodTypeId: PERIOD_TYPE.SCOUTING };

        expect(computeSessionWorkedMs(session, [scouting], NOW, [PERIOD_TYPE.BREAK])).toBe(510 * MINUTE);
    });
});
