# Angular — Fiche ClockOut

| | Valeur |
|---|---|
| **Versions** | Angular **22.2** · Material/CDK 22 · RxJS 7.8 · Vitest (builder `@angular/build:unit-test`) |
| **Architecture** | Composants **standalone**, **signals**, **zoneless** (pas de `zone.js`), détection **`OnPush` par défaut** |
| **Pages** | `Today` (pointage) · `History` (liste + correction) · `Results` (bilan hebdo) — chargées en **lazy** |
| **Chemin** | `front/src/app/` |

---

## 1. Le Top 5 essentiel

| # | Règle | Dans ClockOut |
|---|-------|---------------|
| 1 | **État = `signal()`**, dérivé = **`computed()`** | `TodayPage.status`, `canStart`, `clock` |
| 2 | **`inject()`** plutôt que le constructeur | `inject(TimeTrackingApi)` |
| 3 | **Un service HTTP par API**, typé, avec `@Service()` | `TimeTrackingApi`, `HistoryApi`, `ReportApi` |
| 4 | **Désabonnement automatique** : `takeUntilDestroyed(destroyRef)` | Pages, dialogue ; forme **sans argument** dans un constructeur (§3.5) |
| 5 | **Contrôle de flux natif** `@if` / `@for (… track …)` | `today-page.html`, `app.html` |

---

## 2. Tableau de syntaxe

| Fonctionnalité | Syntaxe / Exemple | Description rapide |
|----------------|-------------------|--------------------|
| **Composant** | `@Component({ imports, selector, templateUrl, styleUrl })` | Standalone par défaut |
| **Page lazy** | `loadComponent: () => import('./today-page/today-page')` | Fonctionne avec `export default class` |
| **Signal** | `signal<T>(init)` · `s()` lit · `s.set(v)` · `s.update(fn)` | État réactif |
| **Dérivé** | `computed(() => this.status() === 'none')` | Recalculé si une dépendance change |
| **Effet** | `effect(() => this.load(this.session()))` | Effet de bord réactif (constructeur) |
| **Entrée** | `input<T>(def)` · `input.required<T>()` | Lue comme un signal : `this.minutes()` |
| **Sortie** | `readonly save = output<number>()` · `this.save.emit(v)` | Événement vers le parent |
| **Service** | `@Service() export class Api { … }` | Fourni à la racine (`autoProvided: true` par défaut) |
| **Injection** | `private readonly api = inject(Api)` | Aussi : `DestroyRef`, `MatDialog`, `MatSnackBar` |
| **HTTP** | `http.get<T>(url, { params })` · `post<T>(url, body)` | Retourne un `Observable<T>` |
| **Interop RxJS** | `takeUntilDestroyed(this.destroyRef)` · `toSignal(obs$, { initialValue })` | Observable ↔ signal |
| **Contrôle** | `@if (cond; as v) { … } @else { … }` · `@for (x of xs; track x.id) { … }` | `track` obligatoire |
| **Liaison** | `[attr.aria-expanded]="open()"` · `[class.is-open]="open()"` · `(click)="go()"` | Attribut · classe · événement |
| **Hôte** | `host: { '(document:keydown.escape)': 'closeMenu()', '[class.menu-open]': 'menuOpen()' }` | À préférer à `@HostListener`/`@HostBinding` (toujours disponibles) |
| **Pipe** | `@Pipe({ name: 'minutes' })` + `{{ 450 \| minutes }}` | Pur par défaut |
| **Formulaire typé** | `inject(NonNullableFormBuilder).group({ … })` | `getRawValue()` typé |
| **Validateur** | `ValidatorFn = (c: AbstractControl): ValidationErrors \| null` | Champ ou groupe |
| **Routes** | `provideRouter(routes)` · `redirectTo` · `path: '**'` | `routes: Routes` |
| **Bootstrap** | `bootstrapApplication(App, appConfig)` | `appConfig.providers` : router, `provideHttpClient()` |
| **Material** | `MatButtonModule` + `<button matButton="filled">` | Valeurs : `text` (défaut) · `filled` · `elevated` · `outlined` · `tonal` |
| **Dialogue** | `dialog.open(SessionDialog, { data, width }).afterClosed()` | Données : `inject(MAT_DIALOG_DATA)` |

