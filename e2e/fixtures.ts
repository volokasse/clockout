import type { Pool } from 'pg';
import { test as base } from '@playwright/test';
import { createTestPool, resetTestDatabase } from './support/database.js';

interface TestFixtures {
    cleanDatabase: void;
}

interface WorkerFixtures {
    pool: Pool;
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
    // Une connexion par processus de test, partagée par tous ses tests.
    pool: [
        async ({}, use) => {
            const pool = createTestPool();
            await use(pool);
            await pool.end();
        },
        { scope: 'worker' },
    ],

    // `auto` : s'exécute avant chaque test sans que le test ait à la demander.
    cleanDatabase: [
        async ({ pool }, use) => {
            await resetTestDatabase(pool);
            await use();
        },
        { auto: true },
    ],
});

export { expect } from '@playwright/test';
