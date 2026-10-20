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


# Utilisation

## Prérequis

- Node.js compatible avec le front, npm, git.
- Angular et NestJS cli à jour.
- Un gestionnaire de conteneurs fonctionnel (Docker Desktop).

## Installation

1. Dans front : ```npm ci```
2. Dans back : ```npm ci```
3. Copier ```infra/.env.example``` vers ```infra/.env```
4. Copier ```back/.env.example``` vers ```back/.env```
5. Adapter les identifiants et informations si nécessaire

## Démarrage (trois terminaux)

1. Dans infra : ```docker compose up -d```
2. Dans front : ```npm start```
3. Dans back : ```npm run start:dev```

## Accès

- Front : [http://localhost:4200](http://localhost:4200)
- Back (API) : [http://localhost:3000/api/health](http://localhost:3000/api/health)
- PostgreSQL : 127.0.0.1:5432, DB : clockout
- Identifiants locaux : voir ```infra/.env```

## Arrêt

- Ctrl+C pour le front et le back
- Dans infra : ```docker compose down``` pour la DB
    - Ne pas utiliser l'argument -v dans la commande sous risque de perte des données.

## Tests et vérifications

- npm run build dans front puis back.
- npm run test dans front puis back.
- Bouton vérifier l'API : succès, panne, reprise.
- Persistance des données du PostgreSQL vérifiée après down/up.

## Back

### Database migrations
- ```npm run migration:generate -- src/database/migrations/MigrationName``` to generate a migration file from changes applied to entities in project
- ```npm run migration:create -- src/database/migrations/MigrationName``` to create a migration file that you can populate freely
- ```npm run migration:show``` to list all migrations and their status
- ```npm run migration:run``` to run waiting migrations
- ```npm run migration:revert``` to revert last migration


## Limites du jour 1

- Pas encore de connexion NestJS/PostegreSQL.
- Pas encore de pointage, authentification ou bilan.
