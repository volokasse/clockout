import {
    validateSession, type DraftSub, type ExistingSession, type SessionDraft
} from "./session-validation.js";
import { PERIOD_TYPE } from "./period-types.js";

const NOW = new Date('2026-10-23T12:00:00Z');

const at = (time: string, day = '22') => new Date(`2026-10-${day}T${time}:00Z`);
const sub = (start: string, end: string | null, day = '22'): DraftSub => ({
    periodTypeId: PERIOD_TYPE.BREAK,
    start: at(start, day),
    end: end ? at(end, day) : null
});
const session = (start: string, end: string | null, subs: DraftSub[] = []): SessionDraft => ({
    start: at(start),
    end: end ? at(end) : null,
    subs
});
const existing = (id: number, start: string, end: string | null): ExistingSession => ({
    id,
    start: at(start),
    end: end ? at(end) : null
});
const codes = (draft: SessionDraft, others: ExistingSession[] = []) =>
    validateSession(draft, others, NOW).map((violation) => violation.code);

describe('validateSession : cas valides', () => {
    it('accepte une session cohérente avec ses pauses', () => {
        expect(codes(session('09:00', '17:30', [sub('12:00', '13:00')]))).toEqual([]);
    });

    it('accepte des pauses qui se touchent sans se chevaucher', () => {
        const subs = [sub('12:00', '12:30'), sub('12:30', '13:00')];

        expect(codes(session('09:00', '17:30', subs))).toEqual([]);
    });

    it('accepte une pause qui touche le début et la fin de la session', () => {
        const subs = [sub('09:00', '09:15'), sub('17:15', '17:30')];

        expect(codes(session('09:00', '17:30', subs))).toEqual([]);
    });

    it('accepte des sessions qui se touchent (fin = début de la suivante)', () => {
        const others = [existing(1, '07:00', '09:00'), existing(2, '17:30', '19:00')];

        expect(codes(session('09:00', '17:30'), others)).toEqual([]);
    });

    it('accepte une session ouverte avec une pause ouverte', () => {
        expect(codes(session('09:00', null, [sub('10:00', null)]))).toEqual([]);
    });
});

describe('validateSession : horaires de la session', () => {
    it('refuse une fin avant le début', () => {
        expect(codes(session('10:00', '09:00'))).toEqual(['SESSION_END_BEFORE_START']);
    });

    it('refuse une fin égale au début', () => {
        expect(codes(session('10:00', '10:00'))).toEqual(['SESSION_END_BEFORE_START']);
    });

    it('refuse une session dans le futur', () => {
        const future = { start: at('09:00', '24'), end: at('10:00', '24'), subs: [] };

        expect(codes(future)).toEqual(['SESSION_IN_FUTURE']);
    });

    it('refuse une fin dans le futur même si le début est passé', () => {
        const draft = { start: at('09:00', '23'), end: at('13:00', '23'), subs: [] };

        expect(codes(draft)).toEqual(['SESSION_IN_FUTURE']);
    });
});

describe('validateSession : pauses', () => {
    it('refuse une pause dont la fin précède le début', () => {
        expect(codes(session('09:00', '17:00', [sub('13:00', '12:00')]))).toEqual(['SUB_END_BEFORE_START']);
    });

    it('refuse une pause qui commence avant la session', () => {
        expect(codes(session('09:00', '17:00', [sub('08:30', '09:30')]))).toEqual(['SUB_OUTSIDE_SESSION']);
    });

    it('refuse une pause qui finit après la session', () => {
        expect(codes(session('09:00', '17:00', [sub('16:30', '17:30')]))).toEqual(['SUB_OUTSIDE_SESSION']);
    });

    it('refuse une pause ouverte dans une session fermée', () => {
        expect(codes(session('09:00', '17:00', [sub('12:00', null)]))).toEqual(['SUB_OPEN_IN_CLOSED_SESSION']);
    });

    it('refuse deux pauses ouvertes', () => {
        const subs = [sub('10:00', null), sub('11:00', null)];

        expect(codes(session('09:00', null, subs))).toContain('SUB_MULTIPLE_OPEN');
    });

    it('refuse deux pauses qui se chevauchent', () => {
        const subs = [sub('12:00', '13:00'), sub('12:30', '13:30')];

        expect(codes(session('09:00', '17:00', subs))).toEqual(['SUBS_OVERLAP']);
    });

    it('refuse deux pauses identiques', () => {
        const subs = [sub('12:00', '13:00'), sub('12:00', '13:00')];

        expect(codes(session('09:00', '17:00', subs))).toEqual(['SUBS_OVERLAP']);
    });

    it('désigne la pause fautive par son chemin', () => {
        const violations = validateSession(
            session('09:00', '17:00', [sub('10:00', '10:30'), sub('12:00', '13:00'), sub('12:30', '13:30')]),
            [],
            NOW
        );

        expect(violations).toHaveLength(1);
        expect(violations[0].path).toBe('subs[2]');
    });
});

describe('validateSession : chevauchement entre sessions', () => {
    it.each([
        ['chevauchement partiel', existing(1, '08:00', '10:00')],
        ['session englobée', existing(1, '10:00', '11:00')],
        ['session englobante', existing(1, '07:00', '19:00')],
        ['session identique', existing(1, '09:00', '17:30')],
        ['session déjà ouverte', existing(1, '16:00', null)]
    ])('refuse : %s', (_name, other) => {
        expect(codes(session('09:00', '17:30'), [other])).toEqual(['SESSIONS_OVERLAP']);
    });

    it('refuse une session ouverte qui commence avant une session existante', () => {
        expect(codes(session('08:00', null), [existing(1, '10:00', '11:00')])).toEqual(['SESSIONS_OVERLAP']);
    });

    it('ne cherche pas de chevauchement si les horaires de la session sont déjà incohérents', () => {
        expect(codes(session('10:00', '09:00'), [existing(1, '08:00', '11:00')])).toEqual(['SESSION_END_BEFORE_START']);
    });

    it('rapporte plusieurs violations en une seule fois', () => {
        const subs = [sub('08:00', '08:30'), sub('12:00', '13:00'), sub('12:30', '13:30')];

        expect(codes(session('09:00', '17:00', subs))).toEqual(['SUB_OUTSIDE_SESSION', 'SUBS_OVERLAP']);
    });
});
