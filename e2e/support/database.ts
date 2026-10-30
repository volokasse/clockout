import pg from 'pg';
import { resetDatabase } from '../../back/test/support/reset-database.js';

// Les variables DB_* viennent de back/.env.test (chargé par playwright.config.ts).
export function createTestPool(): pg.Pool {
    return new pg.Pool({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        max: 2,
    });
}

// On réutilise telle quelle la remise à zéro du jour 7, garde-fous compris :
// elle attend seulement un objet qui sait faire `query` et dire où il pointe.
export async function resetTestDatabase(pool: pg.Pool): Promise<void> {
    await resetDatabase({
        options: { host: process.env.DB_HOST, database: process.env.DB_NAME },
        query: async (sql: string) => (await pool.query(sql)).rows,
    });
}

export interface SessionRow {
    id: number;
    start: Date;
    end: Date | null;
}

// Lecture directe : ce que PostgreSQL contient vraiment, sans passer par l'API.
export async function readSessions(pool: pg.Pool): Promise<SessionRow[]> {
    const { rows } = await pool.query('SELECT id, "start", "end" FROM period ORDER BY id');
    return rows;
}
