import { SessionAction, SessionStatus, SessionState } from "./session-state.js";

export class InvalidTransitionError extends Error {
    constructor(
        readonly action: SessionAction,
        readonly from: SessionStatus
    ) {
        super(`Action "${action}" forbidden from state "${from}"`);
        this.name = 'InvalidTransitionError';
    }
}

export const ALLOWED_FROM = {
    start: ['none'],
    sub: ['period'],
    endsub: ['subed'],
    end: ['period', 'subed']
} as const satisfies Record<SessionAction, readonly SessionStatus[]>;

type AllowedState<A extends SessionAction> = Extract<
    SessionState,
    { status: (typeof ALLOWED_FROM)[A][number] }
>;

export function assertTransition<A extends SessionAction>(
    state: SessionState,
    action: A
): asserts state is AllowedState<A> {
    const allowed: readonly SessionStatus[] = ALLOWED_FROM[action];
    if (!allowed.includes(state.status))
        throw new InvalidTransitionError(action, state.status);
}
