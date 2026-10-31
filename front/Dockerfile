# syntax=docker/dockerfile:1

# ---------- Étape 1 : compiler Angular ----------
FROM node:24-alpine AS build
WORKDIR /app

# Pas de télémétrie / question interactive d'Angular CLI pendant le build.
ENV NG_CLI_ANALYTICS=false

# On copie d'abord uniquement les manifestes : tant qu'ils ne changent pas,
# Docker réutilise la couche "npm ci" (la plus lente) depuis son cache.
COPY package.json package-lock.json ./
RUN npm ci

# Puis uniquement ce que la compilation utilise (comme pour l'API) : modifier
# nginx.conf ou un README ne relance pas la compilation d'Angular.
COPY angular.json tsconfig.json tsconfig.app.json ./
COPY public ./public
COPY src ./src
# Config par défaut = production -> résultat dans dist/front/browser
RUN npm run build

# ---------- Étape 2 : servir avec Nginx ----------
# L'image finale ne contient ni Node ni node_modules : seulement Nginx + les fichiers statiques.
FROM nginx:1.30-alpine

# Remplace la configuration par défaut de l'image Nginx.
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/front/browser /usr/share/nginx/html

EXPOSE 80
