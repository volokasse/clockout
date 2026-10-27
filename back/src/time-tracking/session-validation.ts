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

export function validateSession(
    _draft: SessionDraft,
    _others: ExistingSession[],
    _now: Date
): Violation[] {
    return [];
}
