import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Period } from './entities/period.entity.js';
import type { PeriodResponse } from './period-response.js';
import { SessionState, Span } from './session-state.js';
import { SessionResponse, SpanResponse } from './session-response.js';
import { Clock } from './clock.js';
import { SubPeriod } from './entities/sub-period.entity.js';
import { PERIOD_TYPE } from './period-types.js';
import { assertTransition } from './session-transitions.js';

const toSpan = (row: { id: number; start: Date; end: Date | null }): Span => ({
    id: row.id,
    start: row.start,
    end: row.end
});

const toSpanResponse = (span: Span): SpanResponse => ({
    id: span.id,
    start: span.start.toISOString(),
    end: span.end?.toISOString() ?? null
});

function toResponse(state: SessionState): SessionResponse {
    if (state.status === 'none') {
        return { status: 'none', session: null, sub: null, workedMs: 0 };
    }
    return {
        status: state.status,
        session: toSpanResponse(state.session),
        sub: state.status === 'subed' ? toSpanResponse(state.sub) : null,
        workedMs: 0
    }
}


@Injectable()
export class TimeTrackingService {
    constructor(
        @InjectRepository(Period)
        private readonly periods: Repository<Period>,
        private readonly clock: Clock
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

    async current(): Promise<SessionResponse> {
        return toResponse(await this.loadState());
    }

    async start(): Promise<SessionResponse> {
        const state = await this.loadState();
        assertTransition(state, 'start');

        const period = await this.manager.save(Period, {
            start: this.clock.now(),
            end: null,
            periodType: { id: PERIOD_TYPE.WORK }
        });
        return toResponse({ status: 'period', session: toSpan(period), subs: [] });
    }

    async sub(subType: typeof PERIOD_TYPE[keyof typeof PERIOD_TYPE]): Promise<SessionResponse> {
        const state = await this.loadState();
        assertTransition(state, 'sub');

        const sub = await this.manager.save(SubPeriod, {
            start: this.clock.now(),
            end: null,
            periodType: { id: subType }
        });
        return toResponse({
            status: 'subed',
            session: state.session,
            subs: state.subs,
            sub: sub
        });
    }

    async endSub(): Promise<SessionResponse> {
        const state = await this.loadState();
        assertTransition(state, 'endsub');

        const now = this.clock.now();
        await this.manager.update(SubPeriod, state.sub.id, { end: now });
        return toResponse({
            status: 'period',
            session: state.session,
            subs: [ ...state.subs, { ...state.sub, end: now }]
        });
    }

    async end(): Promise<SessionResponse> {
        const state = await this.loadState();
        assertTransition(state, 'end');

        const now = this.clock.now();
        if (state.status === 'subed') {
            await this.manager.update(SubPeriod, state.sub.id, { end: now });
        }
        await this.manager.update(Period, state.session.id, { end: now });

        return {
            status: 'none',
            session: toSpanResponse({ ...state.session, end: now }),
            sub: null,
            workedMs: 0
        };
    }

    private get manager() {
        return this.periods.manager;
    }

    private async loadState(): Promise<SessionState> {
        const period = await this.manager.findOne(Period, {
            where: { end: IsNull() }
        });
        if (!period)
            return { status: 'none' };

        const rows = await this.manager.find(SubPeriod, {
            where: {
                period: { id: period.id },
                periodType: { id: PERIOD_TYPE.BREAK }
            },
            order: { start: 'ASC' }
        });

        const subs = rows.map(toSpan);
        const session = toSpan(period);

        const openSub = subs.find((sub) => sub.end === null);
        if (openSub) {
            return {
                status: 'subed',
                session,
                subs: subs.filter((sub) => sub !== openSub),
                sub: openSub
            };
        }
        return { status: 'period', session, subs };
    }
}
