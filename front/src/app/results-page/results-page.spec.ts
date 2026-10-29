import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Observable, of, Subject } from 'rxjs';
import { ReportApi } from '../time-tracking/report.api';
import { DayTotal, WeeklyReport } from '../time-tracking/report.model';
import { WeeklyTargetForm } from '../weekly-target-form/weekly-target-form';
import ResultsPage from './results-page';

const REPORT_URL = '/api/reports/weekly';
const TARGET_URL = '/api/preferences/weekly-target';

/** One DayTotal per date, built from [minutes, sessions] pairs. */
function days(dates: string[], figures: [number, number][]): DayTotal[] {
  return dates.map((date, index) => ({
    date,
    workedMinutes: figures[index][0],
    sessionCount: figures[index][1],
  }));
}

const NO_FIGURES: [number, number][] = [
  [0, 0],
  [0, 0],
  [0, 0],
  [0, 0],
  [0, 0],
  [0, 0],
  [0, 0],
];

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
    [[60, 1], ...NO_FIGURES.slice(1)],
  ),
  totalMinutes: 60,
  deltaMinutes: -2040,
};

// The week before A: ten hours on Monday.
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
    [[600, 1], ...NO_FIGURES.slice(1)],
  ),
  totalMinutes: 600,
  deltaMinutes: -1500,
};

// A week without any session.
const WEEK_EMPTY: WeeklyReport = {
  ...WEEK_A,
  days: days(
    WEEK_A.days.map((day) => day.date),
    NO_FIGURES,
  ),
  totalMinutes: 0,
  deltaMinutes: -2100,
};

