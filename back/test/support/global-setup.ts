/// <reference types="vite/client" />
import 'reflect-metadata';
import type { MigrationInterface } from 'typeorm';
import { DataSource } from 'typeorm';
import { databaseOptions } from '../../src/database/database-options.js';
import {
    assertTestConfig,
    assertTestConnection,
} from './assert-test-database.js';
import { loadTestEnv } from './test-env.js';

// databaseOptions() vise ./migrations/*.js, qui n'existe qu'une fois compilé
// dans dist/. Sous Vitest on charge donc les sources .ts via Vite, puis on
// donne les classes à TypeORM à la place du motif de fichiers.
const migrationModules = import.meta.glob<
    Record<string, new () => MigrationInterface>
>('../../src/database/migrations/*.ts', { eager: true });

// Exécuté une seule fois avant tous les fichiers de test.
export default async function setup(): Promise<void> {
    try {
        await migrateTestDatabase();
    } catch (error) {
        // Une erreur levée ici ferait écrire à Vitest « No test files found », ce
        // qui égare : on affiche le vrai problème nous-mêmes, puis on s'arrête.
        // Avec l'hôte « localhost », Node lève une AggregateError au message vide.
        const { code, message } = error as { code?: string; message: string };
        const hint =
            code === 'ECONNREFUSED'
                ? '\nLa base de test est-elle démarrée ? Dans infra : docker compose up -d --wait db-test'
                : '';
        console.error(
            `\nImpossible de préparer la base de test : ${message || code}${hint}\n`,
        );
        process.exit(1);
    }
}

async function migrateTestDatabase(): Promise<void> {
    loadTestEnv();
    // Le garde-fou passe avant tout le reste : s'il refuse, rien n'est tenté.
    assertTestConfig({
        mode: process.env.PROJECT_MODE,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
    });
    const dataSource = new DataSource({
        ...databaseOptions((key) => process.env[key]),
        migrations: Object.values(migrationModules).flatMap((module) =>
            Object.values(module),
        ),
    });

    await dataSource.initialize();
    try {
        await assertTestConnection(dataSource);
        await dataSource.runMigrations();
    } finally {
        await dataSource.destroy();
    }
}
