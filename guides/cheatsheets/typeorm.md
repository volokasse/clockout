# TypeORM — Fiche ClockOut

| | Valeur |
|---|---|
| **Versions** | `typeorm` **1.1** · `@nestjs/typeorm` 12 · `pg` 8 |
| **Base** | PostgreSQL 18 (`type: 'postgres'`) |
| **Schéma** | **Migrations uniquement** : `synchronize: false`, `migrationsRun: false` |
| **Chemin** | `back/src/` — entités `time-tracking/entities/`, `preferences/entities/` ; migrations `database/migrations/` |

**Modèle**

```
period_type (1 Travail · 2 Pause · 3 Veille)
   ▲ ManyToOne                ▲ ManyToOne
period ───────OneToMany────▶ sub_period
 (start, end, note)           (start, end)

preferences  (singleton : id = 1)
```

---

## 1. Le Top 5 essentiel

| # | Règle | Dans ClockOut |
|---|-------|---------------|
| 1 | **Jamais de `synchronize`** : schéma = migrations versionnées | `database-options.ts` |
| 2 | **Toute entité est déclarée 2 fois** : `entities: [...]` **et** `forFeature([...])` | `database-options.ts` + `*.module.ts` |
| 3 | **`Relation<T>`** pour les propriétés de relation (ESM + décorateurs) | `period.entity.ts` |
| 4 | **Écritures dans `manager.transaction`** ; `pessimistic_write` sérialise quand une ligne existe (sinon, l'index unique tranche) | `TimeTrackingService.inTransaction` |
| 5 | **Invariants dans la base** (index unique partiel, `CHECK`), pas seulement dans le code | `UQ_period_single_open`, `preferences_singleton` |

---

## 2. Tableau de syntaxe

| Fonctionnalité | Syntaxe / Exemple | Description rapide |
|----------------|-------------------|--------------------|
| **Entité** | `@Entity()` sur la classe | Table `snake_case` (`SubPeriod` → `sub_period`) |
| **Clé auto** | `@PrimaryGeneratedColumn()` | `SERIAL` |
| **Clé manuelle** | `@PrimaryColumn()` | `preferences.id` (valeur fournie) |
| **Colonne** | `@Column({ type: 'timestamptz', nullable: true })` | Type PG explicite pour les dates |
| **Défaut SQL** | `default: () => 'CURRENT_TIMESTAMP'` | Fonction évaluée par PostgreSQL |
| **Nom de colonne** | `@Column({ name: 'weekly_target_minutes' })` | Sinon nom de la propriété (`camelCase`) |
| **N-1** | `@ManyToOne(() => PeriodType, { nullable: false }) @JoinColumn()` | Colonne `periodTypeId` + FK |
| **1-N** | `@OneToMany(() => SubPeriod, (s) => s.period)` | Côté inverse, sans colonne |
| **Contrainte** | `@Check('preferences_singleton', '"id" = 1')` | `CHECK` SQL nommé |
| **Index non géré** | `@Index('UQ_period_single_open', { synchronize: false })` | Index créé à la main, ignoré du diff |
| **Dépôt** | `Repository<Period>` via `@InjectRepository(Period)` | CRUD sur une entité |
| **Lecture** | `find({ where, relations, order })` · `findOne` · `findOneBy({ id })` | `findOne` renvoie `null` si absent |
| **Opérateurs** | `IsNull()` · `Not(1)` · `LessThan(d)` · `LessThanOrEqual` · `MoreThan(d)` · `MoreThanOrEqual(d)` · `And(a, b)` | Dans `where` |
| **OU** | `where: [ {…}, {…} ]` | Tableau = **OR** |
| **Projection** | `select: { id: true, start: true }` | Colonnes partielles |
| **Verrou** | `findOne({ where, lock: { mode: 'pessimistic_write' } })` | `SELECT … FOR UPDATE` |
| **Écriture** | `manager.save(Period, {…})` · `update(Entity, id, partial)` · `delete(Entity, criteria)` | Ids générés renvoyés par `save` |
| **Upsert** | `repo.upsert({ id: 1, weeklyTargetMinutes }, ['id'])` | `INSERT … ON CONFLICT` |
| **Transaction** | `repo.manager.transaction(async (manager) => { … })` | Commit/rollback automatiques |
| **SQL brut** | `manager.query('SELECT pg_advisory_xact_lock($1)', [key])` | Paramètres `$1…` |
| **QueryBuilder** | `repo.createQueryBuilder('p').leftJoinAndSelect('p.subPeriods', 's').where('…', { params }).getMany()` | Requêtes sur mesure |
| **Références par id** | `periodType: { id: 1 }` | Lie sans charger l'entité |

---

## 3. Patterns ClockOut

### 3.1 Entité avec relations — `period.entity.ts`

```ts
@Entity()
@Index('UQ_period_single_open', { synchronize: false })
export class Period {
  @PrimaryGeneratedColumn() id: number;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' }) start: Date;
  @Column({ type: 'timestamptz', nullable: true }) end: Date | null;
  @Column({ type: 'varchar', length: 500, nullable: true }) note: string | null;

  @ManyToOne(() => PeriodType, { nullable: false }) @JoinColumn()
  periodType: Relation<PeriodType>;

  @OneToMany(() => SubPeriod, (s) => s.period)
  subPeriods: Relation<SubPeriod[]>;
}
```

- **`Relation<T>`** : évite l'erreur d'initialisation circulaire (`Period` ↔ `SubPeriod`) en ESM.
- **`end: Date | null` + `nullable: true`** : `NULL` = session **ouverte**.
- **Type explicite** (`'varchar'`, `'timestamptz'`) : requis dès que le type TS est une union (`| null`).

### 3.2 Configuration unique — `database-options.ts`

```ts
return {
  type: 'postgres', host, port, username, password, database,
  entities: [Period, SubPeriod, PeriodType, Preferences],   // liste explicite
  migrations: [migrationsPath],                              // …/migrations/*.js
  migrationsTableName: 'typeorm_migrations',
  synchronize: false, migrationsRun: false,
  uuidExtension: 'pgcrypto', logging: ['error']
};
```

- **Trois consommateurs** : `DatabaseModule` (Nest), `data-source.ts` (CLI), `global-setup.ts` (tests).
- **Nouvelle entité** : l'ajouter ici **et** dans `forFeature` du module.

### 3.3 Invariant en base : un seul enregistrement ouvert — migration `SingleOpenSession`

```sql
CREATE UNIQUE INDEX "UQ_period_single_open"     ON "period" ((true)) WHERE "end" IS NULL;
CREATE UNIQUE INDEX "UQ_sub_period_single_open" ON "sub_period" ("periodId") WHERE "end" IS NULL;
```

- **`((true))` + `WHERE end IS NULL`** : au plus **une** ligne ouverte dans toute la table.
- **Violation** → `QueryFailedError.driverError.code === '23505'` → `isUniqueViolation(error)`.

### 3.4 Transaction + verrou — `time-tracking.service.ts`

```ts
private inTransaction<T>(work: (m: EntityManager, now: Date) => Promise<T>) {
  const now = this.clock.now();
  return this.periods.manager.transaction((manager) => work(manager, now));
}

const period = await manager.findOne(Period, {
  where: { end: IsNull() },
  lock: { mode: 'pessimistic_write' }      // sans relations : voir §4
});
```

- **Une seule horloge par opération** (`now` fixé avant la transaction).
- **Les sous-périodes** sont chargées par une **seconde requête** (`manager.find(SubPeriod, …)`), pas par `relations`.

### 3.5 Lecture avec relations et tri imbriqué — `history.service.ts`

```ts
this.periods.find({
  where: { start: And(MoreThanOrEqual(from), LessThan(to)) },   // [from, to[
  relations: { subPeriods: { periodType: true } },
  order: { start: 'DESC', subPeriods: { start: 'ASC' } }
});
```

- **`order`** peut descendre dans une relation chargée.
- **`relations` objet** : `{ a: { b: true } }` charge `a` puis `b`.

### 3.6 Détection de chevauchement : `where` en OU — `findPotentialClashes`

```ts
manager.find(Period, {
  select: { id: true, start: true, end: true },
  where: [
    { ...notSelf, ...startsBeforeEnd, end: IsNull() },
    { ...notSelf, ...startsBeforeEnd, end: MoreThan(input.start) }
  ]
});
```

- **Objets composés par *spread*** : conditions optionnelles (`{}` quand absentes).

### 3.7 Écritures en lot et suppression par relation — `history.service.ts`

```ts
await manager.delete(SubPeriod, { period: { id } });
await manager.save(SubPeriod, input.subs.map((s) => ({
  start: s.start, end: s.end, periodType: { id: s.periodTypeId }, period: { id: periodId }
})));
```

- **`save(Entity, tableau)`** renvoie les **mêmes objets mutés**, donc dans l'ordre fourni (le service s'appuie sur l'index).
- **Mise à jour d'une session** : suppression puis recréation de ses sous-périodes.

### 3.8 Sérialiser les écritures : verrou consultatif — `HistoryService.write`

```ts
await manager.query('SELECT pg_advisory_xact_lock($1)', [HISTORY_LOCK_KEY]);
```

- **`_xact_`** : verrou libéré au `COMMIT`/`ROLLBACK`.
- **Pourquoi** : la détection de chevauchement lit puis écrit ; deux requêtes simultanées passeraient toutes deux.

### 3.9 Requête sur mesure avec fuseau — `weekly-report.service.ts`

```ts
.where('period.start >= (CAST(:from AS timestamp) AT TIME ZONE :tz)', { from, tz: REPORT_TIME_ZONE })
.andWhere('period.start < (CAST(:to AS timestamp) AT TIME ZONE :tz)', { to, tz: REPORT_TIME_ZONE })
```

- **`CAST … AS timestamp` puis `AT TIME ZONE`** : minuit **Paris** correct, heure d'été comprise.
- **Paramètres nommés** `:from` : jamais de concaténation.

### 3.10 Upsert sur singleton — `preferences.service.ts`

```ts
await this.preferences.upsert({ id: SINGLETON_ID, weeklyTargetMinutes: minutes }, ['id']);
```

- **Seule la colonne fournie est écrasée** (`time_zone` conserve sa valeur).
- **Garde-fous SQL** : `CHECK ("id" = 1)` et `CHECK ("weekly_target_minutes" >= 0)`.

### 3.11 Migration — `AddSessionNote`

```ts
export class AddSessionNote1793099391184 implements MigrationInterface {
  public async up(q: QueryRunner)   { await q.query(`ALTER TABLE "period" ADD "note" character varying(500)`); }
  public async down(q: QueryRunner) { await q.query(`ALTER TABLE "period" DROP COLUMN "note"`); }
}
```

- **Nom = suffixe horodaté** : l'ordre d'exécution suit le timestamp.
- **`down` toujours écrit** : `migration:revert` en dépend.
- **Graine** : `SeedInitialData` insère `period_type` (ids **1, 2, 3**) et `preferences` (1, 2100, `Europe/Paris`) ; les constantes `PERIOD_TYPE` doivent coller.

---

## 4. Cas particuliers / Astuces de pro

| Sujet | Règle |
|-------|-------|
| **`pessimistic_write` hors transaction** | Lève `PessimisticLockTransactionRequiredError` : toujours via `manager.transaction` |
| **Verrou + `relations` en `LEFT JOIN`** | `FOR UPDATE cannot be applied to the nullable side of an outer join` (ex. `subPeriods`, OneToMany) : verrouiller **sans relations**, charger le reste à part |
| **Relation `nullable: false`** | Jointe en `INNER JOIN` : le verrou passe ; `lock: { mode, tables: [...] }` cible des **tables** (`FOR UPDATE OF`) |
| **Guillemets SQL** | `"end"` est un mot réservé et `"periodId"` est en `camelCase` : **doubles guillemets** en SQL brut |
| **Noms de colonnes** | FK = `<relation>Id` (`periodTypeId`) ; colonnes de `preferences` en `snake_case` via `name:` |
| **FK sans cascade** | `ON DELETE NO ACTION` : supprimer une `period` qui a des `sub_period` **échoue** → supprimer les enfants d'abord |
| **`@JoinColumn()` sur N-1** | Facultatif : `SubPeriod.period` n'en a pas et obtient `periodId` |
| **`uuidExtension: 'pgcrypto'`** | Sans effet ici (aucune colonne `uuid` générée) |
| **Séquence après graine** | `SeedInitialData` fixe les ids à la main : `period_type_id_seq` n'avance pas ; un futur `INSERT` sans id retomberait sur 1 (`23505`) |
| **`DB_HOST=localhost`** | `AggregateError` au message vide : utiliser `127.0.0.1` |
| **Production** | `typeorm` est en `dependencies` (`npm ci --omit=dev`) : migrer via `run --rm api npm run migration:run:prod` (Compose) ou le Job `migrate` (Kubernetes, à supprimer avant de rejouer) |
| **`save` partiel** | `save(Period, { periodType: { id: 1 } })` suffit : pas besoin de charger `PeriodType` |
| **`update` ≠ `save`** | `update` : un seul `UPDATE`, **pas** de chargement ; renvoie un `UpdateResult`, pas l'entité |
| **`findOne` sans `where`** | **Lève** `You must provide selection conditions…` ; seul `where: {}` renvoie une ligne quelconque |
| **`where: { end: null }`** | **Lève** `Null value encountered in property 'Period.end'…` : utiliser **`IsNull()`** |
| **`where: { x: undefined }`** | Lève aussi (`invalidWhereValuesBehavior`) : valider les entrées avant `find*` |
| **`Date` ↔ `timestamptz`** | PostgreSQL stocke un instant UTC ; `toISOString()` pour l'API |
| **Index partiel hors entité** | Déclaré avec `@Index(name, { synchronize: false })` pour que `migration:generate` ne le supprime pas |
| **`migration:generate` compile d'abord** | Le script lance `npm run build` : la CLI lit `dist/`, jamais `src/` |
| **Migrations sous Vitest** | Le motif `*.js` n'existe que dans `dist/` : `global-setup.ts` charge les classes `.ts` via `import.meta.glob` |
| **Migration appliquée = figée** | Ne jamais modifier : créer une nouvelle migration |
| **Isolation en test** | `TRUNCATE "sub_period","period" RESTART IDENTITY CASCADE` ; `period_type` (semée par migration) n'est pas touchée |
| **Ordre des résultats** | Sans `order`, aucun ordre garanti ; `order` imbriqué pour les relations |
| **Journalisation** | `logging: ['error']` ; ajouter `'query'` pour voir le SQL en débogage |

---

## 5. Dépannage / Erreurs courantes

| Erreur / Symptôme | Cause | Correctif |
|-------------------|-------|-----------|
| **`relation "period" does not exist`** | Migrations non jouées | `npm run migration:run` (dev) · `…:run:prod` (conteneur) |
| **`EntityMetadataNotFoundError: No metadata for "X"`** | Entité absente de `entities: [...]` | L'ajouter dans `database-options.ts` |
| **`Nest can't resolve dependencies of X (?, …) … argument "PeriodRepository"`** | Entité absente de `forFeature` | L'ajouter dans le module |
| **`QueryFailedError` code `23505`** | Index unique violé (2ᵉ session ouverte) | Attendu : géré par `isUniqueViolation` |
| **`QueryFailedError` code `23503`** | Clé étrangère (ex. `periodTypeId` inexistant, suppression d'un parent) | Données `period_type` semées ? Supprimer les enfants avant |
| **`QueryFailedError` code `23514`** | `CHECK` violé (`id = 1`, objectif ≥ 0) | Valeur valide |
| **`column "periodtypeid" does not exist`** | SQL brut sans guillemets | `"periodTypeId"` |
| **`No changes in database schema were found`** | Entité inchangée ou `dist/` périmé | Modifier l'entité ; le script rebuild déjà |
| **`generate` propose de supprimer un index** | Index créé à la main non déclaré | `@Index(name, { synchronize: false })` |
| **`ReferenceError: Cannot access 'X' before initialization`** | Import circulaire entre entités | `import type { Relation }` + `Relation<T>` |
| **`PessimisticLockTransactionRequiredError`** | Verrou hors transaction | Envelopper dans `transaction` |
| **`ECONNREFUSED 127.0.0.1:15432`** (dev) · **`…:15433`** (tests) | Base arrêtée | `docker compose up -d` · tests : `docker compose up -d --wait db-test` (profil `test`) |
| **`password authentication failed`** | Mot de passe ≠ celui de la 1ʳᵉ initialisation du volume | Aligner `.env` ou `ALTER USER` ; `down -v` efface tout |
| **`relation "period" already exists`** | Base créée hors migrations (ex. `synchronize`) | Repartir d'une base vide |
| **`Opération refusée, ce n'est pas une base de test`** | Garde-fou : exige `PROJECT_MODE=test`, `DB_HOST` local, `DB_NAME` en `_test`, puis `current_database()` en `_test` | Corriger `.env.test` |

---

## 6. Annexe — Commandes

| Où | Commande | Action |
|----|----------|--------|
| **`back/`** | `npm run migration:generate -- src/database/migrations/Nom` | Génère d'après le diff entités ↔ base (rebuild d'abord) |
| **`back/`** | `npm run migration:create -- src/database/migrations/Nom` | Migration vide à écrire |
| **`back/`** | `npm run migration:show` | Liste et statut |
| **`back/`** | `npm run migration:run` | Applique les migrations en attente |
| **`back/`** | `npm run migration:revert` | Annule **la dernière** |
| **`back/`** | `npm run migration:run:prod` | Sans rebuild (`dist/` déjà présent, image Docker) |
| **`infra/`** | `docker exec -it <conteneur-db> psql -U root -d clockout` | Console SQL (dev) |