---

## 3. Patterns ClockOut

### 3.1 Bootstrap et routage lazy — `main.ts`, `app.config.ts`, `app.routes.ts`

```ts
bootstrapApplication(App, appConfig);

export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners(), provideRouter(routes), provideHttpClient()]
};

{ path: 'today', title: "Aujourd'hui", loadComponent: () => import('./today-page/today-page') }
```

- **`export default class`** dans chaque page → l'`import()` se passe de `.then(m => m.X)`.
- **`provideHttpClient()`** est requis dans `appConfig` **et** dans chaque `TestBed` dont le code touche à HTTP.
- **`path: '**'`** en dernier → redirection vers `/today`.

### 3.2 Service HTTP — `time-tracking.api.ts`

```ts
@Service()
export class TimeTrackingApi {
  private readonly http = inject(HttpClient);
  current()                       { return this.http.get<SessionResponse>('/api/time-tracking/current'); }
  startSub(periodTypeId: SubTypeId) { return this.http.post<SessionResponse>('/api/time-tracking/sub', { periodTypeId }); }
}
```

- **URLs relatives** `/api/…` : proxy en dev (`proxy.conf.json` → `127.0.0.1:3000`), Nginx en Docker/Kubernetes.
- **`@Service()`** : décorateur d'Angular 22, alternative recommandée à `@Injectable({ providedIn: 'root' })` (toujours disponible).

### 3.3 État par signals — `today-page.ts`

```ts
protected readonly session = signal<SessionResponse | null>(null);
protected readonly status  = computed(() => this.session()?.status ?? 'none');
protected readonly canStart    = computed(() => this.status() === 'none');
protected readonly canStartSub = computed(() => this.status() === 'period');
```

- **Le template lit des signals** (`canStart()`, `statusLabel()`, `clock()`) ; la logique reste dans le composant.
- **`protected`** : visible du template, invisible de l'extérieur.

### 3.4 Appel d'API anti double-clic — `today-page.ts`

```ts
private run(action: () => Observable<SessionResponse>): void {
  if (this.busy()) return;
  this.busy.set(true);
  action().pipe(
    switchMap(() => this.api.current()),
    finalize(() => this.busy.set(false)),
    takeUntilDestroyed(this.destroyRef)
  ).subscribe({ next: (s) => this.apply(s), error: (e) => this.fail(e) });
}
```

- **Verrou `busy`** + `[disabled]="busy()"` : un double clic = **une** requête (testé).
- **`switchMap` vers `current()`** : l'écran reflète toujours l'état **serveur**.
- **`finalize`** : `busy` repasse à `false` en succès **et** en erreur.

### 3.5 Chronomètre local recalé — `today-page.ts`

```ts
interval(TICK_MS).pipe(takeUntilDestroyed()).subscribe(() => this.now.set(Date.now()));
interval(REFRESH_MS).pipe(takeUntilDestroyed()).subscribe(() => { if (!this.busy()) this.refresh(); });

protected readonly clock = computed(() => {
  const session = this.session();
  return formatClock(session ? session.workedMs + this.sinceReceived() : 0);
});
```

