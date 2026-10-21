import type { DataSourceOptions } from 'typeorm';
import { Period } from '../time-tracking/entities/period.entity.js';
import { SubPeriod } from '../time-tracking/entities/sub-period.entity.js';
import { PeriodType } from '../time-tracking/entities/period-type.entity.js';
import { Preferences } from '../preferences/entities/preferences.entity.js';
import { fileURLToPath } from 'node:url';

type ReadEnv = (key: string) => string | undefined;
export function databaseOptions(read: ReadEnv): DataSourceOptions {

    const required = (key: string): string => {
        const value = read(key);
        if (!value?.trim())
            throw new Error(`Variable absente: ${key}`);
        return value;
    };

    const port = Number(required('DB_PORT'));
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('DB_PORT must be a valid integer');
    }

    const migrationsPath = fileURLToPath(
        new URL('./migrations/*.js', import.meta.url)
    ).replaceAll('\\', '/');

    return {
        type: 'postgres',
        host: required('DB_HOST'),
        port: port,
        username: required('DB_USERNAME'),
        password: required('DB_PASSWORD'),
        database: required('DB_NAME'),
        entities: [
            Period,
            SubPeriod,
            PeriodType,
            Preferences
        ],
        migrations: [migrationsPath],
        migrationsTableName: 'typeorm_migrations',
        synchronize: false,
        migrationsRun: false,
        uuidExtension: 'pgcrypto',
        logging: ['error']
    };
}
