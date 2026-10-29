import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const ENV_TEST_PATH = fileURLToPath(
    new URL('../../.env.test', import.meta.url),
);

// Chaque clé doit être écrite dans .env.test : sinon ConfigModule la
// complèterait en silence avec celle du .env de développement.
const REQUIRED_KEYS = [
    'PROJECT_MODE',
    'DB_HOST',
    'DB_PORT',
    'DB_USERNAME',
    'DB_PASSWORD',
    'DB_NAME',
] as const;

export function parseTestEnv(content: string): Record<string, string> {
    const values = dotenv.parse(content);
    const missing = REQUIRED_KEYS.filter((key) => !values[key]?.trim());
    if (missing.length > 0) {
        throw new Error(
            `.env.test incomplet, clés absentes ou vides : ${missing.join(', ')}`,
        );
    }
    return values;
}

// Écrase process.env (y compris ce que le shell aurait exporté) : la
// configuration de test gagne toujours.
export function loadTestEnv(path = ENV_TEST_PATH): void {
    let content: string;
    try {
        content = readFileSync(path, 'utf8');
    } catch {
        throw new Error(
            'back/.env.test introuvable : copiez back/.env.test.example vers back/.env.test',
        );
    }
    Object.assign(process.env, parseTestEnv(content));
}
