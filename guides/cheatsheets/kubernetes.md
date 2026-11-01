# Kubernetes — Fiche ClockOut

| | Valeur |
|---|---|
| **Cluster** | **Minikube** (1 nœud, driver `docker`), Kubernetes **v1.34.1** (à une version près de `kubectl`) |
| **Manifests** | `infra/k8s/` — **numérotés** : l'ordre d'`apply` = l'ordre des dépendances |
| **Namespace** | `clockout` (tout y vit ; le supprimer supprime tout) |
| **Images** | `clockout-api:1.0` · `clockout-web:1.0` — **locales**, `imagePullPolicy: IfNotPresent` |
| **Accès** | `kubectl port-forward service/web 8081:80 -n clockout` → **`http://localhost:8081`** |

```
port-forward :8081 ─▶ Service web :80 ─▶ Pod web (Nginx) ─/api/─▶ Service api :3000 ─▶ Pod api ─▶ Service db :5432 ─▶ Pod db ─▶ PVC db-data
                                              ▲ ConfigMap clockout-nginx             ▲ ConfigMap clockout-config + Secret clockout-db
Job migrate (même image que l'API) ──▶ Service db       (db et Job lisent aussi clockout-config + clockout-db)
```

| Fichier | Objets |
|---------|--------|
| **`00-namespace.yaml`** | `Namespace` |
| **`01-config.yaml`** | `ConfigMap` `clockout-config` + `ConfigMap` `clockout-nginx` |
| **`10-db.yaml`** | `PersistentVolumeClaim` + `Deployment` + `Service` |
| **`20-migrate-job.yaml`** | `Job` `migrate` |
| **`30-api.yaml`** | `Deployment` + `Service` |
| **`40-web.yaml`** | `Deployment` + `Service` |

---

## 1. Le Top 5 essentiel

| # | Règle | Dans ClockOut |
|---|-------|---------------|
| 1 | **Déclaratif** : `kubectl apply -f` d'un état désiré | Manifests dans `infra/k8s/` |
| 2 | **Le Service est l'adresse stable**, les Pods sont jetables | `db:5432`, `api:3000`, `web:80` |
| 3 | **Config ≠ secret** : `ConfigMap` en clair, `Secret` pour le mot de passe | `clockout-config` / `clockout-db` |
| 4 | **`readinessProbe`** : pas de trafic vers un Pod non prêt | `/api/health`, `pg_isready` |
| 5 | **Tâche ponctuelle = `Job`**, pas un Pod de service | `migrate` **avant** l'API |

---

## 2. Tableau de syntaxe

### 2.1 Objets et champs

| Objet / champ | Exemple | Description rapide |
|---------------|---------|--------------------|
| **`Namespace`** | `kind: Namespace` + `metadata.name: clockout` (les autres objets : `metadata.namespace: clockout`) | Cloisonnement logique |
| **`Deployment`** | `replicas: 1` · `selector.matchLabels` · `template` | Maintient N Pods |
| **Étiquettes** | `labels: { app: api }` | Le `selector` d'un Service/Deployment **doit** reprendre les labels du **template de Pod** |
| **`strategy.type`** | `Recreate` | Arrête l'ancien Pod **avant** le nouveau |
| **`Service`** | `selector: { app: api }` · `ports: [{ port: 3000, targetPort: 3000 }]` | Adresse stable (type `ClusterIP`, interne) |
| **`ConfigMap` en variable** | `valueFrom.configMapKeyRef: { name, key }` | Une clé → une variable |
| **`Secret` en variable** | `valueFrom.secretKeyRef: { name: clockout-db, key: POSTGRES_PASSWORD }` | Idem, valeur sensible |
| **`ConfigMap` en fichier** | `volumes[].configMap` + `volumeMounts[].mountPath` | Une clé → un fichier |
| **`PersistentVolumeClaim`** | `accessModes: ["ReadWriteOnce"]` · `requests.storage: 1Gi` | Demande de disque |
| **`readinessProbe`** | `httpGet: { path, port }` ou `exec.command` · `periodSeconds` · `failureThreshold` | Prêt à recevoir du trafic |
| **`Job`** | `backoffLimit: 3` · `restartPolicy: Never` | S'arrête au succès, ou après `backoffLimit` nouvelles tentatives en échec |
| **`imagePullPolicy`** | `IfNotPresent` | Utilise l'image locale |
| **`command`** | `command: ["npm", "run", "migration:run:prod"]` | Remplace l'**`ENTRYPOINT`** de l'image (`args` remplace le `CMD`) ; ici l'image n'a qu'un `CMD`, effet identique |
| **Séparateur** | `---` | Plusieurs objets dans un fichier |

