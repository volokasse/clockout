import { computeWorkedMs, formatDuration } from "./worked-time.js";

const at = (time: string) => new Date(`2026-10-22T${time}:00Z`);
const MINUTE = 60_000;

describe('computeWorkedMs', () => {
    it('return the total period duration when there is no sub period', () => {
        const session = { start: at('09:00'), end: at('17:00') };

        expect(computeWorkedMs(session, [], at('23:00'))).toBe(8 * 60 * MINUTE);
    });

    it('substract multiple sub periods : 09:00-17:30 with 75mn of sub periods = 7h15', () => {
        const session = { start: at('09:00'), end: at('17:30') };

        const subPeriods = [
            { start: at('10:30'), end: at('10:45') },
            { start: at('12:00'), end: at('13:00')}
        ];

        const worked = computeWorkedMs(session, subPeriods, at('23:00'));
        expect(worked).toBe(435 * MINUTE);
        expect(formatDuration(worked)).toBe('7h15');
    });

    it('uses now for an open session', () => {
        const session = { start: at('09:00'), end: null };

        expect(computeWorkedMs(session, [], at('11:30'))).toBe(150 * MINUTE);
    });

    it('uses now for an open sub period', () => {
        const session = { start: at('09:00'), end: null };
        const subPeriods = [{ start: at('12:00'), end: null }];

        expect(computeWorkedMs(session, subPeriods, at('12:30'))).toBe(180 * MINUTE);
    });

    it('never returns a negative duration', () => {
        const session = { start: at('09:00'), end: null };

        expect(computeWorkedMs(session, [], at('08:00'))).toBe(0);
    });
});

describe('formatDuration', () => {
    it('format hours and minutes', () => {
        expect(formatDuration(0)).toBe('0h00');
        expect(formatDuration(65 * MINUTE)).toBe('1h05');
    });
});
