import { SessionDetail } from "./history.model";
import { fromLocalInput, toDraft, toFormValue, toLocalInput, toPayload } from "./session-form.model";


describe('convert date <-> field datetime-local', () => {
  it('do the back and forth without loosing the time period (ceiling to one minute)', () => {
    const iso = '2026-10-22T09:30:00.000Z';

    expect(fromLocalInput(toLocalInput(iso))).toBe(iso);
  });

  it('treat the void as empty', () => {
    expect(toLocalInput(null)).toBe('');
    expect(fromLocalInput('')).toBeNull();
  });

  it('produce the right formatting for the field', () => {
    expect(toLocalInput('2026-10-22T09:30:00.000Z')).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});

describe('form <-> API', () => {
  const session: SessionDetail = {
    id: 1,
    start: '2026-10-22T07:00:00.000Z',
    end: null,
    note: null,
    status: 'open',
    subs: [{ id: 3, start: '2026-10-22T08:00:00.000Z', end: null, periodTypeId: 3 }],
    workedMs: 0,
    elapsedMs: 0
  };

  it('prepare an empty form to add', () => {
    expect(toFormValue(null)).toEqual({ start: '', end: '', note: '', subs: [] });
  });

  it('retrieve same datas after a back and forth', () => {
    const payload = toPayload(toFormValue(session));

    expect(payload).toEqual({
      start: session.start,
      end: null,
      note: null,
      subs: [{ periodTypeId: 3, start: '2026-10-22T08:00:00.000Z', end: null }]
    });
  });

  it('trim the text note and transform an empty note to null', () => {
    const value = { ...toFormValue(session), note: '    ' };

    expect(toPayload(value).note).toBeNull();
    expect(toPayload({ ...value, note: '   Client   ' }).note).toBe('Client');
  });

  it('only produce a draft if the inputed dates are completes', () => {
    const value = toFormValue(session);

    expect(toDraft({ ...value, start: '' })).toBeNull();
    expect(toDraft({ ...value, subs: [{ ...value.subs[0], start: '' }]})).toBeNull();
    expect(toDraft(value)?.end).toBeNull();
  });
});
