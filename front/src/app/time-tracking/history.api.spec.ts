import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SessionPayload } from './history.model';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HistoryApi } from './history.api';

const PAYLOAD: SessionPayload = {
  start: '2026-10-22T07:00:00.000Z',
  end: '2026-10-22T15:30:00.000Z',
  note: null,
  subs: [{ periodTypeId: 2, start: '2026-10-22T10:00:00.000Z', end: '2026-10-22T11:00:00.000Z' }]
};

describe('HistoryApi', () => {
  let api: HistoryApi;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(HistoryApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('read the sessions from a period with from and to', () => {
    api.list('2026-10-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z').subscribe();

    const request = httpMock.expectOne((req) => req.url === '/api/sessions');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('from')).toBe('2026-10-01T00:00:00.000Z');
    expect(request.request.params.get('to')).toBe('2026-11-01T00:00:00.000Z');
    request.flush([]);
  });

  it('create a session with POST', () => {
    api.create(PAYLOAD).subscribe();

    const request = httpMock.expectOne('/api/sessions');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(PAYLOAD);
    request.flush({});
  });

  it('edit a session with PUT on its identifier', () => {
    api.update(5, PAYLOAD).subscribe();

    const request = httpMock.expectOne('/api/sessions/5');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(PAYLOAD);
    request.flush({});
  });
});
