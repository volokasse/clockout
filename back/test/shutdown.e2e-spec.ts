import { DataSource } from 'typeorm';
import { createTestApp } from './support/test-app.js';

// Vitest tue le processus du fichier de test à la fin : une connexion oubliée
// passerait donc inaperçue. On vérifie l'arrêt depuis l'intérieur, avec une
// sonde indépendante de l'application.
describe("arrêt de l'application", () => {
    it('libère toutes les connexions PostgreSQL quand elle se ferme', async () => {
        // D'abord l'application : elle vérifie que la configuration est celle des
        // tests avant que la sonde ne se connecte.
        const { app } = await createTestApp();
        const probe = new DataSource({
            type: 'postgres',
            host: process.env.DB_HOST,
            port: Number(process.env.DB_PORT),
            username: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            extra: { max: 1 }, // une seule connexion, exclue du décompte
        });
        await probe.initialize();
        const otherConnections = async (): Promise<number> =>
            (
                await probe.query(
                    `SELECT count(*)::int AS n FROM pg_stat_activity
                    WHERE datname = current_database() AND backend_type = 'client backend' AND pid <> pg_backend_pid()`,
                )
            )[0].n;

        try {
            expect(await otherConnections()).toBeGreaterThan(0);

            await app.close();

            // PostgreSQL met quelques millisecondes à constater la déconnexion.
            await vi.waitFor(async () => expect(await otherConnections()).toBe(0), {
                timeout: 5_000,
            });
        } finally {
            await probe.destroy();
        }
    });
});
