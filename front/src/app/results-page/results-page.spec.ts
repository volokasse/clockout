import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DayTotal, WeeklyReport } from '../time-tracking/report.model';
import ResultsPage from './results-page';

const REPORT_URL = '/api/reports/weekly';

/** One DayTotal per date, built from [minutes, sessions] pairs. */
function days(dates: string[], figures: [number, number][]): DayTotal[] {
  return dates.map((date, index) => ({
    date,
    workedMinutes: figures[index][0],
    sessionCount: figures[index][1],
  }));
}

// Week A of the hand-checked data set: Monday 2026-01-05 -> Sunday 2026-01-11 (1380 min).
const WEEK_A: WeeklyReport = {
  timeZone: 'Europe/Paris',
  weekStart: '2026-01-05',
  weekEnd: '2026-01-11',
  previousWeekStart: '2025-12-29',
  nextWeekStart: '2026-01-12',
  days: days(
    [
      '2026-01-05',
      '2026-01-06',
      '2026-01-07',
      '2026-01-08',
      '2026-01-09',
      '2026-01-10',
      '2026-01-11',
    ],
    [
      [240, 2],
      [0, 0],
      [450, 1],
      [450, 2],
      [0, 0],
      [0, 0],
      [240, 1],
    ],
  ),
  totalMinutes: 1380,
  targetMinutes: 2100,
  deltaMinutes: -720,
  incompleteSessions: [],
};

// Week B: Monday 2026-01-12 -> Sunday 2026-01-18, one hour on Monday.
const WEEK_B: WeeklyReport = {
  ...WEEK_A,
  weekStart: '2026-01-12',
  weekEnd: '2026-01-18',
  previousWeekStart: '2026-01-05',
  nextWeekStart: '2026-01-19',
  days: days(
    [
      '2026-01-12',
      '2026-01-13',
      '2026-01-14',
      '2026-01-15',
      '2026-01-16',
      '2026-01-17',
      '2026-01-18',
    ],
    [
      [60, 1],
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
    ],
  ),
  totalMinutes: 60,
  deltaMinutes: -2040,
};

// The week before A.
const WEEK_PREVIOUS: WeeklyReport = {
  ...WEEK_A,
  weekStart: '2025-12-29',
  weekEnd: '2026-01-04',
  previousWeekStart: '2025-12-22',
  nextWeekStart: '2026-01-05',
  days: days(
    [
      '2025-12-29',
      '2025-12-30',
      '2025-12-31',
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
      '2026-01-04',
    ],
    [
      [600, 1],
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
    ],
  ),
  totalMinutes: 600,
  deltaMinutes: -1500,
};

describe('ResultsPage', () => {
  let fixture: ComponentFixture<ResultsPage>;
  let httpMock: HttpTestingController;

  const page = () => fixture.nativeElement as HTMLElement;
  const text = (element: Element | null | undefined) =>
    (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const reportRequest = () => httpMock.expectOne((req) => req.url === REPORT_URL);
  const dayRows = () => Array.from(page().querySelectorAll('tr[mat-row]'));
  const indicator = (label: string) =>
    Array.from(page().querySelectorAll('.indicator')).find(
      (item) => text(item.querySelector('dt')) === label,
    );
  const button = (label: string) =>
    Array.from(page().querySelectorAll('button')).find(
      (b) => text(b) === label,
    ) as HTMLButtonElement;

  function open(response: WeeklyReport = WEEK_A) {
    fixture = TestBed.createComponent(ResultsPage);
    fixture.detectChanges();
    reportRequest().flush(response);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('charge la semaine courante sans paramètre `date`', () => {
    fixture = TestBed.createComponent(ResultsPage);
    fixture.detectChanges();

    const request = reportRequest();
    expect(request.request.method).toBe('GET');
    expect(request.request.params.has('date')).toBe(false);
    request.flush(WEEK_A);
  });

  it("affiche une ligne par jour de la semaine, dans l'ordre du serveur", () => {
    open();

    expect(dayRows()).toHaveLength(7);
    expect(page().querySelectorAll('tr[mat-footer-row]')).toHaveLength(1);
  });

  it('affiche 450 minutes sous la forme « 7h30 »', () => {
    open();

    expect(text(dayRows()[2])).toContain('7h30');
  });

  it("affiche l'écart avec son signe et la classe « negative »", () => {
    open();

    const delta = indicator('Écart');
    expect(text(delta?.querySelector('dd'))).toBe('-12h00');
    expect(delta?.classList.contains('negative')).toBe(true);
    expect(delta?.classList.contains('positive')).toBe(false);
  });

  it('envoie la date de `nextWeekStart` quand on demande la semaine suivante', () => {
    open();

    button('Semaine suivante').click();

    const request = reportRequest();
    expect(request.request.params.get('date')).toBe('2026-01-12');
    request.flush(WEEK_B);
    fixture.detectChanges();
    expect(text(page().querySelector('.week-label'))).toBe('Semaine du 12/01/2026 au 18/01/2026');
  });

  it('envoie la date de `previousWeekStart` quand on demande la semaine précédente', () => {
    open();

    button('Semaine précédente').click();

    const request = reportRequest();
    expect(request.request.params.get('date')).toBe('2025-12-29');
    request.flush(WEEK_PREVIOUS);
  });
});
