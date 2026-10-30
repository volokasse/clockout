# syntax=docker/dockerfile:1

# ---------- Étape 1 : compiler le TypeScript ----------
# Il faut TOUTES les dépendances ici (devDependencies comprises) :
# le compilateur Nest et les types vitest/node en font partie.
FROM node:24-alpine AS build
WORKDIR /app

# On copie d'abord les fichiers de dépendances seuls : tant qu'ils ne changent
# pas, Docker réutilise la couche "npm ci" (et ne retélécharge rien).
COPY package.json package-lock.json ./
RUN npm ci

# Le code et la config de compilation arrivent après : modifier un fichier
# de src/ n'invalide que les couches suivantes.
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# ---------- Étape 2 : dépendances de production uniquement ----------
# Pas de compilateur, pas de vitest : ils ne servent pas à faire tourner l'API
# (ni les migrations, dont la CLI typeorm est une dépendance de production).
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---------- Étape 3 : image finale ----------
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# package.json est nécessaire pour "npm run migration:run:prod" et pour
# "type": "module" (sans lui, Node lirait dist/*.js comme du CommonJS).
COPY --chown=node:node package.json ./
COPY --chown=node:node --from=deps /app/node_modules ./node_modules
# dist/ contient l'API ET les migrations compilées (dist/database/migrations).
COPY --chown=node:node --from=build /app/dist ./dist

# L'image ne contient ni src/, ni .env, ni tests : la configuration
# (DB_HOST, DB_PASSWORD...) arrive uniquement par les variables d'environnement.
# Utilisateur non-root fourni par l'image node.
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
