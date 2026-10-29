import { resetDatabase } from './reset-database.js';
import { UnsafeTestDatabaseError } from './assert-test-database.js';

// Fausse connexion : on enregistre les requêtes sans jamais toucher à PostgreSQL.
function fakeDataSource(
    options: { host: string; database: string },
    connectedDatabase: string,
) {
    const query = vi.fn(async (sql: string) =>
        sql.startsWith('SELECT') ? [{ name: connectedDatabase }] : [],
    );
    return { dataSource: { options, query }, query };
}

describe('resetDatabase', () => {
    beforeEach(() => {
        vi.stubEnv('PROJECT_MODE', 'test');
    });
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('vide les sessions et restaure les préférences, après avoir vérifié la connexion', async () => {
        const { dataSource, query } = fakeDataSource(
            { host: '127.0.0.1', database: 'clockout_test' },
            'clockout_test',
        );

        await resetDatabase(dataSource);

        const statements = query.mock.calls.map(([sql]) => sql);
        expect(statements[0]).toMatch(/^SELECT current_database/);
        expect(statements[1]).toMatch(
            /^TRUNCATE TABLE "sub_period", "period" RESTART IDENTITY CASCADE/,
        );
        expect(statements[2]).toMatch(/^INSERT INTO preferences/);
        expect(statements).toHaveLength(3);
    });

    it("refuse la configuration de développement et n'exécute aucune requête", async () => {
        vi.stubEnv('PROJECT_MODE', 'dev');
        const { dataSource, query } = fakeDataSource(
            { host: '127.0.0.1', database: 'clockout' },
            'clockout',
        );

        await expect(resetDatabase(dataSource)).rejects.toThrow(
            UnsafeTestDatabaseError,
        );
        expect(query).not.toHaveBeenCalled();
    });

    it('refuse un mode dev même si le nom de la base finit par _test', async () => {
        vi.stubEnv('PROJECT_MODE', 'dev');
        const { dataSource, query } = fakeDataSource(
            { host: '127.0.0.1', database: 'clockout_test' },
            'clockout_test',
        );

        await expect(resetDatabase(dataSource)).rejects.toThrow(/PROJECT_MODE/);
        expect(query).not.toHaveBeenCalled();
    });

    it('refuse quand la connexion réelle pointe ailleurs : seul le SELECT est exécuté', async () => {
        const { dataSource, query } = fakeDataSource(
            { host: '127.0.0.1', database: 'clockout_test' },
            'clockout',
        );

        await expect(resetDatabase(dataSource)).rejects.toThrow(/"clockout"/);
        expect(query).toHaveBeenCalledTimes(1);
        expect(query.mock.calls[0][0]).toMatch(/^SELECT current_database/);
    });
});
