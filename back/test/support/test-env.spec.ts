import { parseTestEnv } from './test-env.js';

const COMPLETE = [
    'PROJECT_MODE=test',
    'DB_HOST=127.0.0.1',
    'DB_PORT=15433',
    'DB_USERNAME=clockout_test',
    'DB_PASSWORD=secret',
    'DB_NAME=clockout_test',
];

describe('parseTestEnv', () => {
    it('lit un fichier complet', () => {
        expect(parseTestEnv(COMPLETE.join('\n'))).toMatchObject({
            DB_NAME: 'clockout_test',
            DB_PORT: '15433',
        });
    });

    it('refuse un fichier auquel il manque une clé, en la nommant', () => {
        const withoutPassword = COMPLETE.filter(
            (line) => !line.startsWith('DB_PASSWORD'),
        );

        expect(() => parseTestEnv(withoutPassword.join('\n'))).toThrow(
            /DB_PASSWORD/,
        );
    });

    it('refuse une clé vide', () => {
        expect(() => parseTestEnv([...COMPLETE, 'DB_HOST='].join('\n'))).toThrow(
            /DB_HOST/,
        );
    });
});