const text = (element: Element | null | undefined) =>
  (element?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('ResultsPage', () => {
  let fixture: ComponentFixture<ResultsPage>;
  let httpMock: HttpTestingController;

  const page = () => fixture.nativeElement as HTMLElement;
  const reportRequest = () => httpMock.expectOne((req) => req.url === REPORT_URL);
  const dayRows = () => Array.from(page().querySelectorAll('tr[mat-row]'));
  const cells = (row: Element) => Array.from(row.querySelectorAll('td')).map((cell) => text(cell));
  const weekLabel = () => text(page().querySelector('.week-label'));
  const indicator = (label: string) =>
    Array.from(page().querySelectorAll('.indicator')).find(
      (item) => text(item.querySelector('dt')) === label,
    );
  const fields = () =>
    Array.from(page().querySelectorAll('input[type="number"]')) as HTMLInputElement[];
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

  function type(field: HTMLInputElement, value: string) {
    field.value = value;
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('chargement', () => {
    it('charge la semaine courante sans paramètre `date`', () => {
      fixture = TestBed.createComponent(ResultsPage);
      fixture.detectChanges();

      const request = reportRequest();
      expect(request.request.method).toBe('GET');
      expect(request.request.params.has('date')).toBe(false);
      request.flush(WEEK_A);
    });

    it('affiche la barre de chargement pendant la requête, puis la retire', () => {
      fixture = TestBed.createComponent(ResultsPage);
      fixture.detectChanges();

      expect(page().querySelector('mat-progress-bar')).not.toBeNull();
      expect(weekLabel()).toBe('Chargement de la semaine…');

      reportRequest().flush(WEEK_A);
      fixture.detectChanges();

      expect(page().querySelector('mat-progress-bar')).toBeNull();
    });

    it("désactive les boutons de semaine tant que rien n'est chargé, pas le bouton « Cette semaine »", () => {
      fixture = TestBed.createComponent(ResultsPage);
      fixture.detectChanges();

      expect(button('Semaine précédente').disabled).toBe(true);
      expect(button('Semaine suivante').disabled).toBe(true);
      expect(button('Cette semaine').disabled).toBe(false);

      reportRequest().flush(WEEK_A);
      fixture.detectChanges();

      expect(button('Semaine précédente').disabled).toBe(false);
      expect(button('Semaine suivante').disabled).toBe(false);
    });
  });

  describe('affichage', () => {
    it('affiche le libellé de la semaine à partir des dates du serveur, sans décalage de fuseau', () => {
      open();

      expect(weekLabel()).toBe('Semaine du 05/01/2026 au 11/01/2026');
    });

    it("affiche une ligne par jour de la semaine, dans l'ordre du serveur", () => {
      open();

      expect(dayRows()).toHaveLength(7);
      expect(page().querySelectorAll('tr[mat-footer-row]')).toHaveLength(1);
    });

    it('affiche le tableau complet : 7 jours, ligne Total et trois indicateurs', () => {
      open();

      expect(dayRows().map(cells)).toEqual([
        ['Lundi 05/01', '2', '4h00'],
        ['Mardi 06/01', '0', '0h00'],
        ['Mercredi 07/01', '1', '7h30'],
        ['Jeudi 08/01', '2', '7h30'],
        ['Vendredi 09/01', '0', '0h00'],
        ['Samedi 10/01', '0', '0h00'],
        ['Dimanche 11/01', '1', '4h00'],
      ]);
      expect(cells(page().querySelector('tr[mat-footer-row]') as Element)).toEqual([
        'Total',
        '',
        '23h00',
      ]);
      expect(
        Array.from(page().querySelectorAll('.indicator')).map((item) => [
          text(item.querySelector('dt')),
          text(item.querySelector('dd')),
        ]),
      ).toEqual([
        ['Total', '23h00'],
        ['Objectif', '35h00'],
        ['Écart', '-12h00'],
      ]);
      expect(page().querySelector('.warning')).toBeNull();
      expect(page().querySelector('.alert')).toBeNull();
    });

    it('affiche 450 minutes sous la forme « 7h30 »', () => {
      open();

      expect(text(dayRows()[2])).toContain('7h30');
    });

    it.each([
      [-720, '-12h00', 'negative'],
      [60, '+1h00', 'positive'],
      [0, '0h00', null],
    ])("affiche l'écart %i sous la forme « %s » avec la classe %s", (delta, shown, cssClass) => {
      open({ ...WEEK_A, deltaMinutes: delta });

      const item = indicator('Écart');
      expect(text(item?.querySelector('dd'))).toBe(shown);
      expect(item?.classList.contains('negative')).toBe(cssClass === 'negative');
      expect(item?.classList.contains('positive')).toBe(cssClass === 'positive');
    });

    it('affiche une semaine vide : sept lignes à zéro, total nul, écart égal à -objectif', () => {
      open(WEEK_EMPTY);

      expect(dayRows()).toHaveLength(7);
      expect(dayRows().map((row) => cells(row).slice(1))).toEqual(
        Array.from({ length: 7 }, () => ['0', '0h00']),
      );
      expect(text(indicator('Total')?.querySelector('dd'))).toBe('0h00');
      expect(text(indicator('Écart')?.querySelector('dd'))).toBe('-35h00');
    });
  });

  describe('sessions non terminées', () => {
    const OPEN_SESSIONS = [
      { id: 12, date: '2026-01-09', start: '2026-01-09T08:00:00.000Z' },
      { id: 15, date: '2026-01-10', start: '2026-01-10T09:30:00.000Z' },
    ];

    it('avertit avec un role="status" et liste chaque session non terminée', () => {
      open({ ...WEEK_A, incompleteSessions: OPEN_SESSIONS });

      const warning = page().querySelector('[role="status"]');
      expect(warning).not.toBeNull();
      expect(text(warning)).toContain('ne sont pas comptées dans les totaux');
      expect(Array.from(warning?.querySelectorAll('li') ?? []).map((item) => text(item))).toEqual([
        '09/01/2026 — session n° 12',
        '10/01/2026 — session n° 15',
      ]);
    });

    it("n'affiche aucun avertissement quand toutes les sessions sont terminées", () => {
      open();

      expect(page().querySelector('.warning')).toBeNull();
      expect(text(page().querySelector('[role="status"]'))).toBe('');
    });

    it("retire l'avertissement quand on passe à une semaine sans session ouverte", () => {
      open({ ...WEEK_A, incompleteSessions: OPEN_SESSIONS });

      button('Semaine suivante').click();
      reportRequest().flush(WEEK_B);
      fixture.detectChanges();

      expect(page().querySelector('.warning')).toBeNull();
    });

    it('garde la même zone role="status" dans la page : seul son contenu apparaît et disparaît', () => {
      fixture = TestBed.createComponent(ResultsPage);
      fixture.detectChanges();
      const region = page().querySelector('[role="status"]');
      expect(region).not.toBeNull();

      reportRequest().flush({ ...WEEK_A, incompleteSessions: OPEN_SESSIONS });
      fixture.detectChanges();
      expect(page().querySelector('[role="status"]')).toBe(region);
      expect(text(region)).toContain('ne sont pas comptées dans les totaux');

      button('Semaine suivante').click();
      reportRequest().flush(WEEK_B);
      fixture.detectChanges();
      expect(page().querySelector('[role="status"]')).toBe(region);
      expect(text(region)).toBe('');
    });
  });

  describe('navigation', () => {
    it('envoie la date de `nextWeekStart` quand on demande la semaine suivante', () => {
      open();

      button('Semaine suivante').click();

      const request = reportRequest();
      expect(request.request.params.get('date')).toBe('2026-01-12');
      request.flush(WEEK_B);
      fixture.detectChanges();
      expect(weekLabel()).toBe('Semaine du 12/01/2026 au 18/01/2026');
      expect(text(indicator('Total')?.querySelector('dd'))).toBe('1h00');
    });

    it('envoie la date de `previousWeekStart` quand on demande la semaine précédente', () => {
      open();

      button('Semaine précédente').click();

      const request = reportRequest();
      expect(request.request.params.get('date')).toBe('2025-12-29');
      request.flush(WEEK_PREVIOUS);
      fixture.detectChanges();
      expect(weekLabel()).toBe('Semaine du 29/12/2025 au 04/01/2026');
    });

    it('enchaîne les semaines avec les dates fournies par chaque réponse', () => {
      open();

      button('Semaine suivante').click();
      reportRequest().flush(WEEK_B);
      fixture.detectChanges();
      button('Semaine suivante').click();

      const request = reportRequest();
      expect(request.request.params.get('date')).toBe('2026-01-19');
      request.flush(WEEK_B);
    });

    it('« Cette semaine » redemande la semaine courante, sans paramètre `date`', () => {
      open();
      button('Semaine suivante').click();
      reportRequest().flush(WEEK_B);
      fixture.detectChanges();

      button('Cette semaine').click();

      const request = reportRequest();
      expect(request.request.params.has('date')).toBe(false);
      request.flush(WEEK_A);
      fixture.detectChanges();
      expect(weekLabel()).toBe('Semaine du 05/01/2026 au 11/01/2026');
    });

    it('annule la requête précédente quand on change de semaine avant sa réponse', () => {
      open();

      button('Semaine suivante').click();
      button('Semaine précédente').click();

      const [first, second] = httpMock.match((req) => req.url === REPORT_URL);
      expect(first.request.params.get('date')).toBe('2026-01-12');
      expect(first.cancelled).toBe(true);
      expect(second.request.params.get('date')).toBe('2025-12-29');
      expect(second.cancelled).toBe(false);

      second.flush(WEEK_PREVIOUS);
      fixture.detectChanges();
      expect(weekLabel()).toBe('Semaine du 29/12/2025 au 04/01/2026');
    });
  });

  describe('erreurs', () => {
    it('affiche une alerte avec « Réessayer » quand le chargement échoue, puis recharge', () => {
      fixture = TestBed.createComponent(ResultsPage);
      fixture.detectChanges();
      reportRequest().flush(null, { status: 503, statusText: 'Service Unavailable' });
      fixture.detectChanges();

      expect(page().querySelector('.alert')?.getAttribute('role')).toBe('alert');
      expect(text(page().querySelector('.alert'))).toContain('Serveur injoignable');
      expect(weekLabel()).toBe('Bilan indisponible');
      expect(page().querySelector('mat-progress-bar')).toBeNull();

      button('Réessayer').click();
      const retry = reportRequest();
      expect(retry.request.params.has('date')).toBe(false);
      retry.flush(WEEK_A);
      fixture.detectChanges();

      expect(page().querySelector('.alert')).toBeNull();
      expect(dayRows()).toHaveLength(7);
    });

    it('réessaie la semaine demandée (pas la dernière affichée) après un échec de navigation', () => {
      open();
      button('Semaine suivante').click();
      reportRequest().flush(null, { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();

      expect(text(page().querySelector('.alert'))).toContain('erreur inattendue');
      expect(weekLabel()).toBe('Semaine du 05/01/2026 au 11/01/2026');

      button('Réessayer').click();
      const retry = reportRequest();
      expect(retry.request.params.get('date')).toBe('2026-01-12');
      retry.flush(WEEK_B);
      fixture.detectChanges();

      expect(page().querySelector('.alert')).toBeNull();
      expect(weekLabel()).toBe('Semaine du 12/01/2026 au 18/01/2026');
    });

    it('reste utilisable après une erreur : la navigation fonctionne encore', () => {
      open();
      button('Semaine suivante').click();
      reportRequest().flush(null, { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();

      button('Semaine précédente').click();

      const request = reportRequest();
      expect(request.request.params.get('date')).toBe('2025-12-29');
      request.flush(WEEK_PREVIOUS);
    });
  });

  describe('objectif hebdomadaire', () => {
    it("préremplit le formulaire d'objectif avec la valeur du serveur", () => {
      open();

      expect(fields().map((field) => field.value)).toEqual(['35', '0']);
    });

    it("enregistre l'objectif avec PUT, puis recharge la semaine courante", () => {
      open();

      type(fields()[0], '37');
      type(fields()[1], '30');
      button("Enregistrer l'objectif").click();

      const put = httpMock.expectOne((req) => req.url === TARGET_URL);
      expect(put.request.method).toBe('PUT');
      expect(put.request.body).toEqual({ minutes: 2250 });
      httpMock.expectNone((req) => req.url === REPORT_URL);
      put.flush({ minutes: 2250 });

      const reload = reportRequest();
      expect(reload.request.params.has('date')).toBe(false);
      reload.flush({ ...WEEK_A, targetMinutes: 2250, deltaMinutes: -870 });
      fixture.detectChanges();

      expect(text(indicator('Objectif')?.querySelector('dd'))).toBe('37h30');
      expect(text(indicator('Écart')?.querySelector('dd'))).toBe('-14h30');
      expect(fields().map((field) => field.value)).toEqual(['37', '30']);
    });

    it("recharge la semaine affichée (pas la semaine courante) après l'enregistrement", () => {
      open();
      button('Semaine suivante').click();
      reportRequest().flush(WEEK_B);
      fixture.detectChanges();

      type(fields()[0], '30');
      button("Enregistrer l'objectif").click();
      httpMock.expectOne((req) => req.url === TARGET_URL).flush({ minutes: 1800 });

      const reload = reportRequest();
      expect(reload.request.params.get('date')).toBe('2026-01-12');
      reload.flush({ ...WEEK_B, targetMinutes: 1800, deltaMinutes: -1740 });
      fixture.detectChanges();

      expect(weekLabel()).toBe('Semaine du 12/01/2026 au 18/01/2026');
      expect(text(indicator('Objectif')?.querySelector('dd'))).toBe('30h00');
    });

    it("désactive le bouton pendant l'enregistrement", () => {
      open();

      type(fields()[0], '36');
      button("Enregistrer l'objectif").click();
      fixture.detectChanges();

      expect(button("Enregistrer l'objectif").disabled).toBe(true);
      httpMock.expectOne((req) => req.url === TARGET_URL).flush({ minutes: 2160 });
      reportRequest().flush(WEEK_A);
      fixture.detectChanges();
      expect(button("Enregistrer l'objectif").disabled).toBe(false);
    });

    it("n'envoie qu'un seul PUT si le formulaire émet deux fois avant la réponse", () => {
      open();
      const form = fixture.debugElement.query(By.directive(WeeklyTargetForm))
        .componentInstance as WeeklyTargetForm;

      form.save.emit(2250);
      form.save.emit(2400);

      const puts = httpMock.match((req) => req.url === TARGET_URL);
      expect(puts).toHaveLength(1);
      expect(puts[0].request.body).toEqual({ minutes: 2250 });
      puts[0].flush({ minutes: 2250 });
      reportRequest().flush(WEEK_A);
    });

    it("n'envoie aucun PUT pour une valeur négative et explique pourquoi", () => {
      open();

      type(fields()[0], '-2');
      button("Enregistrer l'objectif").click();
      fixture.detectChanges();

      httpMock.expectNone((req) => req.url === TARGET_URL);
      expect(button("Enregistrer l'objectif").disabled).toBe(true);
      expect(text(page().querySelector('mat-error'))).toBe('Les heures vont de 0 à 168.');
    });

    it("affiche une alerte et ne recharge pas le bilan quand l'enregistrement échoue", () => {
      open();

      type(fields()[0], '36');
      button("Enregistrer l'objectif").click();
      httpMock
        .expectOne((req) => req.url === TARGET_URL)
        .flush(null, { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();

      expect(text(page().querySelector('.target .alert'))).toBe(
        "L'objectif n'a pas été enregistré. Le serveur a refusé la requête.",
      );
      httpMock.expectNone((req) => req.url === REPORT_URL);
      expect(button("Enregistrer l'objectif").disabled).toBe(false);
    });
  });

  describe('accessibilité', () => {
    it("nomme le tableau, la navigation et les zones annoncées par les lecteurs d'écran", () => {
      open({
        ...WEEK_A,
        incompleteSessions: [{ id: 1, date: '2026-01-06', start: '2026-01-06T08:00:00Z' }],
      });

      expect(page().querySelector('table')?.getAttribute('aria-label')).toBe(
        'Temps travaillé par jour de la semaine',
      );
      expect(page().querySelector('nav')?.getAttribute('aria-label')).toBe('Choix de la semaine');
      expect(page().querySelector('.week-label')?.getAttribute('aria-live')).toBe('polite');
      expect(page().querySelector('.indicators')?.getAttribute('aria-live')).toBe('polite');
      // Read as a whole ("Total 23h00 ..."), not only the figures that changed.
      expect(page().querySelector('.indicators')?.getAttribute('aria-atomic')).toBe('true');
      expect(page().querySelector('[role="status"]')).not.toBeNull();
      expect(page().querySelector('section.target')?.getAttribute('aria-labelledby')).toBe(
        'target-title',
      );
    });

    it('donne un nom accessible à la barre de chargement', () => {
      fixture = TestBed.createComponent(ResultsPage);
      fixture.detectChanges();

      expect(page().querySelector('mat-progress-bar')?.getAttribute('aria-label')).toBe(
        'Chargement du bilan hebdomadaire',
      );
      reportRequest().flush(WEEK_A);
    });

    it('garde le focus sur le bouton cliqué pendant le changement de semaine', () => {
      open();
      const next = button('Semaine suivante');
      next.focus();

      next.click();
      reportRequest().flush(WEEK_B);
      fixture.detectChanges();

      expect(document.activeElement).toBe(button('Semaine suivante'));
    });
  });
});

describe('ResultsPage : réponses tardives', () => {
  let fixture: ComponentFixture<ResultsPage>;

  const page = () => fixture.nativeElement as HTMLElement;
  const weekLabel = () => text(page().querySelector('.week-label'));
  const button = (label: string) =>
    Array.from(page().querySelectorAll('button')).find(
      (b) => text(b) === label,
    ) as HTMLButtonElement;

  /** `ReportApi.weekly` replaced by a stub whose answers the test releases by hand. */
  function openWith(...answers: Observable<WeeklyReport>[]) {
    const weekly = vi.fn<(date?: string) => Observable<WeeklyReport>>();
    answers.forEach((answer) => weekly.mockReturnValueOnce(answer));
    TestBed.configureTestingModule({
      providers: [
        { provide: ReportApi, useValue: { weekly } },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    fixture = TestBed.createComponent(ResultsPage);
    fixture.detectChanges();
    return weekly;
  }

  it("n'affiche que la dernière semaine demandée, même si une réponse plus ancienne arrive après", () => {
    const next = new Subject<WeeklyReport>();
    const previous = new Subject<WeeklyReport>();
    const weekly = openWith(of(WEEK_A), next, previous);

    // Two quick clicks: "next" (answer still pending), then "previous".
    button('Semaine suivante').click();
    button('Semaine précédente').click();
    expect(weekly.mock.calls.map(([date]) => date)).toEqual([
      undefined,
      '2026-01-12',
      '2025-12-29',
    ]);

    previous.next(WEEK_PREVIOUS);
    fixture.detectChanges();
    expect(weekLabel()).toBe('Semaine du 29/12/2025 au 04/01/2026');

    // The answer of the older request arrives late: it must change nothing.
    expect(next.observed).toBe(false);
    next.next(WEEK_B);
    fixture.detectChanges();

    expect(weekLabel()).toBe('Semaine du 29/12/2025 au 04/01/2026');
    expect(text(page().querySelector('tr[mat-footer-row]'))).toContain('10h00');
    expect(page().querySelector('mat-progress-bar')).toBeNull();
  });

  it("une réponse tardive n'éteint pas la barre de chargement de la requête en cours", () => {
    const next = new Subject<WeeklyReport>();
    const previous = new Subject<WeeklyReport>();
    openWith(of(WEEK_A), next, previous);

    button('Semaine suivante').click();
    button('Semaine précédente').click();
    next.next(WEEK_B);
    fixture.detectChanges();

    expect(page().querySelector('mat-progress-bar')).not.toBeNull();
    expect(weekLabel()).toBe('Semaine du 05/01/2026 au 11/01/2026');
  });

  it("une erreur tardive d'une ancienne requête ne masque pas la semaine affichée", () => {
    const next = new Subject<WeeklyReport>();
    const previous = new Subject<WeeklyReport>();
    openWith(of(WEEK_A), next, previous);

    button('Semaine suivante').click();
    button('Semaine précédente').click();
    previous.next(WEEK_PREVIOUS);
    next.error(new Error('trop tard'));
    fixture.detectChanges();

    expect(page().querySelector('.alert')).toBeNull();
    expect(weekLabel()).toBe('Semaine du 29/12/2025 au 04/01/2026');
  });
});
