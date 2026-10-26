import { ComponentFixture, TestBed } from '@angular/core/testing';
import TodayPage from './today-page';
import { SessionResponse, SubSpan } from '../time-tracking/session.model';
import { PERIOD_TYPE } from '../time-tracking/sub-types';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

const CURRENT_URL = '/api/time-tracking/current';
const START_URL = '/api/time-tracking/start';

const NONE: SessionResponse = { status: 'none', session: null, sub: null, subs: [], workedMs: 0, elapsedMs: 0 };

const WORKING: SessionResponse = {
  status: 'period',
  session: { id: 1, start: '2026-10-22T07:00:00.000Z', end: null },
  sub: null,
  subs: [],
  workedMs: 60_000,
  elapsedMs: 60_000
};

const OPEN_BREAK: SubSpan = {
  id: 5,
  start: '2026-10-22T08:00:00.000Z',
  end: null,
  periodTypeId: PERIOD_TYPE.BREAK
};

const ON_BREAK: SessionResponse = {
  ...WORKING,
  status: 'subed',
  sub: OPEN_BREAK,
  subs: [OPEN_BREAK]
};

describe('TodayPage', () => {
  let fixture: ComponentFixture<TodayPage>;
  let httpMock: HttpTestingController;

  const page = () => fixture.nativeElement as HTMLElement;
  const buttonLabels = () => Array.from(
    page().querySelectorAll('button')).map((button) => button.textContent?.trim()
  );
  const clock = () => page().querySelector('.clock')?.textContent?.trim();

  function create() {
    fixture = TestBed.createComponent(TodayPage);
    fixture.detectChanges();
  }

  function open(response: SessionResponse) {
    create();
    httpMock.expectOne(CURRENT_URL).flush(response);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => vi.useRealTimers());

  it('displays only "Commencer" wen a session is not open', () => {
    open(NONE);

    expect(page().textContent).toContain('Aucune session');
    expect(buttonLabels()).toEqual(['Commencer']);
  });

  it('display the running session with authorized actions', () => {
    open(WORKING);

    expect(page().textContent).toContain('Travail');
    expect(page().textContent).toContain('Arrivée');
    expect(buttonLabels()).toEqual(['Pause', 'Veille', 'Terminer']);
  });

  it('display "Reprendre" only when pause active', () => {
    open(WORKING);
    expect(buttonLabels()).not.toContain('Reprendre');

    fixture.destroy();
    open(ON_BREAK);

    expect(page().textContent).toContain('En pause');
    expect(page().textContent).toContain('Pauses et veilles');
    expect(buttonLabels()).toEqual(['Reprendre', 'Terminer']);
  });

  it('only launch one request when double click', () => {
    open(NONE);
    const button = page().querySelector('button') as HTMLButtonElement;

    button.click();
    button.click();

    expect(httpMock.match(START_URL)).toHaveLength(1);
  });

  it('display an alert when the server is unreachable', () => {
    create();

    httpMock.expectOne(CURRENT_URL).error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(page().querySelector('[role="alert"]')?.textContent).toContain('injoignable');
  });

  it('display the same alert when a proxy answer 504 because the API is not running', () => {
    create();

    httpMock.expectOne(CURRENT_URL).flush('', { status: 502, statusText: 'Bad Gateway' });
    fixture.detectChanges();

    expect(page().querySelector('[role="alert"]')?.textContent).toContain('injoignable');
  });

  it('make timer increment overall', () => {
    vi.useFakeTimers();
    open(WORKING);
    expect(clock()).toBe('00:01:00');

    vi.advanceTimersByTime(5000);
    fixture.detectChanges();
    expect(clock()).toBe('00:01:05');

    fixture.destroy();
    open(ON_BREAK);
    vi.advanceTimersByTime(5000);
    fixture.detectChanges();
    expect(clock()).toBe('00:01:05');
  });

  it('stops timers when the component is destroyed', () => {
    vi.useFakeTimers();
    open(WORKING);
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    fixture.destroy();

    expect(vi.getTimerCount()).toBe(0);
  });

  it('show the elapsed time next to the worked time', () => {
    open(WORKING);

    expect(page().querySelector('.elapsed')?.textContent).toContain('00:01:00');
  });

  it('does not run the counters when no session is open', () => {
    vi.useFakeTimers();
    open(NONE);

    vi.advanceTimersByTime(5000);
    fixture.detectChanges();

    expect(clock()).toBe('00:00:00');
    expect(page().querySelector('.elapsed')?.textContent).toContain('00:00:00');
  });

  it('realigns on the server value after each refresh (no double counting)', () => {
    vi.useFakeTimers();
    open(WORKING);

    vi.advanceTimersByTime(30_000);
    httpMock.expectOne(CURRENT_URL).flush({ ...WORKING, workedMs: 90_000, elapsedMs: 90_000 });
    fixture.detectChanges();

    expect(clock()).toBe('00:01:30');
    expect(page().querySelector('.elapsed')?.textContent).toContain('00:01:30');
  });
});
