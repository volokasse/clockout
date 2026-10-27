export interface DraftSub {
    periodTypeId: number;
    start: Date;
    end: Date | null;
}

export interface SessionDraft {
    start: Date;
    end: Date | null;
    subs: DraftSub[];
}

export interface ExistingSession {
    id: number;
    start: Date;
    end: Date | null;
}

export type ViolationCode =
    | 'SESSION_END_BEFORE_START'
    | 'SESSION_IN_FUTURE'
    | 'SESSIONS_OVERLAP'
    | 'SUB_END_BEFORE_START'
    | 'SUB_OUTSIDE_SESSION'
    | 'SUB_OPEN_IN_CLOSED_SESSION'
    | 'SUB_MULTIPLE_OPEN'
    | 'SUBS_OVERLAP';

export interface Violation {
    code: ViolationCode;
    path: string;
    message: string;
}

interface Interval {
    start: Date;
    end: Date | null;
}

const endMs = (interval: Interval): number =>
    interval.end ? interval.end.getTime() : Number.POSITIVE_INFINITY;

export const overlaps = (a: Interval, b: Interval): boolean =>
    a.start.getTime() < endMs(b) && b.start.getTime() < endMs(a);

const endsBeforeStart = (interval: Interval): boolean =>
    interval.end !== null && interval.end.getTime() <= interval.start.getTime();

export function validateSession(
    draft: SessionDraft,
    others: ExistingSession[],
    now: Date
): Violation[] {
    const violations: Violation[] = [];
    const add = (code: ViolationCode, path: string, message: string) =>
        violations.push({ code, path, message });

    const sessionOrderOk = !endsBeforeStart(draft);
    if (!sessionOrderOk) {
        add('SESSION_END_BEFORE_START', 'end', 'The end must be after the start');
    }
    if (draft.start.getTime() > now.getTime() || (draft.end && draft.end.getTime() > now.getTime())) {
        add('SESSION_IN_FUTURE', 'start', 'A session cannot be in the future');
    }
    if (sessionOrderOk) {
        const clash = others.find((other) => overlaps(draft, other));
        if (clash) {
            add('SESSIONS_OVERLAP', 'start', `The session overlaps session ${clash.id}`);
        }
    }

    const validSubs: { index: number; sub: DraftSub }[] = [];
    let openCount = 0;
    draft.subs.forEach((sub, index) => {
        const path = `subs[${index}]`;
        let valid = true;

        if (endsBeforeStart(sub)) {
            add('SUB_END_BEFORE_START', path, 'The end must be after the start');
            valid = false;
        }
        if (sub.end === null) {
            openCount++;
            if (draft.end !== null) {
                add('SUB_OPEN_IN_CLOSED_SESSION', path, 'An open sub period needs an open session');
            }
            if (openCount > 1) {
                add('SUB_MULTIPLE_OPEN', path, 'Only one sub period can be open');
            }
        }
        const startsTooEarly = sub.start.getTime() < draft.start.getTime();
        const endsTooLate = sub.end !== null && endMs(sub) > endMs(draft);
        if (valid && (startsTooEarly || endsTooLate)) {
            add('SUB_OUTSIDE_SESSION', path, 'The sub period must stay inside the session');
        }
        if (valid) validSubs.push({ index, sub });
    });

    validSubs.forEach(({ index: j, sub: later }, position) => {
        for (const { index: i, sub: earlier } of validSubs.slice(0, position)) {
            if (overlaps(earlier, later)) {
                add('SUBS_OVERLAP', `subs[${j}]`, `The sub period overlaps subs[${i}]`);
                break;
            }
        }
    });

    return violations;
}