### 2.2 Commandes `kubectl` (namespace `clockout`)

| Commande | Action |
|----------|--------|
| **`kubectl apply -f k8s/10-db.yaml`** | Crée/met à jour depuis un manifest |
| **`kubectl create secret generic clockout-db --from-env-file=.env -n clockout`** | Secret depuis `infra/.env` |
| **`kubectl get pods -n clockout`** | `READY` · `STATUS` · `RESTARTS` |
| **`kubectl describe pod -l app=api -n clockout`** | Détails + *Events* (en bas) |
| **`kubectl logs deployment/api -n clockout`** | Journaux (`-f` suivre ; aussi `job/migrate`) |
| **`kubectl get events -n clockout --sort-by=.lastTimestamp`** | Événements récents |
| **`kubectl wait --for=condition=Available deployment/db -n clockout --timeout=180s`** | Attend la disponibilité |
| **`kubectl wait --for=condition=Complete job/migrate -n clockout --timeout=120s`** | Attend la fin du Job |
| **`kubectl rollout status deployment/api -n clockout`** | Suit le déploiement |
| **`kubectl rollout restart deployment/web -n clockout`** | Relance les Pods |
| **`kubectl exec -it deploy/db -n clockout -- psql -U root -d clockout`** | Console SQL |
| **`kubectl delete job migrate -n clockout`** | Supprime le Job (pour le rejouer) |
| **`kubectl delete namespace clockout`** | Supprime l'application **et ses données** |

### 2.3 Commandes `minikube`

| Commande | Action |
|----------|--------|
| **`minikube start --driver=docker --kubernetes-version=v1.34.1`** | Crée/démarre le cluster |
| **`minikube image load clockout-api:1.0`** | Copie une image de Docker local vers le cluster |
| **`minikube image ls`** | Images visibles du cluster |
| **`minikube stop`** | Arrête, **conserve** les données |
| **`minikube delete`** | Supprime le cluster entier |

---

## 3. Patterns ClockOut

### 3.1 Configuration non secrète — `01-config.yaml`

```yaml
apiVersion: v1
kind: ConfigMap
metadata: { name: clockout-config, namespace: clockout }
data:
  POSTGRES_USER: root
  POSTGRES_DB: clockout
  DB_HOST: db            # nom du Service PostgreSQL
  DB_PORT: "5432"        # chaîne : les valeurs d'un ConfigMap sont des strings
  API_PORT: "3000"
```

- **Le mot de passe n'y est pas** : `kubectl create secret generic clockout-db --from-env-file=.env -n clockout` (hors manifest, donc hors Git).
- **`DB_HOST: db`** : le DNS du cluster résout le nom du Service (comme le nom de service Compose).

### 3.2 Base : disque + Pod unique + adresse stable — `10-db.yaml`

```yaml
kind: Deployment
spec:
  replicas: 1
  strategy: { type: Recreate }            # jamais deux PostgreSQL sur le même disque
  template:
    spec:
      containers:
        - name: postgres
          image: postgres:18
          volumeMounts: [{ name: data, mountPath: /var/lib/postgresql }]
          readinessProbe:
            exec: { command: [sh, -c, 'pg_isready -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'] }
      volumes:
        - name: data
          persistentVolumeClaim: { claimName: db-data }
```

- **`ReadWriteOnce`** : monté en lecture-écriture par **un seul nœud**.
- **StorageClass `standard` de Minikube** : le volume est créé automatiquement.
- **Même point de montage que Compose** : `/var/lib/postgresql` (PostgreSQL 18).

### 3.3 Variables d'environnement depuis ConfigMap et Secret — `30-api.yaml`

