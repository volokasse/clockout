# ClockOut

Cette application a pour but de me permettre d'avoir une vue d'ensemble sur mes heures de travail.

## Description

L'application est découpée en 3 pages distinctes :

1. **Today**\
Cette page va servir à contrôler la majoritée des actions de l'application.
    - L'utilisateur va pouvoir démarrer et terminer une période de travail.
    - L'utilisateur va pouvoir démarrer et terminer des sous périodes lorsqu'une période de travail est en cours (par exemple une période de pause).

2. **History**\
Cette page va servir à lister les différentes périodes de travail déjà éffectuées dans un ordre chronologique (dernier au début).
    - L'utilisateur va pouvoir cliquer sur une période de travail pour voir les sous-périodes associées.
    - L'utilisateur va pouvoir modifier les différentes valeurs des périodes et sous-périodes à sa guise, notamment dans un but correctif.
    - L'utilisateur va pouvoir ajouter une période et ses sous-périodes manuellement.
    - L'utilisateur va pouvoir supprimer une période et/ou ses sous-périodes.

3. **Results**\
Cette page va servir à afficher des statistiques pertinentes pour l'utilisateur, notamment :
    - son temps de travail total sur le mois (et les mois précédents)
    - son temps de travail sur les semaines composants le mois en cours (et les semaines des mois précédents)
    - la balance positive ou négative de son temps de travail total (sur une période donnée)
    - la répartition général de son temps de travail sur le mois en cours (par sous-périodes)

## Utilisation

### Prérequis

- Node.js compatible avec le front, npm, git.
- Angular et NestJS cli à jour.
- Un gestionnaire de conteneurs fonctionnel (Docker Desktop).

### Installation

1. Dans front : ```npm ci```
2. Dans back : ```npm ci```
3. Copier ```infra/.env.example``` vers ```infra/.env```
4. Copier ```back/.env.example``` vers ```back/.env```
5. Adapter les identifiants et informations si nécessaire

### Démarrage (trois terminaux)

1. Dans infra : ```docker compose up -d```
2. Dans front : ```npm start```
3. Dans back : ```npm run start:dev```

### Accès

