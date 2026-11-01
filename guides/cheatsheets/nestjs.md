# NestJS — Fiche ClockOut

| | Valeur |
|---|---|
| **Versions** | `@nestjs/core` **12.1** · `@nestjs/typeorm` 12 · `class-validator` 0.15 · Vitest 4 |
| **Plateforme** | Express (`@nestjs/platform-express`) |
| **Modules** | **ESM** (`"type": "module"`) → imports relatifs en **`.js`** |
| **Préfixe global** | `/api` (`configureApp`, partagé par `main.ts` **et** les tests) |
| **Chemin** | `back/src/` |

---

## 1. Le Top 5 essentiel

| # | Règle | Dans ClockOut |
|---|-------|---------------|
| 1 | **1 module = 1 domaine** : `controllers` (HTTP) → `providers` (logique) | `TimeTrackingModule`, `PreferencesModule`, `HealthModule` |
| 2 | **Contrôleur mince** : parse/valide, délègue au service | `TimeTrackingController` → `TimeTrackingService` |
| 3 | **DTO + `ValidationPipe`** (`whitelist`, `forbidNonWhitelisted`, `transform`) | `SessionInputDto`, `WeeklyReportQueryDto` |
| 4 | **Erreurs métier = classes `Error`** traduites par un **`ExceptionFilter`** | `InvalidTransitionFilter` (409), `SessionErrorFilter` (422/409) |
| 5 | **Token DI = classe abstraite** (une `interface` est effacée) | `Clock` / `SystemClock`, remplaçable en test |

---

## 2. Tableau de syntaxe

| Fonctionnalité | Syntaxe / Exemple | Description rapide |
|----------------|-------------------|--------------------|
| **Module** | `@Module({ imports, controllers, providers, exports })` | Unité de composition |
| **Contrôleur** | `@Controller('sessions')` | Préfixe de route (→ `/api/sessions`) |
| **Verbe** | `@Get()` · `@Post('start')` · `@Put(':id')` | Route + méthode HTTP |
| **Code de retour** | `@HttpCode(HttpStatus.OK)` | **`POST` renvoie `201` par défaut** |
| **Paramètre de route** | `@Param('id', ParseIntPipe) id: number` | Extrait **et** convertit (`400` sinon) |
| **Query** | `@Query() q: WeeklyReportQueryDto` | Objet validé par le pipe |
| **Body** | `@Body() body: SessionInputDto` · `@Body('periodTypeId') v: unknown` | DTO complet ou un champ |
| **Injection (classe)** | `constructor(private readonly svc: Svc) {}` | Résolue par le **type** (`emitDecoratorMetadata`) |
| **Injection repo** | `@InjectRepository(Period) private readonly periods: Repository<Period>` | Exige `TypeOrmModule.forFeature([Period])` |
| **Provider** | `{ provide: Clock, useClass: SystemClock }` | Lie un token à une implémentation |
| **Pipe** | `@UsePipes(new ValidationPipe({ … }))` | Portée : globale, classe, méthode ou paramètre |
| **Filtre** | `@UseFilters(SessionErrorFilter)` · `@Catch(ErrA, ErrB)` | Traduit une exception en réponse |
| **Exception HTTP** | `throw new NotFoundException('…')` | Réponse standard (`404`, `400`…) |
| **Config** | `ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' })` | Charge `.env` |
| **Module dynamique async** | `TypeOrmModule.forRootAsync({ imports, inject, useFactory })` | Configuration issue de `ConfigService` |
| **Décorateur composé** | `applyDecorators(IsISO8601(…), Matches(…))` | Regroupe des décorateurs (`@IsInstant()`) |
| **DTO imbriqué** | `@ValidateNested({ each: true }) @Type(() => SubInputDto)` | `@Type` **obligatoire** pour instancier |
| **Validateur sur mesure** | `ValidateBy({ name, validator: { validate, defaultMessage } })` | `@IsCalendarDate()` |

**Carte des routes ClockOut**

| Route | Statut OK | Rôle |
|-------|:---------:|------|
| **`GET /api/health`** | 200 | Sonde (`{ status, service }`) |
| **`GET /api/time-tracking`** · **`/current`** | 200 | Liste · état de la session ouverte |
| **`POST /api/time-tracking/start`** | **201** | Ouvre la session |
| **`POST …/sub`** · **`/endsub`** · **`/end`** | **200** | Sous-période · reprise · fin |
| **`GET /api/sessions?from&to`** · **`/:id`** | 200 | Historique : `from`, `to` **obligatoires**, `from` inclus, `to` exclu, `400` si `from >= to` ; `404` si l'id n'existe pas |
| **`POST /api/sessions`** · **`PUT /:id`** | 201 · 200 | Création · correction manuelle |
| **`GET /api/reports/weekly?date=`** | 200 | Bilan hebdo (Europe/Paris) |
| **`GET` · `PUT /api/preferences/weekly-target`** | 200 | Objectif hebdomadaire |

---

## 3. Patterns ClockOut

### 3.1 Amorçage partagé — `app.setup.ts` / `main.ts`

