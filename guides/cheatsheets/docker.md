# Docker — Fiche ClockOut

| | Valeur |
|---|---|
| **Images de base** | `node:24-alpine` (build + runtime API) · `nginx:1.30-alpine` (front) · `postgres:18` (base) |
| **Fichiers** | `back/Dockerfile` · `front/Dockerfile` · `front/nginx.conf` · `*/.dockerignore` |
| **Compose** | `infra/docker-compose.yml` (**dev** : `db` + `db-test`) · `infra/compose.prod.yml` (**pile complète**, projet `clockout`) |
| **Point d'entrée** | **`http://localhost:8080`** (`WEB_PORT`) — seul port publié, sur `127.0.0.1` |
| **Lancement** | Depuis **`infra/`** (obligatoire sans `-f` ; avec `-f compose.prod.yml`, le `.env` lu est celui du dossier du fichier) |

```
navigateur ──▶ web (Nginx :80) ──/api/──▶ api (Node :3000) ──▶ db (PostgreSQL :5432)
                 127.0.0.1:8080              non publié (prod)       non publié (prod ; en dev : 127.0.0.1:${POSTGRES_PORT})
```

---

## 1. Le Top 5 essentiel

| # | Règle | Dans ClockOut |
|---|-------|---------------|
| 1 | **Multi-stage** : compiler dans un étage, livrer dans un autre | API en 3 étages (`build` → `deps` → `runtime`) ; front en 2 |
| 2 | **Manifestes d'abord, code ensuite** : cache de `npm ci` préservé | `COPY package.json package-lock.json ./` puis `COPY src` |
| 3 | **`.dockerignore`** : ni `.env`, ni `node_modules`, ni tests dans l'image | `back/.dockerignore`, `front/.dockerignore` |
| 4 | **Config par variables d'environnement**, jamais dans l'image | `DB_HOST: db` (nom du service) |
| 5 | **Migrer explicitement avant d'ouvrir le site** | `run --rm api npm run migration:run:prod` |

---

## 2. Tableau de syntaxe

### 2.1 Dockerfile

| Instruction | Exemple | Description rapide |
|-------------|---------|--------------------|
| **`# syntax=`** | `# syntax=docker/dockerfile:1` | Choisit la version du **frontend Dockerfile** (dernière 1.x stable) |
| **`FROM … AS`** | `FROM node:24-alpine AS build` | Étage nommé |
| **`WORKDIR`** | `WORKDIR /app` | Dossier courant (créé si absent) |
| **`COPY`** | `COPY package.json package-lock.json ./` | Hôte (contexte) → image |
| **`COPY --from`** | `COPY --from=build /app/dist ./dist` | Depuis un autre étage |
| **`COPY --chown`** | `COPY --chown=node:node …` | Propriétaire des fichiers |
| **`RUN`** | `RUN npm ci --omit=dev` | Commande de build (une couche) |
| **`ENV`** | `ENV NODE_ENV=production` | Variable d'environnement (build **et** runtime) |
| **`USER`** | `USER node` | Exécution **non-root** |
| **`EXPOSE`** | `EXPOSE 3000` | **Documentation** seulement : ne publie rien |
| **`CMD`** | `CMD ["node", "dist/main.js"]` | Commande par défaut (forme **exec**) |

### 2.2 Compose

| Clé | Exemple | Description rapide |
|-----|---------|--------------------|
| **`name`** | `name: clockout` | Nom du projet (préfixe conteneurs/volumes) |
| **`build.context`** | `context: ../back` | Dossier envoyé au build |
| **`depends_on`** | `condition: service_healthy` | Attend la **santé**, pas le simple démarrage |
| **`healthcheck`** | `test: ["CMD", "wget", "-q", "-O", "/dev/null", "http://127.0.0.1:3000/api/health"]` | Sonde de santé |
| **`ports`** | `"127.0.0.1:${WEB_PORT:-8080}:80"` | Hôte:conteneur, **local seulement** |
| **`volumes`** | `db_data:/var/lib/postgresql` | Volume nommé (survit à `down`) |
| **`tmpfs`** | `- /var/lib/postgresql` | Données en mémoire (base de test) |
| **`profiles`** | `profiles: ["test"]` | Service absent d'un `up` simple |
| **Variable obligatoire** | `${POSTGRES_USER:?message}` | Échoue si **absente ou vide** (affiche le message) |
| **Variable avec défaut** | `${WEB_PORT:-8080}` | Valeur de repli |
| **`$$`** | `pg_isready -U $$POSTGRES_USER` | `$` littéral : évalué **dans** le conteneur |
| **`restart`** | `unless-stopped` | Relance sauf arrêt manuel |

### 2.3 Commandes