```yaml
env:
  - name: DB_USERNAME
    valueFrom: { configMapKeyRef: { name: clockout-config, key: POSTGRES_USER } }
  - name: DB_PASSWORD
    valueFrom: { secretKeyRef: { name: clockout-db, key: POSTGRES_PASSWORD } }
```

- **Renommage** : la clé `POSTGRES_USER` du ConfigMap devient `DB_USERNAME` pour l'API.
- **Le Job `migrate`** reprend le bloc `env` de l'API **sans `API_PORT`** (5 variables contre 6).

### 3.4 Migration : un `Job` avant l'API — `20-migrate-job.yaml`

```yaml
kind: Job
spec:
  backoffLimit: 3
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: migrate
          image: clockout-api:1.0
          imagePullPolicy: IfNotPresent
          command: ["npm", "run", "migration:run:prod"]
```

- **Équivalent de** `docker compose run --rm api npm run migration:run:prod`.
- **Un Job ne se relance pas** (un `apply` identique est sans effet) et son `spec.template` est **immuable** : `kubectl delete job migrate` puis nouvel `apply`.

### 3.5 Nginx configuré par ConfigMap — `40-web.yaml`

```yaml
volumeMounts: [{ name: nginx-conf, mountPath: /etc/nginx/conf.d, readOnly: true }]
volumes:      [{ name: nginx-conf, configMap: { name: clockout-nginx } }]
```

- **Le montage remplace tout `/etc/nginx/conf.d`** de l'image : le `default.conf` du jour 9 disparaît.
- **Sans `resolver 127.0.0.11`** : cette adresse est le DNS de Docker ; ici `proxy_pass http://api:3000;` suffit (le Service est stable).
- **Modifier le ConfigMap n'agit pas à chaud** : `kubectl rollout restart deployment/web -n clockout`.

### 3.6 Séquence de démarrage

```bash
minikube start --driver=docker --kubernetes-version=v1.34.1
docker build -t clockout-api:1.0 back && docker build -t clockout-web:1.0 front
minikube image load clockout-api:1.0 && minikube image load clockout-web:1.0
cd infra
kubectl apply -f k8s/00-namespace.yaml -f k8s/01-config.yaml
kubectl create secret generic clockout-db --from-env-file=.env -n clockout
kubectl apply -f k8s/10-db.yaml && kubectl wait --for=condition=Available deployment/db -n clockout --timeout=180s
kubectl apply -f k8s/20-migrate-job.yaml && kubectl wait --for=condition=Complete job/migrate -n clockout --timeout=120s
kubectl apply -f k8s/30-api.yaml -f k8s/40-web.yaml
kubectl rollout status deployment/api -n clockout && kubectl rollout status deployment/web -n clockout
kubectl port-forward service/web 8081:80 -n clockout        # terminal dédié
```

- **Ordre impératif** : namespace → config + secret → base → **migration** → API + web.
- **`docker build` puis `image load`** : le cluster ne voit pas les images du Docker local.

---

## 4. Cas particuliers / Astuces de pro