- Front : [http://localhost:4200](http://localhost:4200)
- Back (API) : [http://localhost:3000/api/health](http://localhost:3000/api/health)
- PostgreSQL : 127.0.0.1:5432, DB : clockout
- Identifiants locaux : voir ```infra/.env```

### Arrêt

- Ctrl+C pour le front et le back
- Dans infra : ```docker compose down``` pour la DB
  - Ne pas utiliser l'argument -v dans la commande sous risque de perte des données.

### Back

#### Database migrations

- ```npm run migration:generate -- src/database/migrations/MigrationName``` to generate a migration file from changes applied to entities in project
- ```npm run migration:create -- src/database/migrations/MigrationName``` to create a migration file that you can populate freely
- ```npm run migration:show``` to list all migrations and their status
- ```npm run migration:run``` to run waiting migrations
- ```npm run migration:revert``` to revert last migration

### Tests et vérifications

- npm run build dans front puis back.
- npm run test dans front puis back.
- Bouton vérifier l'API : succès, panne, reprise.
- Persistance des données du PostgreSQL vérifiée après down/up.

### Tests d'intégration

Les tests d'intégration (`back/test/*.e2e-spec.ts`) démarrent la vraie application NestJS, appellent l'API avec Supertest et relisent PostgreSQL. Ils utilisent une base **réservée aux tests**, dans un second conteneur : la base de développement n'est jamais touchée.

| | Développement | Tests |
| ------- | ---------- | ---------- |
| Conteneur | `db` | `db-test` (profil compose `test`) |
| Port | `POSTGRES_PORT` | `POSTGRES_TEST_PORT` (15433) |
| Base / utilisateur | `clockout` / `root` | `clockout_test` / `clockout_test` |
| Données | volume persistant | `tmpfs` : effacées à l'arrêt du conteneur |
| Configuration du back | `back/.env` | `back/.env.test` |

#### Préparation (une seule fois)

1. Ajouter à `infra/.env` les variables `POSTGRES_TEST_*` de `infra/.env.example` (tant qu'elles manquent, chaque commande `docker compose` affiche des avertissements).
2. Copier ```back/.env.test.example``` vers ```back/.env.test``` (PowerShell : `Copy-Item back/.env.test.example back/.env.test`).
3. Les ports et identifiants de `back/.env.test` doivent correspondre à ceux de `infra/.env`.

#### Lancer les tests

1. Dans infra : ```docker compose up -d --wait db-test``` (attend que la base soit prête ; sans effet sur `db`)
2. Dans back : ```npm run test:e2e```
3. Pour arrêter la base de test, dans infra : ```docker compose rm -sf db-test```
   - Ne pas utiliser `docker compose down` pour cela : il arrête aussi la base de développement.

`npm test` reste la commande des tests unitaires : elle n'a besoin d'aucune base et ne lance pas les tests d'intégration.

#### Si le lancement échoue

Le message commence par `Impossible de préparer la base de test :` et aucun test n'a été exécuté.

- `connect ECONNREFUSED 127.0.0.1:15433` : la base de test n'est pas démarrée (voir « Lancer les tests », point 1).
- `back/.env.test introuvable` ou `.env.test incomplet` : recopier le modèle `back/.env.test.example` (voir Préparation).
- `Opération refusée, ce n'est pas une base de test` : `.env.test` désigne autre chose qu'une base de test. Rien n'a été exécuté ; corriger `.env.test` d'après le modèle.
- Les `console.log` des tests réussis sont masqués (`silent: 'passed-only'` dans `vitest.config.e2e.ts`) ; ils s'affichent si le test échoue.

#### Comment la base de développement est protégée

- `.env.test` doit contenir toutes les clés `DB_*` et `PROJECT_MODE`, et il écrase les variables du shell : une clé oubliée ne peut pas être complétée par `back/.env`.
- Avant toute migration ou remise à zéro, `PROJECT_MODE` doit valoir `test`, `DB_HOST` être local et `DB_NAME` se terminer par `_test`. Puis, une fois connecté, `current_database()` doit aussi se terminer par `_test`. Sinon l'opération est refusée et rien n'est exécuté.
- Avant chaque test, `period` et `sub_period` sont vidées (`TRUNCATE ... RESTART IDENTITY`) et l'objectif hebdomadaire est remis à 2100 minutes. Les types de période (semés par les migrations) ne sont pas touchés.
- Les migrations sont appliquées automatiquement au démarrage de `npm run test:e2e`.

#### Règles pour écrire un test d'intégration

- Un fichier = une application (`createTestApp()` dans `beforeAll`, `app.close()` dans `afterAll`) ; les fichiers s'exécutent l'un après l'autre car ils partagent la même base.
- Chaque test commence par `resetDatabase()` : il ne doit dépendre d'aucun autre test. Vérification : `npm run test:e2e -- --sequence.shuffle`.
- L'heure vient d'une `FakeClock` avancée à la main, jamais de l'horloge réelle.

## SPECIFIC RULES

### Weekly report rules

These rules apply to the **Report** screen (Results page) and to the `GET /api/reports/weekly` route.

| Rule | Decision |
| ------- | ---------- |
| Week | From Monday 00:00 (inclusive) to the following Monday 00:00 (exclusive) |
| Time zone | Europe/Paris (`REPORT_TIME_ZONE` constant), never the machine's time zone |
| Assignment | A session counts toward the day (Paris time) on which it **starts** |
| Midnight | A session that crosses midnight counts in full toward its start day |
| Open sessions | Excluded from totals; listed under "incomplete sessions" |
| Session duration | Existing business calculation (`computeSessionWorkedMs`), never recomputed elsewhere |
| Rounding | Whole minutes, per day (rounded down); total = sum of the seven days |
| Empty week | Seven days at zero, total at zero |
| Delta | Time worked − target (negative = behind) |

Examples (Paris time):

- Sunday 21:00 → Monday 01:00: counts toward **Sunday**, in the week that ends that Sunday.
- Monday 00:30 → 01:30: counts toward **Monday**, even though it is still Sunday in UTC.
- Session with no end time: included in no total; it triggers a warning.