```ts
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
}
// main.ts
const app = await NestFactory.create(AppModule);
configureApp(app);
await app.listen(process.env.API_PORT ?? 3000);
```

- **`configureApp`** est appelée aussi par `createTestApp()` : les tests voient les **mêmes URLs** que la prod.

### 3.2 Pipe de validation par contrôleur — `history.controller.ts`

```ts
@Controller('sessions')
@UseFilters(SessionErrorFilter)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class HistoryController { … }
```

| Option | Effet |
|--------|-------|
| **`whitelist`** | Retire les propriétés sans décorateur |
| **`forbidNonWhitelisted`** | Au lieu de les retirer → **`400`** |
| **`transform`** | Le body devient une **instance** du DTO |

- **Pas de pipe global** : déclaré sur `History`, `WeeklyReport` et `Preferences`.
- **`TimeTrackingController` sans pipe** : `periodTypeId` lu en `unknown` et contrôlé à la main (`parseSubType` → `BadRequestException`).

### 3.3 Filtre d'exception — `invalid-transition.filter.ts`

```ts
@Catch(InvalidTransitionError)
export class InvalidTransitionFilter implements ExceptionFilter<InvalidTransitionError> {
  catch(error: InvalidTransitionError, host: ArgumentsHost) {
    host.switchToHttp().getResponse<Response>()
      .status(HttpStatus.CONFLICT)
      .json({ statusCode: 409, error: 'Conflict', message: error.message, action: error.action, from: error.from });
  }
}
```

| Erreur métier | Filtre | HTTP |
|---------------|--------|:----:|
| **`InvalidTransitionError`** | `InvalidTransitionFilter` | **409** |
| **`SessionValidationError`** | `SessionErrorFilter` | **422** (+ `violations[]`) |
| **`SessionConflictError`** | `SessionErrorFilter` | **409** |

- **Le front lit ces corps** : `422` → `error.error.violations`, `409` → rechargement.

### 3.4 Token DI + remplacement en test — `clock.ts` / `test-app.ts`

```ts
export abstract class Clock { abstract now(): Date; }
@Injectable() export class SystemClock extends Clock { now() { return new Date(); } }
// module
{ provide: Clock, useClass: SystemClock }
// test
Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(Clock).useValue(fakeClock);
```

- **Résultat** : horaires déterministes dans les tests d'intégration (`FakeClock`).

### 3.5 Modules : exporter pour réutiliser — `preferences.module.ts`

```ts
@Module({
  imports: [TypeOrmModule.forFeature([Preferences])],
  providers: [PreferencesService],
  controllers: [PreferencesController],
  exports: [PreferencesService]
})
```

- **`TimeTrackingModule`** importe `PreferencesModule` pour injecter `PreferencesService` dans `WeeklyReportService`.
- **Sans `exports`** : `Nest can't resolve dependencies of WeeklyReportService`.

### 3.6 Configuration → TypeORM — `database.module.ts`

```ts
TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => databaseOptions((key) => config.get<string>(key)),
})
```

- **`databaseOptions(read)`** est pure : la même fonction sert à Nest, à la CLI TypeORM (`data-source.ts`) et aux tests.
- **Variable absente** → `Error('Variable absente: DB_HOST')` au démarrage.

### 3.7 Test d'intégration — `test/support/test-app.ts`

```ts
const app = moduleRef.createNestApplication({ logger: false });
configureApp(app);
await app.init();
await app.listen(0, '127.0.0.1');          // port libre
api = supertest(app.getHttpServer());
// …
await ctx.api.post('/api/time-tracking/start').expect(201);
```

- **`app.close()` dans `afterAll`** : libère le pool PostgreSQL (vérifié par `shutdown.e2e-spec.ts`).
- **`fileParallelism: false`** : les fichiers partagent la même base de test.

---

## 4. Cas particuliers / Astuces de pro

