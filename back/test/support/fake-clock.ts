import { Clock } from '../../src/time-tracking/clock.js';

export const DEFAULT_START = '2026-10-22T09:00:00.000Z';

// Horloge réglée à la main : les horaires enregistrés deviennent prévisibles.
export class FakeClock extends Clock {
    private current: Date;

    constructor(private readonly initial = DEFAULT_START) {
        super();
        this.current = new Date(initial);
    }

    now(): Date {
        return new Date(this.current);
    }

    reset(): void {
        this.current = new Date(this.initial);
    }

    advanceMinutes(minutes: number): void {
        this.current = new Date(this.current.getTime() + minutes * 60_000);
    }
}
