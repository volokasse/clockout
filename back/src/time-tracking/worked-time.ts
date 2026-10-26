import { SUBTRACTED_TYPES } from "./period-types.js";

export interface TimeSpan {
    start: Date,
    end: Date | null
}

export interface TypedTimeSpan extends TimeSpan {
    periodTypeId: number;
}

export function computeWorkedMs(session: TimeSpan, subs: TimeSpan[], now: Date): number {
    const sessionStart = session.start.getTime();
    const sessionEnd = (session.end ?? now).getTime();
    const total = Math.max(0, sessionEnd - sessionStart);

    const subsTotal = subs.reduce((sum, sub) => {
        const from = Math.max(sub.start.getTime(), sessionStart);
        const to = Math.min((sub.end ?? now).getTime(), sessionEnd);
        return sum + Math.max(0, to - from);
    }, 0);

    return Math.max(0, total - subsTotal);
}

export function formatDuration(ms: number): string {
    const totalMinutes = Math.floor(ms / 60_000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = String(totalMinutes % 60).padStart(2, '0');
    return `${hours}h${minutes}`;
}

export function computeElapsedMs(session: TimeSpan, now: Date): number {
    return Math.max(0, (session.end ?? now).getTime() - session.start.getTime());
}

export function computeSessionWorkedMs(
    session: TimeSpan,
    subs: TypedTimeSpan[],
    now: Date,
    substracted: readonly number[] = SUBTRACTED_TYPES
): number {
    return computeWorkedMs(session, subs.filter((sub) => substracted.includes(sub.periodTypeId)), now);
}