| Commande (dans `infra/`) | Action |
|--------------------------|--------|
| **`docker compose -f compose.prod.yml build`** | Construit `api` et `web` |
| **`… run --rm api npm run migration:run:prod`** | Migre la base, puis supprime le conteneur |
| **`… up -d`** | Démarre en arrière-plan |
| **`… run --rm api …`** (rappel) | Démarre aussi `db` (via `depends_on`) et la laisse tourner |
| **`… ps`** | État et santé |
| **`… logs -f api`** | Journaux en direct (`--tail 50`) |
| **`… down`** | Supprime les conteneurs, **garde** le volume |
| **`… down -v`** | Supprime **aussi les données** |
| **`docker compose up -d --wait db-test`** | Base de test, attend la santé |
| **`docker compose rm -sf db-test`** | Arrête et supprime **uniquement** `db-test` |
| **`docker build -t clockout-api:1.0 ../back`** | Image seule (tag explicite ; à la racine : `… back`) |
| **`docker history <image>`** | Taille par couche |

---

## 3. Patterns ClockOut

### 3.1 API en trois étages — `back/Dockerfile`

```dockerfile
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci                                  # devDependencies comprises (compilateur)
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev                       # production uniquement

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --chown=node:node package.json ./
COPY --chown=node:node --from=deps  /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

- **`package.json` copié dans l'image finale** : nécessaire à `npm run migration:run:prod` **et** à `"type": "module"`.
- **`dist/` contient les migrations compilées** : la CLI `typeorm` (dépendance de production) les exécute.
- **Aucun `.env` dans l'image** : tout vient de `environment:` en Compose.

### 3.2 Front : Angular compilé, servi par Nginx — `front/Dockerfile`

```dockerfile
FROM node:24-alpine AS build
WORKDIR /app
ENV NG_CLI_ANALYTICS=false
COPY package.json package-lock.json ./
RUN npm ci
COPY angular.json tsconfig.json tsconfig.app.json ./
COPY public ./public
COPY src ./src
RUN npm run build                           # → dist/front/browser

