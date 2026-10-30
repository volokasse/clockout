import { defineConfig, devices } from '@playwright/test';
import { assertTestConfig } from '../back/test/support/assert-test-database.js';
import { loadTestEnv } from '../back/test/support/test-env.js';

// back/.env.test écrase process.env, puis le garde-fou du jour 7 vérifie que la
// configuration désigne bien la base de test. Ce code s'exécute avant tout :
// s'il refuse, aucun serveur n'est lancé.
loadTestEnv();
assertTestConfig({
    mode: process.env.PROJECT_MODE,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
});

// Ports réservés aux tests : jamais ceux du développement (3000 et 4200).
const API_PORT = 3100;
const FRONT_PORT = 4300;
const API_URL = `http://127.0.0.1:${API_PORT}`;
const FRONT_URL = `http://127.0.0.1:${FRONT_PORT}`;

export default defineConfig({
    testDir: './tests',
    fullyParallel: false,
    workers: 1,
    forbidOnly: !!process.env.CI,
    retries: 0,
    reporter: [['list'], ['html', { open: 'never' }]],

    use: {
        baseURL: FRONT_URL,
        // Le bilan raisonne en heure de Paris : le navigateur aussi.
        locale: 'fr-FR',
        timezoneId: 'Europe/Paris',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure'
    },

    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

    // Les deux vrais serveurs, branchés sur la base de test (variables d'environnement
    // héritées de loadTestEnv). reuseExistingServer reste à false : un serveur de
    // développement oublié sur ce port serait branché sur la mauvaise base.
    webServer: [
        {
            name: 'back',
            command: 'npm run build && npm run migration:run:prod && npm run start:prod',
            cwd: '../back',
            env: { API_PORT: String(API_PORT) },
            url: `${API_URL}/api/health`,
            reuseExistingServer: false,
            timeout: 120_000,
        },
        {
            name: 'front',
            command: `npx ng serve --host 127.0.0.1 --port ${FRONT_PORT} --proxy-config ../e2e/proxy.conf.cjs`,
            cwd: '../front',
            env: { API_PORT: String(API_PORT), NG_CLI_ANALYTICS: 'false' },
            url: FRONT_URL,
            reuseExistingServer: false,
            timeout: 180_000,
        },
    ],
});
