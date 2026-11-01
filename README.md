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

### Tests de bout en bout (Playwright)

Les tests de bout en bout (`e2e/tests/*.spec.ts`) pilotent un vrai Chromium sur le vrai front (`ng serve`, port 4300) et la vraie API (port 3100), branchés sur la **base de test** du jour 7. Aucune réponse n'est simulée.

#### Préparation

1. Avoir préparé les tests d'intégration (voir plus haut : `back/.env.test`, conteneur `db-test`) et lancé `npm ci` dans `front` et `back`.
2. Dans e2e : ```npm install``` puis ```npx playwright install chromium```

#### Lancer les tests end-to-end

1. Dans infra : ```docker compose up -d --wait db-test```
2. Dans e2e : ```npm test``` (ou ```npm run test:headed``` pour voir le navigateur)
3. Rapport HTML : ```npm run report``` ; trace d'un test en échec : ```npx playwright show-trace test-results/<dossier>/trace.zip```

Les ports **3100** et **4300** doivent être libres : aucun serveur existant n'est réutilisé. Ne pas lancer `nest start --watch` en même temps (le back de test est reconstruit dans `back/dist`).

#### Règles pour écrire un test de bout en bout

- Importer `test` et `expect` depuis `../fixtures.js` : la base de test est remise à zéro avant chaque test, et un seul worker est utilisé.
- Chercher les éléments par rôle et libellé (`getByRole`, `getByLabel`), `exact: true` quand un nom est contenu dans un autre.
- Attendre uniquement avec des assertions `await expect(...)`. Jamais de `waitForTimeout`, jamais de lecture immédiate (`isVisible()`, `textContent()`) suivie d'un `expect(valeur)`.
- Ne pas dépendre de la date du jour : utiliser `support/dates.ts`.
- Vérifier la stabilité : ```npx playwright test --repeat-each=3 --retries=0```

### Lancer toute l'application dans Docker

La base, l'API et le front tournent chacun dans un conteneur (`infra/compose.prod.yml`, projet Compose `clockout`). Le mode développement décrit plus haut ne change pas : les deux modes peuvent même coexister.

