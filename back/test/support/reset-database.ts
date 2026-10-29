import {
    assertTestConfig,
    assertTestConnection,
} from './assert-test-database.js';

interface ResettableDataSource {
    options: unknown;
    query(sql: string): Promise<unknown>;
}

// period_type est semée par les migrations : on n'y touche pas.
// preferences est remise aux valeurs de SeedInitialData.
export async function resetDatabase(
    dataSource: ResettableDataSource,
): Promise<void> {
    const { host, database } = dataSource.options as {
        host?: string;
        database?: string;
    };
    assertTestConfig({ mode: process.env.PROJECT_MODE, host, database });
    await assertTestConnection(dataSource);

    await dataSource.query(
        'TRUNCATE TABLE "sub_period", "period" RESTART IDENTITY CASCADE',
    );
    await dataSource.query(
        `INSERT INTO preferences (id, weekly_target_minutes, time_zone)
        VALUES (1, 2100, 'Europe/Paris')
        ON CONFLICT (id) DO UPDATE
        SET weekly_target_minutes = EXCLUDED.weekly_target_minutes, time_zone = EXCLUDED.time_zone`,
    );
}
