import { HttpTestingController, provideHttpClientTesting, TestRequest } from "@angular/common/http/testing";
import { SessionDetail } from "../time-tracking/history.model";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import HistoryPage from "./history-page";
import { provideHttpClient } from "@angular/common/http";
import { SessionDialog } from "../session-dialog/session-dialog";
import { MatDialog } from "@angular/material/dialog";
import { of } from "rxjs";
import { startOfDay, startOfNextDay } from "../time-tracking/date-range";

const CLOSED: SessionDetail = {
  id: 12,
  start: '2026-10-22T07:00:00.000Z',
  end: '2026-10-22T10:00:00.000Z',
  note: null,
  status: 'closed',
  subs: [{ id: 1, start: '2026-10-22T08:00:00.000Z', end: '2026-10-22T08:15:00.000Z', periodTypeId: 2 }],
  workedMs: 10_800_000,
  elapsedMs: 10_800_000
};

const OPEN: SessionDetail = {
  id: 13,
  start: '2026-10-22T12:00:00.000Z',
  end: null,
  note: 'Reprise',
  status: 'open',
  subs: [],
  workedMs: 3_600_000,
  elapsedMs: 3_600_000
};

describe('HistoryPage', () => {
  let fixture: ComponentFixture<HistoryPage>;
  let httpMock: HttpTestingController;

  const page = () => fixture.nativeElement as HTMLElement;
  const rows = () => Array.from(page().querySelectorAll('tr.mat-mdc-row, tr[mat-row]')) as HTMLElement[];
  const listRequest = (): TestRequest => httpMock.expectOne((req) => req.url === '/api/sessions');
  const button = (label: string) =>
    Array.from(page().querySelectorAll('button')).find((b) => b.textContent?.trim() === label) as HTMLButtonElement;

  function open(sessions: SessionDetail[]) {
    fixture = TestBed.createComponent(HistoryPage);
    fixture.detectChanges();
    listRequest().flush(sessions);
    fixture.detectChanges();
  }

  function mockDialog(result: boolean) {
    const spy = vi.spyOn(TestBed.inject(MatDialog), 'open')
      .mockReturnValue({ afterClosed: () => of(result) } as never);
    return spy;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('load the current month on opening', () => {
    fixture = TestBed.createComponent(HistoryPage);
    fixture.detectChanges();

    const request = listRequest();
    const from = new Date(request.request.params.get('from') ?? '');
    const to = new Date(request.request.params.get('to') ?? '');

    expect(from.getDate()).toBe(1);
    expect(to.getDate()).toBe(1);
    expect(to.getTime()).toBeGreaterThan(from.getTime());
    request.flush([]);
  });

  it('display one row per session', () => {
    open([OPEN, CLOSED]);

    expect(rows()).toHaveLength(2);
  });

  it('differenciate two sessions of the same day', () => {
    open([OPEN, CLOSED]);

    const [first, second] = rows().map((row) => row.textContent ?? '');

    expect(first).toContain('n° 13');
    expect(second).toContain('n° 12');
    expect(first).not.toBe(second);
  });

  it ('signal clearly the open session', () => {
    open([OPEN, CLOSED]);

    const badges = Array.from(page().querySelectorAll('.badge')) as HTMLElement[];

    expect(badges.map((badge) => badge.textContent?.trim())).toEqual(['En cours', 'Terminée']);
    expect(badges[0].classList.contains('open')).toBe(true);
    expect(badges[1].classList.contains('open')).toBe(false);
    expect(rows()[0].textContent).toContain('-');
  });

  it('display the sub periods and the duration', () => {
    open([CLOSED]);

    expect(rows()[0].textContent).toContain('Pause');
    expect(rows()[0].textContent).toContain('3h00');
  });

  it('tell when no session matches', () => {
    open([]);

    expect(page().textContent).toContain('Aucune session sur cette période.');
  });

  it('reload the sessions with the chosen period', () => {
    open([]);
    const [from, to] = Array.from(page().querySelectorAll('input[type="date"]')) as HTMLInputElement[];

    from.value = '2026-09-01';
    from.dispatchEvent(new Event('input'));
    to.value = '2026-09-30';
    to.dispatchEvent(new Event('input'));
    button('Filtrer').click();

    const request = listRequest();
    expect(request.request.params.get('from')).toBe(startOfDay('2026-09-01'));
    expect(request.request.params.get('to')).toBe(startOfNextDay('2026-09-30'));
    request.flush([]);
  });

  it('refuse a period whose start follows its end, without calling the server', () => {
    open([]);
    const [from] = Array.from(page().querySelectorAll('input[type="date"]')) as HTMLInputElement[];

    from.value = '2099-01-01';
    from.dispatchEvent(new Event('input'));
    button('Filtrer').click();
    fixture.detectChanges();

    httpMock.expectNone((req) => req.url === '/api/sessions');
    expect(page().querySelector('[role="alert"]')?.textContent).toContain('période est invalide');
  });

  it('open the dialog with known datas for correction', () => {
    open([CLOSED]);
    const spy = mockDialog(false);

    (page().querySelector('[aria-label="Corriger la session n° 12"]') as HTMLButtonElement).click();

    expect(spy).toHaveBeenCalledWith(SessionDialog, expect.objectContaining({ data: { session: CLOSED }}));
  });

  describe('add and correction dialog', () => {
    it('open the empty dialog for an add', () => {
      open([]);
      const spy = mockDialog(false);

      button('Ajouter une session').click();

      expect(spy).toHaveBeenCalledWith(SessionDialog, expect.objectContaining({ data: { session: null } }));
    });

    it('reload the list after a save', () => {
      open([CLOSED]);
      mockDialog(true);

      button('Ajouter une session').click();

      listRequest().flush([CLOSED, OPEN]);
      fixture.detectChanges();
      expect(rows()).toHaveLength(2);
    });

    it('does not reload the list when the dialog is cancelled', () => { // NOSONAR
      open([CLOSED]);
      mockDialog(false);

      button('Ajouter une session').click();
      httpMock.expectNone((req) => req.url === '/api/sessions');
    });
  });
});
