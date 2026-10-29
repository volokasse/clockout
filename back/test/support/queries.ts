import type { DataSource } from 'typeorm';

// Lectures SQL brutes : elles montrent ce que PostgreSQL contient vraiment,
// sans repasser par les entités ni par l'API testée.

export interface PeriodRow {
    id: number;
    periodTypeId: number;
    start: Date;
    end: Date | null;
    note: string | null;
}

export interface SubPeriodRow {
    id: number;
    periodId: number;
    periodTypeId: number;
    start: Date;
    end: Date | null;
}

export const readPeriods = (db: DataSource): Promise<PeriodRow[]> =>
    db.query(
        'SELECT id, "periodTypeId", "start", "end", note FROM period ORDER BY id',
    );

export const readSubPeriods = (db: DataSource): Promise<SubPeriodRow[]> =>
    db.query(
        'SELECT id, "periodId", "periodTypeId", "start", "end" FROM sub_period ORDER BY id',
    );

export const readWeeklyTarget = async (db: DataSource) =>
    (
        await db.query(
            'SELECT weekly_target_minutes AS minutes, time_zone AS "timeZone" FROM preferences WHERE id = 1',
        )
    )[0] as { minutes: number; timeZone: string };

export const countRows = async (
    db: DataSource,
    table: 'period' | 'sub_period' | 'period_type',
): Promise<number> =>
    (await db.query(`SELECT count(*)::int AS n FROM ${table}`))[0].n;
