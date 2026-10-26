import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, QueryFailedError, Repository } from 'typeorm';
import { Period } from './entities/period.entity.js';
import type { PeriodResponse } from './period-response.js';
import { SessionState, Span, SubSpan } from './session-state.js';
import { SessionResponse, SpanResponse, SubSpanResponse } from './session-response.js';
import { Clock } from './clock.js';
import { SubPeriod } from './entities/sub-period.entity.js';
import { PERIOD_TYPE } from './period-types.js';
import { assertTransition, InvalidTransitionError } from './session-transitions.js';
import { computeWorkedMs } from './worked-time.js';
import { computeElapsedMs, computeSessionWorkedMs } from './worked-time.js';

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

const toSubSpan = (row: { id: number; start: Date; end: Date | null; periodType: { id: number }; }): SubSpan => ({
    ...toSpan(row),
    periodTypeId: row.periodType.id
});

const toSubSpanResponse = (sub: SubSpan): SubSpanResponse => ({
    ...toSpanResponse(sub),
    periodTypeId: sub.periodTypeId
});

const isUniqueViolation = (error: unknown): boolean =>
    error instanceof QueryFailedError
    && (error.driverError as { code?: string } | undefined)?.code === '23505';

function toResponse(state: SessionState, now: Date): SessionResponse {
    if (state.status === 'none') {
        return { status: 'none', session: null, sub: null, subs: [], workedMs: 0, elapsedMs: 0 };
    }
    const openSub = state.status == 'subed' ? state.sub : null;
    const allSubs = openSub ? [...state.subs, openSub] : state.subs;

    return {
        status: state.status,
        session: toSpanResponse(state.session),
        sub: state.status === 'subed' ? toSubSpanResponse(state.sub) : null,
        subs: allSubs.map(toSubSpanResponse),
        workedMs: computeWorkedMs(state.session, allSubs, now),
        elapsedMs: computeElapsedMs(state.session, now)
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
        return toResponse(await this.loadState(this.periods.manager, false), this.clock.now());
    }

    async start(): Promise<SessionResponse> {
        try
        {
            return await this.inTransaction(async (manager, now) => {
                const state = await this.loadState(manager, true);
                assertTransition(state, 'start');

                const period = await manager.save(Period, {
                    start: now,
                    end: null,
                    periodType: { id: PERIOD_TYPE.WORK }
                });

                return toResponse({ status: 'period', session: toSpan(period), subs: [] }, now);
            });
        }
        catch(error)
        {
            if (isUniqueViolation(error)) {
                throw new InvalidTransitionError('start', 'period');
            }
            throw error;
        }
    }

    async sub(subType: typeof PERIOD_TYPE[keyof typeof PERIOD_TYPE]): Promise<SessionResponse> {
        return this.inTransaction(async (manager, now) => {
            const state = await this.loadState(manager, true);
            assertTransition(state, 'sub');

            const sub = await manager.save(SubPeriod, {
                start: now,
                end: null,
                periodType: { id: subType },
                period: { id: state.session.id }
            });

            return toResponse({
                status: 'subed',
                session: state.session,
                subs: state.subs,
                sub: toSubSpan(sub)
            }, now);
        });
    }

    async endSub(): Promise<SessionResponse> {
        return this.inTransaction(async (manager, now) => {
            const state = await this.loadState(manager, true);
            assertTransition(state, 'endsub');

            await manager.update(SubPeriod, state.sub.id, { end: now });
            return toResponse({
                status: 'period',
                session: state.session,
                subs: [ ...state.subs, { ...state.sub, end: now }]
            }, now);
        });
    }

    async end(): Promise<SessionResponse> {
        return this.inTransaction(async (manager, now) => {
            const state = await this.loadState(manager, true);
            assertTransition(state, 'end');

            let subs = state.subs;
            if (state.status === 'subed') {
                await manager.update(SubPeriod, state.sub.id, { end: now });
                subs = [...subs, { ...state.sub, end: now }];
            }
            await manager.update(Period, state.session.id, { end: now });

            return {
                status: 'none',
                session: toSpanResponse({ ...state.session, end: now }),
                sub: null,
                subs: [],
                workedMs: computeWorkedMs(state.session, subs, now),
                elapsedMs: computeElapsedMs(state.session, now)
            };
        });
    }

    private inTransaction<T>(work: (manager: EntityManager, now: Date) => Promise<T>): Promise<T> {
        const now = this.clock.now();
        return this.periods.manager.transaction((manager) => work(manager, now));
    }

    private async loadState(manager: EntityManager, forUpdate: boolean): Promise<SessionState> {
        const period = await manager.findOne(Period, {
            where: { end: IsNull() },
            ...(forUpdate && { lock: { mode: 'pessimistic_write' as const }})
        });
        if (!period) return { status: 'none' };

        const rows = await manager.find(SubPeriod, {
            where: { period: { id: period.id }},
            relations: { periodType: true },
            order: { start: 'ASC' }
        });

        const subs = rows.map(toSubSpan);
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
