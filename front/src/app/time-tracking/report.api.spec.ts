import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ReportApi } from './report.api';

describe('ReportApi', () => {
  let api: ReportApi;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ReportApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it("demande la semaine courante sans paramètre `date` quand aucune date n'est fournie", () => {
    api.weekly().subscribe();

    const request = httpMock.expectOne((req) => req.url === '/api/reports/weekly');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.has('date')).toBe(false);
    expect(request.request.urlWithParams).toBe('/api/reports/weekly');
    request.flush({});
  });

  it('envoie la date fournie telle quelle', () => {
    api.weekly('2026-01-12').subscribe();

    const request = httpMock.expectOne((req) => req.url === '/api/reports/weekly');
    expect(request.request.params.get('date')).toBe('2026-01-12');
    request.flush({});
  });

  it('renvoie le bilan reçu du serveur sans le transformer', () => {
    const report = { weekStart: '2026-01-05', totalMinutes: 1380 };
    let received: unknown;
    api.weekly().subscribe((value) => (received = value));

    httpMock.expectOne('/api/reports/weekly').flush(report);

    expect(received).toEqual(report);
  });
});
