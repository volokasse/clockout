import { PERIOD_TYPE } from "./period-types.js";
import { SessionAction, SessionState, SessionStatus } from "./session-state.js";
import { assertTransition, InvalidTransitionError } from "./session-transitions.js";

const span = { id: 1, start: new Date('2026-10-22T09:00:000Z'), end: null };
const sub = { ...span, periodTypeId: PERIOD_TYPE.BREAK };
const states: Record<SessionStatus, SessionState> = {
    none: { status: 'none' },
    period: { status: 'period', session: span, subs: [] },
    subed: { status: 'subed', session: span, subs: [], sub }
};

const cases: [SessionAction, SessionStatus, boolean][] = [
    ['start', 'none', true],
    ['start', 'period', false],
    ['start', 'subed', false],
    ['sub', 'none', false],
    ['sub', 'period', true],
    ['sub', 'subed', false],
    ['endsub', 'none', false],
    ['endsub', 'period', false],
    ['endsub', 'subed', true],
    ['end', 'none', false],
    ['end', 'period', true],
    ['end', 'subed', true]
];

describe('assertTransition', () => {
    it.each(cases)('%s from %s -> authorized : %s', (action, from, allowed) => {
        const attempt = () => assertTransition(states[from], action);

        if (allowed) {
            expect(attempt).not.toThrow();
        } else {
            expect(attempt).toThrow(InvalidTransitionError);
        }
    });
});
