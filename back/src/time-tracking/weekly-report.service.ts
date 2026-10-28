import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clock } from './clock.js';
import { Period } from './entities/period.entity.js';
import { addDays, localDateOf, mondayOf, REPORT_TIME_ZONE } from './week-rules.js';
import type { CalendarDate } from './week-rules.js';
import { buildWeeklyTotals } from './weekly-report.js';
import type { WeeklySession } from './weekly-report.js';
import type { WeeklyReportResponse } from './weekly-report-response.js';

@Injectable()
export class WeeklyReportService {
    constructor(
        @InjectRepository(Period)
        private readonly periods: Repository<Period>,
        private readonly clock: Clock
    ) {}

    // date: any day of the wanted week. Default: the current week (in Paris).
    async weekly(date?: CalendarDate): Promise<WeeklyReportResponse> {
        const now = this.clock.now();
        const weekStart = mondayOf(date ?? localDateOf(now));
        const nextWeekStart = addDays(weekStart, 7);

        const sessions = await this.findSessions(weekStart, nextWeekStart);
        const totals = buildWeeklyTotals(weekStart, sessions, now);

        return {
            timeZone: REPORT_TIME_ZONE,
            weekStart,
            weekEnd: addDays(weekStart, 6),
            previousWeekStart: addDays(weekStart, -7),
            nextWeekStart,
            ...totals
        };
    }

    // Sessions that start in [from, to[, both given as calendar days (Paris).
    // PostgreSQL turns each day into the instant of its midnight, with the
    // daylight saving time rules: a CAST to timestamp first (a date would be
    // read in the session time zone), then AT TIME ZONE.
    private async findSessions(from: CalendarDate, to: CalendarDate): Promise<WeeklySession[]> {
        const rows = await this.periods
            .createQueryBuilder('period')
            .leftJoinAndSelect('period.subPeriods', 'sub')
            .leftJoinAndSelect('sub.periodType', 'subType')
            .where('period.start >= (CAST(:from AS timestamp) AT TIME ZONE :tz)', { from, tz: REPORT_TIME_ZONE })
            .andWhere('period.start < (CAST(:to AS timestamp) AT TIME ZONE :tz)', { to, tz: REPORT_TIME_ZONE })
            .orderBy('period.start', 'ASC')
            .addOrderBy('sub.start', 'ASC')
            .getMany();

        return rows.map((row) => ({
            id: row.id,
            start: row.start,
            end: row.end,
            subs: row.subPeriods.map((sub) => ({
                start: sub.start,
                end: sub.end,
                periodTypeId: sub.periodType.id
            }))
        }));
    }
}
