import { DraftSub, SessionDraft, validateDraft } from "./session-rules";

const NOW = new Date('2026-10-23T12:00:00Z');
const at = (time: string, day = '22') => new Date(`2026-10-${day}T${time}:00Z`);
const sub = (start: string, end: string | null): DraftSub => ({
  periodTypeId: 2,
  start: at(start),
  end: end ? at(end) : null
});
const session = (start: string, end: string | null, subs: DraftSub[] = []): SessionDraft => ({
  start: at(start),
  end: end ? at(end) : null,
  subs
});
const codes = (draft: SessionDraft) => validateDraft(draft, NOW).map((violation) => violation.code);

describe('validateDraft (browser side rules', () => {
  it('accept a coherent session', () => {
    expect(codes(session('09:00', '17:30', [sub('12:00', '13:00')]))).toEqual([]);
  });

  it('accept touching sub periods', () => {
    expect(codes(session('09:00', '17:30', [sub('12:00', '12:30'), sub('12:30', '13:00')]))).toEqual([]);
  });

  it.each([
    ['end before start', session('10:00', '09:00'), 'SESSION_END_BEFORE_START'],
    ['sub period out of session', session('09:00', '17:00', [sub('08:00', '08:30')]), 'SUB_OUTSIDE_SESSION'],
    ['sub periods overlaping', session('09:00', '17:00', [sub('12:00', '13:00'), sub('12:30', '13:30')]), 'SUBS_OVERLAP'],
    ['open sub period in a closed session', session('09:00', '17:00', [sub('12:00', null)]), 'SUB_OPEN_IN_CLOSED_SESSION'],
    ['session in the future', { start: at('09:00', '24'), end: at('10:00', '24'), subs: [] }, 'SESSION_IN_FUTURE']
  ])('refuse : %s', (_name, draft, code) => {
    expect(codes(draft)).toContain(code);
  });
});