| Sujet | Règle |
|-------|-------|
| **Imports ESM** | `from './x.js'` même pour un `.ts` (voir fiche TypeScript) |
| **Statut `POST`** | `201` par défaut ; `@HttpCode(200)` pour une action qui ne crée rien |
| **Interface ≠ token** | Erasure → type émis `Object` → `Nest can't resolve dependencies` ; utiliser classe abstraite ou `@Inject('TOKEN')` |
| **Pipe local, pas global** | Un contrôleur sans `@UsePipes` ne valide **rien** (cas de `TimeTrackingController`) |
| **`@Type(() => Dto)`** | Sans lui, chaque élément du tableau est refusé en `400` (objet simple non reconnu) |
| **Ordre des routes** | `@Get('current')` **avant** `@Get(':id')` si les deux existent sur le même préfixe |
| **Filtre ciblé** | `@Catch(MonErreur)` n'attrape que cette classe ; les autres exceptions suivent le traitement par défaut de Nest |
| **Erreur inconnue** | Toute `Error` non attrapée → **`500`** `Internal server error` |
| **Transaction + verrou** | Le service ouvre `manager.transaction(...)` ; verrou `pessimistic_write` pour sérialiser les actions |
| **Unicité à deux niveaux** | Service (`assertTransition`) **et** index unique partiel PostgreSQL ; `23505` → `InvalidTransitionError` / `SessionConflictError` |
| **Priorité de config** | `ConfigModule` n'écrase pas `process.env` : `setup-env.ts` charge `.env.test` avant, donc il gagne sur `.env` |
| **Nouvelle entité** | `forFeature([...])` **et** `databaseOptions.entities`, puis une migration (`synchronize: false`) |
| **`@Param` + `ValidationPipe`** | `ParseIntPipe` et `ValidationPipe` s'exécutent tous deux sur `@Param` ; `transform` ne remplace pas `ParseIntPipe` |
| **Migrations hors démarrage** | `migrationsRun: false`, `synchronize: false` : on migre **explicitement** |
| **Pas de `enableShutdownHooks()`** | Absent de `main.ts` : `onApplicationShutdown` (qui ferme la connexion TypeORM) n'est pas appelé sur `SIGTERM` (à ajouter si des hooks d'arrêt deviennent utiles) |
| **`ConfigModule` global** | `ConfigService` injectable partout sans réimporter `ConfigModule` |
| **Tests unitaires de service** | Dépendances **construites à la main** (`new Service(repoFake, { now: () => NOW })`), sans `Test.createTestingModule` ; `FakeClock` sert aux tests d'intégration |
| **Isolation des tests d'intégration** | `resetDatabase()` + garde-fou : refuse sauf si `PROJECT_MODE=test`, `DB_HOST` local et `DB_NAME` en `_test` |

---

## 5. Dépannage / Erreurs courantes

| Erreur / Symptôme | Cause | Correctif |
|-------------------|-------|-----------|
| **`Cannot GET /time-tracking`** (404) | Préfixe global oublié | `/api/time-tracking` |
| **`Nest can't resolve dependencies of X (?, …)`** | Provider absent du module, module non importé/exporté, ou interface comme token | Ajouter dans `providers`/`imports`/`exports` ; classe abstraite |
| **`Nest can't resolve dependencies of the X (?) … argument "PeriodRepository"`** | Entité absente de `forFeature([...])` | L'ajouter dans le module du service |
| **`ERR_MODULE_NOT_FOUND` au runtime** | Import relatif sans `.js` | `'./x.js'` |
| **`400` `property x should not exist`** | `forbidNonWhitelisted` : champ inconnu dans le body | Retirer le champ ou l'ajouter au DTO |
| **`400` `x must be a valid ISO 8601…`** | `@IsInstant()` : format incorrect | `2026-10-22T09:00:00Z` |
| **`400` `x must include a time and a time zone`** | `@IsInstant()` : date sans heure ou sans fuseau | Ajouter `Z` ou `+02:00` (`+` encodé `%2B` dans une URL) |
| **`400` `date must be a valid date written YYYY-MM-DD`** | `@IsCalendarDate()` sur `/reports/weekly` | `2026-02-27` |
| **`400 Validation failed (numeric string is expected)`** | `ParseIntPipe` sur `:id` | Id numérique |
| **`409` sur `/start`, `/sub`, `/endsub`, `/end`** | Action interdite dans l'état courant (aussi `POST`/`PUT /sessions` : session ou sous-période déjà ouverte) | Lire `from`/`action` du corps ; recharger l'état |
| **`422` + `violations`** | Session incohérente (chevauchement, durée, sous-périodes) | Corriger les horaires |
| **`500` + `relation "period" does not exist`** | Migrations non appliquées | `npm run migration:run` (dev) · `migration:run:prod` (conteneur) |
| **`Variable absente: DB_HOST`** | `.env` absent ou incomplet | `cp .env.example .env` |
| **`EADDRINUSE :::3000`** | Port déjà pris (autre `start:dev`, conteneur) | Libérer le port ou changer `API_PORT` |
| **`ECONNREFUSED 127.0.0.1:15432`** | Base non démarrée | `docker compose up -d` dans `infra/` |
| **`Impossible de préparer la base de test`** | `db-test` arrêtée ou `.env.test` absent | `docker compose up -d --wait db-test` |
| **`Opération refusée, ce n'est pas une base de test`** | Garde-fou : `.env.test` pointe ailleurs | Corriger `.env.test` d'après le modèle |
| **Test d'intégration qui ne rend pas la main** | Application non fermée | `await app.close()` en `afterAll` |

---

## 6. Annexe — Commandes

| Où | Commande | Action |
|----|----------|--------|
| **`back/`** | `npm run start:dev` | Serveur + rechargement (`nest start --watch`) |
| **`back/`** | `npm run build` | `nest build` → `dist/` (`deleteOutDir`) |
| **`back/`** | `npm run start:prod` | `node dist/main` |
| **`back/`** | `npm test` | Tests unitaires (Vitest, **sans base**) |
| **`back/`** | `npm run test:e2e` | Intégration (exige `db-test` démarrée) |
| **`back/`** | `npm run lint` | `oxlint --type-aware src/ test/` |
| **`infra/`** | `docker compose up -d --wait db-test` | Base de test prête |
