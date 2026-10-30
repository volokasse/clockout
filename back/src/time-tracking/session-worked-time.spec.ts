import { PERIOD_TYPE } from "./period-types.js";
import { computeElapsedMs, computeSessionWorkedMs, computeWorkedMs, formatDuration } from "./worked-time.js";

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

    it('computeSessionWorkedMs déduit les pauses par défaut : 7h30 avec 1 h de pause, 7h45 après correction à 45 min', () => {
        const before = computeSessionWorkedMs(session, [breakOf('12:30', '13:30')], NOW);
        const after = computeSessionWorkedMs(session, [breakOf('12:30', '13:15')], NOW);

        expect(before).toBe(450 * MINUTE);
        expect(formatDuration(before)).toBe('7h30');
        expect(after).toBe(465 * MINUTE);
        expect(formatDuration(after)).toBe('7h45');
        expect(after - before).toBe(15 * MINUTE);
    });

    it('rien n\'est déduit quand on passe une liste vide : la correction ne change pas le temps travaillé', () => {
        const before = computeSessionWorkedMs(session, [breakOf('12:00', '13:00')], NOW, []);
        const after = computeSessionWorkedMs(session, [breakOf('12:00', '12:45')], NOW, []);

        expect(before).toBe(510 * MINUTE);
        expect(after).toBe(before);
    });

    it('une veille n\'est pas déduite par défaut : elle compte comme du travail', () => {
        const scouting = { start: at('14:00'), end: at('15:00'), periodTypeId: PERIOD_TYPE.SCOUTING };

        expect(computeSessionWorkedMs(session, [scouting], NOW)).toBe(510 * MINUTE);
    });

    it('avec une pause et une veille dans la même session, seule la pause est déduite', () => {
        const scouting = { start: at('14:00'), end: at('15:00'), periodTypeId: PERIOD_TYPE.SCOUTING };

        expect(computeSessionWorkedMs(session, [breakOf('12:30', '13:30'), scouting], NOW)).toBe(450 * MINUTE);
    });
});