| Sujet | Règle |
|-------|-------|
| **Labels ↔ selectors** | Une faute dans `app:` = Service sans endpoints (Pods « Running », site injoignable) |
| **`ClusterIP` par défaut** | Pas d'accès externe : `port-forward` (ou `minikube service`, **hors repo**) |
| **`port-forward` est un tunnel** | Mort avec le terminal ; relancer si le Pod `web` est recréé |
| **Image sans registre** | `IfNotPresent` + `minikube image load` ; avec `Always`, `ErrImagePull` |
| **Tag explicite** | `:1.0` (ou nouveau tag) ; sans tag ou en `:latest`, la politique par défaut devient `Always` (ici surchargée par `IfNotPresent`) |
| **ConfigMap modifié ≠ appliqué** | Variables : **jamais** relues · fichier monté : mis à jour avec délai, mais **Nginx ne se recharge pas** → `rollout restart` |
| **Config de l'API modifiée** | `kubectl rollout restart deployment/api -n clockout` (le Job : `delete` puis `apply`) |
| **`postgres:18` n'est pas local** | Tirée de Docker Hub au premier démarrage : connexion requise |
| **Probes** | db : `exec pg_isready` (5 s / 10 échecs) · api : `httpGet /api/health` (5 s / 6) · web : `httpGet /` |
| **`wait` impose l'ordre** | Kubernetes ne sait pas que la migration précède l'API : c'est `kubectl wait` qui l'impose ; un Job en échec fait **expirer** le `wait` (→ `logs job/migrate`) |
| **`--from-env-file=.env`** | Chaque ligne de `.env` devient une clé du Secret (`WEB_PORT`, `POSTGRES_*`, `POSTGRES_TEST_*`) ; seule `POSTGRES_PASSWORD` est référencée |
| **`Secret` ≠ chiffré** | Encodé en base64, pas chiffré : ne pas le versionner |
| **Valeurs `ConfigMap`** | Toujours des chaînes : `"5432"` entre guillemets |
| **Probe `readiness` seule** | Pas de `livenessProbe` ni de `resources` dans ce projet |
| **`Recreate` pour la base** | Pas de `RollingUpdate` : deux PostgreSQL ne doivent jamais écrire sur le même disque |
| **Données persistantes** | `minikube stop`/`start` : conservées · `delete namespace` : supprimées |
| **Piège après `stop`/`start`** | Observé : le disque reste `Released` et les anciennes données reviennent dans un namespace recréé (cause non établie) → `minikube delete` pour repartir de zéro |
| **Version `kubectl`** | Écart max. d'**une** version mineure avec le serveur → `--kubernetes-version` |
| **Git Bash** | `winpty kubectl exec -it …` si « the input device is not a TTY » |
| **Coexistence** | Dev (4200/3000), Docker (8080), Kubernetes (8081) |

---

## 5. Dépannage / Erreurs courantes

| Erreur / Symptôme | Cause | Correctif |
|-------------------|-------|-----------|
| **`ErrImagePull` / `ImagePullBackOff`** | Image absente du cluster ou tag faux | `minikube image load …` ; `minikube image ls` |
| **`CreateContainerConfigError`** + `secret "clockout-db" not found` | Secret non créé | `kubectl create secret generic clockout-db --from-env-file=.env -n clockout` |
| **Pod `Pending`** | PVC non lié / ressources | `kubectl describe pod` (*Events*) ; `kubectl get pvc -n clockout` |
| **`CrashLoopBackOff`** | Le conteneur plante au démarrage | `kubectl logs <pod> --previous` |
| **`READY 0/1`** | `readinessProbe` en échec | `describe pod` ; logs ; chemin/port de la sonde |
| **Site affiché, écrans vides ou en erreur** | Migration oubliée | `kubectl logs deployment/api` : `relation "period" does not exist` → Job `migrate` |
| **Job `migrate` en `Error`** | Base pas encore prête ou mauvais identifiants | `kubectl logs job/migrate -n clockout` ; `wait` sur `db` avant |
| **`kubectl apply` refuse de modifier le Job** | `spec.template` du Job immuable | `kubectl delete job migrate -n clockout` puis `apply` |
| **`error: lost connection to pod`** | Pod `web` recréé | Relancer le `port-forward` |
| **`unable to listen on any of the requested ports: [{8081 80}]`** | Port 8081 déjà utilisé | Fermer l'ancien tunnel ou `9090:80` |
| **`502` / `connection refused` vers `api`** | Service sans endpoints (labels) ou API non prête | `kubectl get endpoints api -n clockout` (avertissement de dépréciation de l'API `Endpoints` dès v1.33 : sans gravité) |
| **`host not found in upstream "api"`** | Mauvais namespace/nom de Service | Nginx et API dans `clockout` ; Service nommé `api` |
| **Ancienne conf Nginx toujours active** | ConfigMap modifié sans relance | `kubectl rollout restart deployment/web -n clockout` |
| **Anciennes données après `delete namespace`** | Volume hostpath réutilisé après `stop`/`start` | `minikube delete` puis tout refaire |
| **Avertissement de version `kubectl`** | Écart client/serveur | Aligner `--kubernetes-version` ; sur un cluster existant, Minikube refuse un *downgrade* → `minikube delete` (perte des données) |
