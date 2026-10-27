import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SessionDetail, SessionPayload } from '../time-tracking/history.model';
import { SessionForm } from './session-form';
import { toLocalInput } from '../time-tracking/session-form.model';


const SESSION: SessionDetail = {
  id: 5,
  start: '2026-10-22T07:00:00.000Z',
  end: '2026-10-22T15:30:00.000Z',
  note: 'Visite client',
  status: 'closed',
  subs: [
    { id: 1, start: '2026-10-22T10:00:00.000Z', end: '2026-10-22T11:00:00.000Z', periodTypeId: 2 },
    { id: 2, start: '2026-10-22T12:00:00.000Z', end: '2026-10-22T12:30:00.000Z', periodTypeId: 3 }
  ],
  workedMs: 0,
  elapsedMs: 0
};

describe('SessionForm', () => {
  let fixture: ComponentFixture<SessionForm>;
  let emitted: SessionPayload[];

  const root = () => fixture.nativeElement as HTMLElement;
  const inputs = () => Array.from(root().querySelectorAll('input[type="datetime-local"]')) as HTMLInputElement[];
  const subBlocks = () => root().querySelectorAll('.sub');
  const button = (label: string) => Array.from(root().querySelectorAll('button')).find((b) => b.textContent?.trim() === label) as HTMLButtonElement;

  async function open(session: SessionDetail | null) {
    fixture = TestBed.createComponent(SessionForm);
    emitted = [];
    fixture.componentInstance.save.subscribe((payload) => emitted.push(payload));
    fixture.componentRef.setInput('session', session);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function type(field: HTMLInputElement, value: string) {
    field.value = value;
    field.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => TestBed.configureTestingModule({ imports: [SessionForm] }));

  it('refuse a start before the end and explains it', async () => {
    await open(SESSION);

    await type(inputs()[1], toLocalInput('2026-10-22T06:00:00.000Z'));
    button('Enregistrer').click();
    fixture.detectChanges();

    expect(emitted).toHaveLength(0);
    expect(root().querySelector('[role="alert"]')?.textContent).toContain(
      "L'heure de départ doit être après l'heure d'arrivée."
    );
  });

  it('refuse a sub period outside of the session', async () => {
    await open(SESSION);

    await type(inputs()[2], toLocalInput('2026-10-22T05:00:00.000Z'));
    await type(inputs()[3], toLocalInput('2026-10-22T05:30:00.000Z'));
    button('Enregistrer').click();
    fixture.detectChanges();

    expect(emitted).toHaveLength(0);
    expect(root().querySelector('[role="alert"]')?.textContent).toContain('Pause 1 : Doit rester dans les horaires');
  });

  describe('préremplissage', () => {
    it('retake schedules, the note and subs of the session', async () => {
      await open(SESSION);

      expect(inputs()[0].value).toBe(toLocalInput(SESSION.start));
      expect(inputs()[1].value).toBe(toLocalInput(SESSION.end));
      expect((root().querySelector('textarea') as HTMLTextAreaElement).value).toBe('Visite client');
      expect(subBlocks()).toHaveLength(2);
      expect(inputs()[2].value).toBe(toLocalInput(SESSION.subs[0].start));
      expect(inputs()[5].value).toBe(toLocalInput(SESSION.subs[1].end));
    });

    it('let the start empty for a running session', async () => {
      await open({ ...SESSION, end: null, status: 'open', subs: [] });

      expect(inputs()[1].value).toBe('');
    });

    it('start empty for a manual add', async () => {
      await open(null);

      expect(inputs()[0].value).toBe('');
      expect(subBlocks()).toHaveLength(0);
    });
  });

  describe('dynamic subs list', () => {
    it('add a sub', async () => {
      await open(SESSION);

      button('Ajouter une pause').click();
      fixture.detectChanges();

      expect(subBlocks()).toHaveLength(3);
    });

    it('remove selected sub', async () => {
      await open(SESSION);
      const secondPauseStart = inputs()[4].value;

      (root().querySelector('[aria-label="Retirer la pause 1"]') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(subBlocks()).toHaveLength(1);
      expect(inputs()[2].value).toBe(secondPauseStart);
      expect(root().querySelector('[aria-label="Retirer la pause 2"]')).toBeNull();
    });

    it('reload the subs when we go to another one', async () => {
      await open(SESSION);
      fixture.componentRef.setInput('session', { ...SESSION, subs: [] });
      await fixture.whenStable();
      fixture.detectChanges();

      expect(subBlocks()).toHaveLength(0);
    });
  });

  describe('enregistrement', () => {
    it('emit the datas that are ready for the API when the form is validated', async () => {
      await open(SESSION);

      button('Enregistrer').click();

      expect(emitted).toEqual([{
        start: SESSION.start,
        end: SESSION.end,
        note: 'Visite client',
        subs: [
          { periodTypeId: 2, start: SESSION.subs[0].start, end: SESSION.subs[0].end },
          { periodTypeId: 3, start: SESSION.subs[1].start, end: SESSION.subs[1].end }
        ]
      }]);
    });

    it('it must have a start', async () => {
      await open(null);

      button('Enregistrer').click();
      fixture.detectChanges();

      expect(emitted).toHaveLength(0);
      expect(root().textContent).toContain("L'arrivée est obligatoire.");
    });

    it('display the violations answered by the server', async () => {
      await open(SESSION);

      fixture.componentRef.setInput('serverViolations', [
        { code: 'SESSIONS_OVERLAP', path: 'start', message: 'The session overlaps session 3' }
      ]);
      fixture.detectChanges();

      expect(root().querySelector('[role="alert"]')?.textContent).toContain('chevauche une autre session');
    });
  });
});
