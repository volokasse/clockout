import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { App } from './app';
import { Router, provideRouter } from "@angular/router";
import { provideHttpClient } from "@angular/common/http";
import { routes } from './app.routes';


const NO_SESSION = { status: 'none', session: null, sub: null, subs: [], workedMs: 0 };

describe('App routing', () => {
  let router: Router;
  let httpMock: HttpTestingController;

  async function render(url: string) {
    const fixture = TestBed.createComponent(App);
    await router.navigateByUrl(url);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()]
    });
    router = TestBed.inject(Router);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('display the history page on /history', async () => {
    const page = await render('/history');

    expect(page.querySelector('app-history-page')).not.toBeNull();
  });

  it('display the Results page on /results', async () => {
    const page = await render('/results');

    expect(page.querySelector('app-results-page')).not.toBeNull();
  });

  it('redirect root to /today and display Today page', async () => {
    const page = await render('/');

    expect(router.url).toBe('/today');
    expect(page.querySelector('app-today-page')).not.toBeNull();
    httpMock.match('/api/time-tracking/current').forEach((request) => request.flush(NO_SESSION));
  });

  it('display the 3 navigation links', async () => {
    const page = await render('/history');

    const labels = Array.from(page.querySelectorAll('nav a')).map((a) => a.textContent?.trim());
    expect(labels).toEqual(['Aujourd\'hui', 'Historique', 'Bilan']);
  });
});