- **Chaque seconde** : un signal `now` → seuls `clock()` et `elapsedClock()` sont recalculés.
- **Toutes les 30 s** : recalage sur la valeur serveur (pas de double comptage, testé).
- **`takeUntilDestroyed()` sans argument** : autorisé **dans le constructeur** (contexte d'injection).

### 3.6 Flux qui survit à l'erreur — `results-page.ts`

```ts
type Outcome = { report: WeeklyReport } | { error: unknown };

this.requests.pipe(
  switchMap((date) => this.reports.weekly(date).pipe(
    map((report): Outcome => ({ report })),
    catchError((error) => of<Outcome>({ error })))),
  takeUntilDestroyed(this.destroyRef)
).subscribe((o) => { if ('report' in o) … else … });
```

- **`switchMap`** annule la requête précédente : une réponse tardive ne remplace jamais la semaine demandée en dernier.
- **`catchError` à l'intérieur** du `switchMap` : le `Subject` reste vivant, l'utilisateur peut réessayer.

### 3.7 Formulaire réactif typé — `weekly-target-form.ts`

```ts
readonly minutes = input.required<number>();
readonly save    = output<number>();

protected readonly form = this.fb.group(
  { hours: this.fb.control(0, [Validators.required, integer, Validators.max(MAX_HOURS)]),
    minutes: this.fb.control(0, [Validators.required, integer, Validators.max(59)]) },
  { validators: withinMaximum });

constructor() { effect(() => this.reset(this.minutes())); }
```

- **`effect`** : le formulaire se réinitialise quand l'`input` change.
- **Validateur de groupe** (`withinMaximum`) : règle croisée heures + minutes.
- **`ErrorStateMatcher`** sur mesure : erreur affichée dès la saisie, pas seulement à la sortie du champ.

### 3.8 `FormArray` dynamique — `session-form.ts`

```ts
subs: this.fb.array<SubGroup>([])
protected addSub()            { this.subs.push(this.newSub(emptySub())); }
protected removeSub(i: number) { this.subs.removeAt(i); this.form.markAsDirty(); }
```

- **`SubGroup`** = `FormGroup<{ periodTypeId: FormControl<SubTypeId>; … }>` : tout est typé.
- **Règles métier partagées** : `validateDraft` (fonction pure) alimente le validateur de groupe `sessionRules`.

### 3.9 Dialogue Material — `history-page.ts` / `session-dialog.ts`

```ts
this.dialog.open(SessionDialog, { data, width: '760px', maxWidth: '96vw' })
  .afterClosed().subscribe((saved) => { if (saved) this.load(); });

protected readonly data = inject<SessionDialogData>(MAT_DIALOG_DATA);
private readonly dialogRef = inject<MatDialogRef<SessionDialog, boolean>>(MatDialogRef);
```

- **`422`** → `violations` affichées dans le formulaire ; **autres erreurs** → message.

### 3.10 Test de composant HTTP — `today-page.spec.ts`

```ts
TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
const fixture = TestBed.createComponent(TodayPage);
fixture.detectChanges();
httpMock.expectOne('/api/time-tracking/current').flush(WORKING);
fixture.detectChanges();
```

- **`vi.useFakeTimers()`** + `vi.advanceTimersByTime(5000)` : chronomètre testé sans attendre.
- **`httpMock.verify()`** en `afterEach` : aucune requête oubliée.

---

## 4. Cas particuliers / Astuces de pro

| Sujet | Règle |
|-------|-------|
| **`OnPush` par défaut** | Mutation d'objet **invisible** ; remplacer la référence (`signal.set`) |
| **Zoneless** | Pas de `zone.js` : seuls signals, `markForCheck` ou événements de template déclenchent la mise à jour |
| **`signal.set` hors template** | OK : le signal notifie lui-même la vue |
| **Lecture d'un signal** | Toujours **avec parenthèses** : `status()` ; sans, on lit la fonction |
| **`computed` pur** | Aucun `set` dedans ; effets de bord → `effect` ou méthode |
| **`effect`** | Contexte d'injection requis (constructeur ou champ) ; écrire dans un signal y est permis, à éviter pour la lisibilité |
| **`track` en `@for`** | Identifiant stable (`sub.id`, `link.path`) ; `track $index` seulement pour une liste sans identité (`session-form.html`) |
| **`standalone: true`** | Inutile (défaut) : présent par erreur dans `health-status.ts` |
| **Lazy + `export default`** | `import('…')` seul exige `export default class` ; sinon ajouter `.then(m => m.X)` |
| **Sélecteurs des pages** | Gardés (`app-today-page`) : les tests de routage les cherchent |
| **Erreurs HTTP** | Centralisées dans `describeError(error: unknown)` : `0/502/503/504` → « injoignable » |
| **`409` côté front** | Message + `refresh()` automatique : l'écran se réaligne sur le serveur |
| **Dates** | ISO UTC sur le fil ; `datetime-local` dans les formulaires ; conversion dans `session-form.model.ts` |
| **Accessibilité** | `aria-controls` + `[attr.aria-expanded]`, `role="alert"`, `aria-live="polite"`, classe `sr-only` |
| **Material** | `matButton="<apparence>"` remplace `mat-button`/`mat-flat-button` (anciens sélecteurs toujours acceptés) |
| **Budgets de build** | `initial` : 500 kB (warn) / 1 MB (erreur) ; style de composant : 4 kB / 8 kB |
| **Proxy dev** | `ng serve --proxy-config src/proxy.conf.json` ; sans lui, `GET /api` renvoie `index.html` (200, erreur de parsing JSON) et `POST` renvoie `404` |

---

## 5. Dépannage / Erreurs courantes

| Erreur / Symptôme | Cause | Correctif |
|-------------------|-------|-----------|
| **`NG0201: No provider found for HttpClient`** (tests) | `TestBed` sans HTTP | `provideHttpClient()` + `provideHttpClientTesting()` |
| **`NG0203: inject() must be called from an injection context`** | `inject`/`takeUntilDestroyed()` appelé dans une méthode ou un callback (pas dans un constructeur ou un initialiseur de champ) | Passer `destroyRef` explicitement |
| **`NG0100: ExpressionChangedAfterItHasBeenChecked`** | Valeur modifiée pendant la détection | Dériver par `computed`, ne pas écrire dans un getter |
| **L'UI ne se met pas à jour** | État muté (objet/tableau) ou valeur non-signal | `signal.set` avec un **nouvel** objet |
| **`NG8001: 'mat-card' is not a known element`** | Module Material absent de `imports` | Ajouter `MatCardModule` |
| **`NG8002: Can't bind to 'x' since it isn't a known property`** | `ReactiveFormsModule` ou directive non importé | L'ajouter à `imports` |
| **`Expected 1 matching request, found 0`** | Requête partie à un autre moment/URL | URL exacte ; `fixture.detectChanges()` avant `expectOne` si la requête part du template ou d'un `effect` (pour `TodayPage`, elle part dès `createComponent`) |
| **`Expected no open requests, found 1`** | `httpMock.verify()` et requête non traitée | `flush`/`match` toutes les requêtes |
| **Page vide au rechargement sur `/history`** | Pas de repli SPA | `try_files … /index.html` (Nginx) |
| **`/api/…` renvoie du HTML (GET) ou `404` (POST) en `ng serve`** | Proxy absent | `npm start` (script avec `--proxy-config`) |
| **« Serveur injoignable »** | API arrêtée (`0` ou `502`) | Démarrer le back / vérifier `docker compose ps` |
| **Budget dépassé au build** | Bundle initial ou CSS de composant trop gros | Lazy-loading, réduire le CSS |
| **Timers qui fuient dans un test** | `interval` non détruit | `fixture.destroy()` ; `takeUntilDestroyed` |
| **`NG0600: Writing to signals is not allowed in a computed`** | `set` dans `computed` | Déplacer dans `effect`/méthode (idem pour une écriture pendant le rendu du template) |

---

## 6. Annexe — Commandes

| Où | Commande | Action |
|----|----------|--------|
| **`front/`** | `npm start` | `ng serve` avec proxy `/api` → `127.0.0.1:3000` (port 4200) |
| **`front/`** | `npm run build` | Production → `dist/front/browser` |
| **`front/`** | `npm run watch` | Build de développement en continu |
| **`front/`** | `npm test` | `ng test` (Vitest) |
| **`front/`** | `npx tsc -p tsconfig.app.json --noEmit` | Type-check (voir fiche TypeScript) |
| **`front/`** | `npx ng generate component <nom>` | Générer un composant (**hors repo**) |