| | Développement | Docker |
| ------- | ---------- | ---------- |
| Front | `npm start`, port 4200 | Nginx : [http://localhost:8080](http://localhost:8080) (`WEB_PORT`) |
| API | `npm run start:dev`, port 3000 | conteneur `api`, non publiée : joignable par [http://localhost:8080/api](http://localhost:8080/api) |
| PostgreSQL | conteneur `db` de `docker-compose.yml`, port 15432 | conteneur `db` du projet `clockout`, non publié, volume `clockout_db_data` |

#### Première mise en route (dans infra)

1. Vérifier `infra/.env` : `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` et, si 8080 est pris, `WEB_PORT` (modèle : `infra/.env.example`).
2. ```docker compose -f compose.prod.yml build```
3. ```docker compose -f compose.prod.yml run --rm api npm run migration:run:prod``` (crée les tables dans la base vide)
4. ```docker compose -f compose.prod.yml up -d```
5. Ouvrir [http://localhost:8080](http://localhost:8080)

Toujours **migrer avant d'ouvrir le site** : sans tables, `/api/health` reste « ok » mais toutes les autres routes répondent 500 (`relation "period" does not exist` dans les logs de l'API). À refaire après chaque nouvelle migration et après `down -v`.

#### Commandes utiles (dans infra)

- ```docker compose -f compose.prod.yml ps``` : état et santé des services
- ```docker compose -f compose.prod.yml logs -f api``` (ou `web`, `db`) : journaux en direct ; `--tail 50` pour les dernières lignes
- ```docker compose -f compose.prod.yml down``` : supprime les conteneurs, **conserve** le volume (les données restent)
- ```docker compose -f compose.prod.yml down -v``` : supprime aussi le volume, **efface toutes les données**
- Après une modification du code : `build`, puis la migration si une migration a été ajoutée, puis `up -d`

#### Si ça ne marche pas

- `ports are not available: ... Only one usage of each socket address ...` (programme Windows) ou `Bind for 127.0.0.1:8080 failed: port is already allocated` (autre conteneur) : 8080 est pris. Choisir un autre `WEB_PORT` dans `infra/.env`.
- `password authentication failed` dans les logs de l'API après un changement de `POSTGRES_PASSWORD` : la base garde le mot de passe de sa première initialisation (voir `ALTER USER`, ou `down -v` pour repartir de zéro).
- Le site s'affiche mais les écrans restent vides ou en erreur : migration oubliée (voir ci-dessus).
- `variable is not set` / `POSTGRES_PASSWORD manquant` : `infra/.env` incomplet.
- `502 Bad Gateway` sur `/api/...` : l'API est arrêtée ou vient d'être recréée (patienter 10 s) ; `ps` puis `logs api`.

### Lancer toute l'application dans Kubernetes (Minikube)

Même application, orchestrée par Kubernetes sur un cluster local à un seul nœud (Minikube). Les manifests sont dans `infra/k8s/` et tout vit dans le namespace `clockout`. Le mode développement et la pile Docker du paragraphe précédent ne changent pas : les trois modes peuvent coexister (le site Kubernetes utilise le port 8081).

| | Docker (`compose.prod.yml`) | Kubernetes (`infra/k8s/`) |
| ------- | ---------- | ---------- |
| Site | [http://localhost:8080](http://localhost:8080) | [http://localhost:8081](http://localhost:8081) (`port-forward`) |
| Base | volume `clockout_db_data` | disque `db-data` (PVC) |
| Migration | `docker compose run --rm api npm run migration:run:prod` | Job `migrate` (`20-migrate-job.yaml`) |
| Mot de passe PostgreSQL | `infra/.env` | Secret `clockout-db`, créé depuis `infra/.env` |

#### Première mise en route

Prérequis : Docker Desktop démarré, Minikube installé, `infra/.env` rempli. Tout se passe dans `infra/`, sauf les points 1 à 3 (racine du projet).

1. ```minikube start --driver=docker --kubernetes-version=v1.34.1``` (la version de Kubernetes doit rester à une version près de `kubectl version --client`)
2. ```docker build -t clockout-api:1.0 back``` puis ```docker build -t clockout-web:1.0 front```
3. ```minikube image load clockout-api:1.0``` puis ```minikube image load clockout-web:1.0``` (le cluster ne voit pas les images de ton Docker local)
4. ```kubectl apply -f k8s/00-namespace.yaml -f k8s/01-config.yaml```
5. ```kubectl create secret generic clockout-db --from-env-file=.env -n clockout```
6. ```kubectl apply -f k8s/10-db.yaml``` puis ```kubectl wait --for=condition=Available deployment/db -n clockout --timeout=180s```
7. ```kubectl apply -f k8s/20-migrate-job.yaml``` puis ```kubectl wait --for=condition=Complete job/migrate -n clockout --timeout=120s```
8. ```kubectl apply -f k8s/30-api.yaml -f k8s/40-web.yaml``` puis ```kubectl rollout status deployment/api -n clockout``` et ```kubectl rollout status deployment/web -n clockout```
9. Dans un terminal dédié (il reste occupé) : ```kubectl port-forward service/web 8081:80 -n clockout```, puis ouvrir [http://localhost:8081](http://localhost:8081)

Toujours **migrer avant de démarrer l'API** (points 7 puis 8). Le Job ne se relance pas tout seul : après l'ajout d'une migration, reconstruire l'image de l'API (`1.0` ou nouveau tag), la recharger (point 3), puis ```kubectl delete job migrate -n clockout``` et refaire le point 7.

#### Commandes utiles pour naviguer (dans infra)

- ```kubectl get pods -n clockout``` : état des Pods (`READY`, `STATUS`, `RESTARTS`)
- ```kubectl logs deployment/api -n clockout``` (ou `deployment/web`, `deployment/db`, `job/migrate`) : journaux ; `-f` pour suivre en direct
- ```kubectl describe pod -l app=api -n clockout``` : historique d'un Pod (section *Events* en bas)
- ```kubectl get events -n clockout --sort-by=.lastTimestamp``` : événements récents du namespace
- ```kubectl exec -it deploy/db -n clockout -- psql -U root -d clockout``` : ouvrir `psql` dans le Pod de la base (dans Git Bash, préfixer par `winpty` si l'erreur « the input device is not a TTY » apparaît)
- ```kubectl rollout restart deployment/web -n clockout``` : relancer un composant (nécessaire après une modification du ConfigMap `clockout-nginx`)

#### Arrêter, reprendre, effacer

- Ctrl+C dans le terminal du `port-forward` : ferme seulement le tunnel
- ```minikube stop``` : arrête le cluster, **conserve** les données ; ```minikube start``` le relance (sans option) et les Pods reviennent
- ```kubectl delete namespace clockout``` : supprime l'application **et ses données** (équivalent de `down -v`) ; à refaire ensuite : points 4 à 9
- ```minikube delete``` : supprime le cluster entier (et ses images chargées)

#### Diagnostiques et dépannages

- `ErrImagePull` / `ImagePullBackOff` : l'image n'est pas dans Minikube (point 3 oublié) ou le tag est faux. Vérifier avec `minikube image ls`.
- `CreateContainerConfigError` et `secret "clockout-db" not found` (voir `describe pod`) : le Secret n'existe pas (point 5).
- Le site s'affiche mais les écrans restent vides ou en erreur : migration oubliée (point 7). `kubectl logs deployment/api -n clockout` montrera `relation "period" does not exist`.
- `error: lost connection to pod` dans le terminal du `port-forward` : le Pod `web` a été recréé ; relancer la commande du point 9.
- `error: unable to listen on any of the requested ports: [{8081 80}]` : un `port-forward` tourne déjà (ou un autre programme utilise 8081). Fermer l'ancien terminal, ou choisir un autre port local (`9090:80`).
- Après `minikube stop` puis `start`, `kubectl delete namespace clockout` ne vide plus la base (le disque reste `Released`, les anciennes données reviennent) : pour repartir de zéro, ```minikube delete``` puis refaire les points 1 à 9.
- `kubectl` signale une différence de version avec le serveur : relancer Minikube avec `--kubernetes-version` aligné sur `kubectl version --client`.

### Récapitulatif : lancer les tests

| Niveau | Où | Commande | Ce dont il a besoin |
| ------- | ---------- | ---------- | ---------- |
| Unitaire (front) | `front` | ```npm run test``` | rien |
| Unitaire (back) | `back` | ```npm test``` | rien |
| Intégration (API + base de test) | `back` | ```npm run test:e2e``` | dans `infra` : ```docker compose up -d --wait db-test``` |
| Navigateur (Playwright) | `e2e` | ```npm test``` | dans `infra` : ```docker compose up -d --wait db-test``` ; ports 3100 et 4300 libres |

(Préparation faite une fois : `back/.env.test` et les variables `POSTGRES_TEST_*` de `infra/.env`, voir « Tests d'intégration ».) Ces tests ne dépendent ni de Docker Compose (pile complète) ni de Kubernetes : ils lancent leurs propres serveurs sur la base de **test**.

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
