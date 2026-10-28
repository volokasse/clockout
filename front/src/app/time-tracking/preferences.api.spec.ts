import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PreferencesApi } from './preferences.api';

describe('PreferencesApi', () => {
  let api: PreferencesApi;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(PreferencesApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it("lit l'objectif hebdomadaire avec GET", () => {
    let received: unknown;
    api.weeklyTarget().subscribe((target) => (received = target));

    const request = httpMock.expectOne('/api/preferences/weekly-target');
    expect(request.request.method).toBe('GET');
    request.flush({ minutes: 2100 });
    expect(received).toEqual({ minutes: 2100 });
  });

  it("enregistre l'objectif hebdomadaire avec PUT et le corps { minutes }", () => {
    let received: unknown;
    api.updateWeeklyTarget(2250).subscribe((target) => (received = target));

    const request = httpMock.expectOne('/api/preferences/weekly-target');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ minutes: 2250 });
    request.flush({ minutes: 2250 });
    expect(received).toEqual({ minutes: 2250 });
  });
});
