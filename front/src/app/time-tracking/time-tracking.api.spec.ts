import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TimeTrackingApi } from "./time-tracking.api"
import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import { PERIOD_TYPE } from "./sub-types";

describe('TimeTrackingApi', () => {
  let api: TimeTrackingApi;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    api = TestBed.inject(TimeTrackingApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('read a current session with GET', () => {
    api.current().subscribe();

    const request = httpMock.expectOne('/api/time-tracking/current');
    expect(request.request.method).toBe('GET');
    request.flush({});
  });

  it('send the type of sub period to start', () => {
    api.startSub(PERIOD_TYPE.SCOUTING).subscribe();

    const request = httpMock.expectOne('/api/time-tracking/sub');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ periodTypeId: 3 });
    request.flush({});
  });
});