FROM nginx:1.30-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/front/browser /usr/share/nginx/html
EXPOSE 80
```

- **Image finale sans Node ni `node_modules`** : Nginx + fichiers statiques.
- **`COPY nginx.conf` après le build** : modifier la conf ne relance pas la compilation.

### 3.3 Nginx : SPA + proxy API + cache — `front/nginx.conf`

```nginx
resolver 127.0.0.11 valid=10s;                 # DNS interne de Docker
location ^~ /api/ { set $api http://api:3000; proxy_pass $api; … }
location ~* \.(?:js|css)$ { add_header Cache-Control "public, max-age=31536000, immutable"; }
location = /index.html    { add_header Cache-Control "no-cache"; }
location / { try_files $uri $uri/ /index.html; }
```

| Règle | Rôle |
|-------|------|
| **`^~ /api/`** | Prioritaire sur les règles regex de cache |
| **`set $api` + `resolver`** | Nginx **re-résout** `api` (≤ 10 s) : plus de `host not found in upstream` ; `502` limité à ≈ 10 s après recréation |
| **`.js` / `.css`** | Cache d'un an, `immutable` (la règle vise **tous** les `.js`/`.css` ; sûr car Angular les hache) |
| **`index.html`** | `no-cache` : révalidé à chaque visite |
| **`try_files … /index.html`** | Repli SPA : `/history` rechargé ne donne pas `404` |

### 3.4 Pile complète — `infra/compose.prod.yml`

```yaml
api:
  build: { context: ../back }
  depends_on: { db: { condition: service_healthy } }
  environment:
    DB_HOST: db                  # nom du service, résolu par le DNS Compose
    DB_USERNAME: ${POSTGRES_USER}
web:
  build: { context: ../front }
  depends_on: { api: { condition: service_healthy } }
  ports: ["127.0.0.1:${WEB_PORT:-8080}:80"]
```

- **Chaîne de santé** : `db` (`pg_isready -h 127.0.0.1`) → `api` (`wget /api/health`) → `web`.
- **`api` et `db` sans `ports`** : joignables uniquement dans le réseau Compose.
- **Volume nommé `clockout_db_data`** : les données survivent à `down`.

### 3.5 Parcours de première mise en route

```bash
cd infra
docker compose -f compose.prod.yml build
docker compose -f compose.prod.yml run --rm api npm run migration:run:prod
docker compose -f compose.prod.yml up -d
# → http://localhost:8080
```

- **Migrer avant d'ouvrir le site** : sans tables, `/api/health` reste « ok » mais les autres routes répondent `500`.
- **À refaire** après chaque nouvelle migration et après `down -v`.

---

## 4. Cas particuliers / Astuces de pro

| Sujet | Règle |
|-------|-------|
| **`healthy` ≠ migré** | La sonde `/api/health` ne touche pas aux tables |
| **`localhost` en conteneur** | Désigne le conteneur **lui-même** : l'API joint la base par `db`, jamais `127.0.0.1` |
| **`.env` de Compose** | Lu **à côté du fichier passé à `-f`** (`infra/.env`), pas dans le dossier courant |
| **`EXPOSE` ≠ publication** | Seul `ports:` ouvre un port sur l'hôte |
| **Publier en `127.0.0.1`** | Le port n'est pas exposé au réseau local |
| **Volume PostgreSQL 18** | Monter **`/var/lib/postgresql`** (pas `…/data`) : la version range ses données dans un sous-dossier |
| **Mot de passe figé** | La base garde le mot de passe de sa **1ʳᵉ initialisation** ; changer `.env` ne suffit pas (`ALTER USER` ou `down -v`) |
| **`down` vs `down -v`** | `-v` **efface les données** ; jamais sans raison |
| **`down` et la base de test** | `docker compose down` arrête aussi `db` : utiliser `rm -sf db-test` |
| **`pg_isready -h 127.0.0.1`** | Teste le réseau TCP : sans `-h`, « prête » pendant l'initialisation |
| **Formes `CMD`** | Forme **exec** `["node", …]` : Node est PID 1 et reçoit les signaux ; forme shell : `sh -c` ne les relaie pas toujours |
| **Arrêt de l'API** | `main.ts` sans `enableShutdownHooks()` : `docker stop` peut attendre 10 s avant `SIGKILL` (déduit du code, non mesuré) |
| **`npm ci` ≠ `npm install`** | Respecte `package-lock.json` : build reproductible |
| **`--omit=dev`** | Image légère ; la CLI `typeorm` doit rester en `dependencies` |
| **Taille d'une couche** | `docker history` ; `docker image inspect` ne donne que la taille totale |
| **Dev ≠ prod** | `docker-compose.yml` publie la base sur `127.0.0.1:${POSTGRES_PORT}` ; `compose.prod.yml` n'en publie aucune |
| **Coexistence** | Dev (4200/3000/base locale), Docker (8080), Kubernetes (8081) peuvent tourner ensemble |
| **Noms de projet** | Dev = `clockout-db` (volume `clockout-db_db_data`) · prod = `clockout` (volume `clockout_db_data`) : **deux bases distinctes** |
| **Ordre des `location` Nginx** | `=` exact → préfixe `^~` → regex dans l'ordre → plus long préfixe |
| **Healthcheck dev sans `-h`** | `docker-compose.yml` : `pg_isready` sans `-h` → « prête » possible pendant l'initialisation (impact sur `up --wait db-test`) |
| **`.env.example` ≠ `.env` local** | Exemple : ports 5432/5433 ; local : 15432/15433 possibles |
| **Tests d'intégration** | `db-test` sur `tmpfs` : données effacées à l'arrêt |

---

## 5. Dépannage / Erreurs courantes

| Erreur / Symptôme | Cause | Correctif |
|-------------------|-------|-----------|
| **`Bind for 127.0.0.1:8080 failed: port is already allocated`** | Port pris par un conteneur | Changer `WEB_PORT` dans `infra/.env` |
| **`Only one usage of each socket address`** (Windows) | Port pris par un programme | Idem |
| **`variable is not set` / `POSTGRES_PASSWORD manquant`** | `infra/.env` incomplet | Copier `.env.example` |
| **Site affiché, écrans vides ou en erreur** | Migration oubliée | `run --rm api npm run migration:run:prod` |
| **`relation "period" does not exist`** (logs api) | Idem | Idem |
| **`password authentication failed`** | Mot de passe ≠ celui du volume | `ALTER USER` ou `down -v` |
| **`502 Bad Gateway` sur `/api/…`** | API arrêtée ou recréée | Attendre ≈ 10 s ; `ps` puis `logs api` |
| **`host not found in upstream "api"`** | Nginx sans `resolver` + `api` absent au démarrage | `resolver 127.0.0.11` + variable `$api` |
| **`dependency failed to start: container … is unhealthy`** | Sonde en échec | `logs <service>` ; `docker inspect --format '{{json .State.Health}}'` |
| **`Cannot find module` / `ERR_MODULE_NOT_FOUND`** (api) | Fichier exclu par `.dockerignore` ou `COPY` oublié | Vérifier les `COPY` du Dockerfile |
| **Build qui ré-installe tout à chaque fois** | Code copié avant `package*.json` | Manifestes d'abord |
| **`ECONNREFUSED 127.0.0.1:5432` dans l'API** | `DB_HOST` laissé à `127.0.0.1` | `DB_HOST: db` |
| **`the input device is not a TTY`** (Git Bash, `compose run`/`exec`) | TTY alloué **par défaut** | `-T`, ou préfixer `winpty` |
| **Rien ne change après modification du code** | Image non reconstruite | `build` puis `up -d` |
| **Ancien état de la base après `down`** | Volume conservé (normal) | `down -v` pour repartir de zéro |
