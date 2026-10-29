import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import supertest from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { Clock } from '../../src/time-tracking/clock.js';
import { assertTestConfig } from './assert-test-database.js';
import { resetDatabase } from './reset-database.js';

// Démarre la vraie application (AppModule + configureApp) sur un port libre,
// contre la base de test, remise à zéro.
export async function createTestApp(options: { clock?: Clock } = {}) {
    // Avant de se connecter : on refuse de démarrer si setup-env n'a pas
    // chargé .env.test (le .env de développement serait alors lu).
    assertTestConfig({
        mode: process.env.PROJECT_MODE,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
    });

    const builder = Test.createTestingModule({ imports: [AppModule] });
    if (options.clock) builder.overrideProvider(Clock).useValue(options.clock);
    const moduleRef = await builder.compile();

    // logger: false : les erreurs simulées par les tests ne polluent pas la sortie.
    const app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    try {
        await app.init();
        // Un vrai serveur HTTP sur un port libre (0) : supertest n'a pas à en
        // démarrer un par requête, et les requêtes simultanées visent le même.
        await app.listen(0, '127.0.0.1');
        await resetDatabase(app.get(DataSource));
    } catch (error) {
        await app.close(); // sinon le pool de connexions resterait ouvert
        throw error;
    }

    return {
        app,
        dataSource: app.get(DataSource),
        api: supertest(app.getHttpServer()),
    };
}

export type TestApp = Awaited<ReturnType<typeof createTestApp>>;
