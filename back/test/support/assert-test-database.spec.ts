import {
    assertTestConfig,
    assertTestConnection,
    UnsafeTestDatabaseError,
} from './assert-test-database.js';

const TEST_CONFIG = {
    mode: 'test',
    host: '127.0.0.1',
    database: 'clockout_test',
};

describe('assertTestConfig', () => {
    it('accepte la configuration de test', () => {
        expect(() => assertTestConfig(TEST_CONFIG)).not.toThrow();
    });

    it.each(['127.0.0.1', 'localhost', '::1'])(
        "accepte l'hôte local %s",
        (host) => {
            expect(() => assertTestConfig({ ...TEST_CONFIG, host })).not.toThrow();
        },
    );

    it('refuse la configuration de développement et liste toutes les raisons', () => {
        const dev = { mode: 'dev', host: '127.0.0.1', database: 'clockout' };

        expect(() => assertTestConfig(dev)).toThrow(UnsafeTestDatabaseError);
        expect(() => assertTestConfig(dev)).toThrow(/PROJECT_MODE vaut "dev"/);
        expect(() => assertTestConfig(dev)).toThrow(/DB_NAME vaut "clockout"/);
    });

    it('refuse un nom de base qui ne se termine pas par _test', () => {
        expect(() =>
            assertTestConfig({ ...TEST_CONFIG, database: 'clockout_testing' }),
        ).toThrow(/DB_NAME/);
        expect(() =>
            assertTestConfig({ ...TEST_CONFIG, database: 'test_clockout' }),
        ).toThrow(/DB_NAME/);
    });

    it('refuse un mode autre que test, même avec une base nommée _test', () => {
        expect(() => assertTestConfig({ ...TEST_CONFIG, mode: 'dev' })).toThrow(
            /PROJECT_MODE/,
        );
    });

    it('refuse un hôte distant, même avec une base nommée _test', () => {
        expect(() =>
            assertTestConfig({ ...TEST_CONFIG, host: 'db.example.com' }),
        ).toThrow(/DB_HOST/);
    });

    it.each(['localhost.evil.com', '127.0.0.1.evil.com', ' 127.0.0.1', ''])(
        "refuse l'hôte mal formé ou imitant un hôte local : %j",
        (host) => {
            expect(() => assertTestConfig({ ...TEST_CONFIG, host })).toThrow(
                /DB_HOST/,
            );
        },
    );

    it('refuse une configuration incomplète', () => {
        expect(() =>
            assertTestConfig({
                mode: undefined,
                host: undefined,
                database: undefined,
            }),
        ).toThrow(UnsafeTestDatabaseError);
    });
});

describe('assertTestConnection', () => {
    const connectedTo = (name: string) => ({
        query: vi.fn().mockResolvedValue([{ name }]),
    });

    it('accepte une connexion sur une base _test', async () => {
        await expect(
            assertTestConnection(connectedTo('clockout_test')),
        ).resolves.toBeUndefined();
    });

    it('refuse une connexion sur la base de développement', async () => {
        await expect(assertTestConnection(connectedTo('clockout'))).rejects.toThrow(
            /"clockout"/,
        );
    });
});
