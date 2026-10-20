import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Period } from './entities/period.entity.js';
import type { PeriodResponse } from './period-response.js';

@Injectable()
export class TimeTrackingService {
    constructor(
        @InjectRepository(Period)
        private readonly periods: Repository<Period>
    ) {}

    async findAll(): Promise<PeriodResponse[]> {
        const periods = await this.periods.find({
            relations: {
                subPeriods: true,
                periodType: true
            },
            order: { start: 'ASC', subPeriods: { start: 'ASC' }}
        });

        return periods.map((period) => ({
            id: period.id,
            start: period.start.toISOString(),
            end: period.end?.toISOString() ?? null,
            periodType: period.periodType.id,
            subPeriods: period.subPeriods.map((subPeriod) => ({
                id: subPeriod.id,
                start: subPeriod.start.toISOString(),
                end: subPeriod.end?.toISOString() ?? null
            }))
        }));
    }
}
