import { Injectable, NotFoundException } from "@nestjs/common";
import { SessionDetailResponse } from "./history-response.js";
import { computeElapsedMs, computeSessionWorkedMs } from "./worked-time.js";
import { InjectRepository } from "@nestjs/typeorm";
import { And, EntityManager, IsNull, LessThan, MoreThan, MoreThanOrEqual, Not, Repository } from "typeorm";
import { Clock } from "./clock.js";
import { Period } from "./entities/period.entity.js";
import { SessionInput } from "./dto/session-input.dto.js";
import { PERIOD_TYPE } from "./period-types.js";
import { isUniqueViolation } from "./is-unique-violation.js";
import { SessionConflictError, SessionValidationError } from "./session-errors.js";
import { SubPeriod } from "./entities/sub-period.entity.js";
import { ExistingSession, validateSession } from "./session-validation.js";


const HISTORY_LOCK_KEY = 5001;

interface StoredSession {
    id: number;
    start: Date;
    end: Date | null;
    note: string | null;
    subs: { id: number; start: Date; end: Date | null; periodTypeId: number}[];
}

function toDetail(session: StoredSession, now: Date): SessionDetailResponse {
    return {
        id: session.id,
        start: session.start.toISOString(),
        end: session.end?.toISOString() ?? null,
        note: session.note,
        status: session.end === null ? 'open' : 'closed',
        subs: session.subs.map((sub) => ({
            id: sub.id,
            start: sub.start.toISOString(),
            end: sub.end?.toISOString() ?? null,
            periodTypeId: sub.periodTypeId
        })),
        workedMs: computeSessionWorkedMs(session, session.subs, now),
        elapsedMs: computeElapsedMs(session, now)
    };
}

@Injectable()
export class HistoryService {
    constructor(
        @InjectRepository(Period)
        private readonly periods: Repository<Period>,
        private readonly clock: Clock
    ) {}

    async list(from: Date, to: Date): Promise<SessionDetailResponse[]> {
        const now = this.clock.now();
        const rows = await this.periods.find({
            where: { start: And(MoreThanOrEqual(from), LessThan(to)) },
            relations: { subPeriods: { periodType: true }},
            order: { start: 'DESC', subPeriods: { start: 'ASC' }}
        });
        return rows.map((row) => toDetail(this.toStoredSession(row), now));
    }

    async get(id: number): Promise<SessionDetailResponse> {
        const now = this.clock.now();
        const row = await this.periods.findOne({
            where: { id },
            relations: { subPeriods: { periodType: true }},
            order: { subPeriods: { start: 'ASC' }}
        });
        if (!row) throw new NotFoundException(`Session ${id} not found`);
        return toDetail(this.toStoredSession(row), now);
    }

    create(input: SessionInput): Promise<SessionDetailResponse> {
        return this.write(async (manager, now) => {
            await this.assertValid(manager, input, now, null);

            const period = await manager.save(Period, {
                start: input.start,
                end: input.end,
                note: input.note,
                periodType: { id: PERIOD_TYPE.WORK }
            });
            const subs = await this.saveSubs(manager, period.id, input);

            return toDetail({ ...input, id: period.id, subs }, now);
        });
    }

    update(id: number, input: SessionInput): Promise<SessionDetailResponse> {
        return this.write(async (manager, now) => {
            const existing = await manager.findOne(Period, {
                where: { id },
                lock: { mode: 'pessimistic_write' }
            });
            if (!existing) throw new NotFoundException(`Session ${id} not found`);

            await this.assertValid(manager, input, now, id);

            await manager.update(Period, id, {
                start: input.start,
                end: input.end,
                note: input.note
            });
            await manager.delete(SubPeriod, { period: { id }});
            const subs = await this.saveSubs(manager, id, input);

            return toDetail({ ...input, id, subs }, now);
        });
    }

    private async write<T>(work: (manager: EntityManager, now: Date) => Promise<T>): Promise<T> {
        const now = this.clock.now();
        try {
            return await this.periods.manager.transaction(async (manager) => {
                await manager.query('SELECT pg_advisory_xact_lock($1)', [HISTORY_LOCK_KEY]);
                return work(manager, now);
            });
        } catch(error) {
            if (isUniqueViolation(error)) {
                throw new SessionConflictError('Another session or sub period is already open');
            }
            throw error;
        }
    }

    private async assertValid(
        manager: EntityManager,
        input: SessionInput,
        now: Date,
        excludeId: number | null
    ): Promise<void> {
        const others = await this.findPotentialClashes(manager, input, excludeId);
        const violations = validateSession(input, others, now);
        if (violations.length > 0) {
            throw new SessionValidationError(violations);
        }
    }

    // Sessions that could overlap [start, end[
    private findPotentialClashes(
        manager: EntityManager,
        input: SessionInput,
        excludeId: number | null
    ): Promise<ExistingSession[]> {
        const notSelf = excludeId === null ? {} : { id: Not(excludeId) };
        const startsBeforeEnd = input.end ? { start: LessThan(input.end) } : {};

        return manager.find(Period, {
            select: { id: true, start: true, end: true },
            where: [
                { ...notSelf, ...startsBeforeEnd, end: IsNull() },
                { ...notSelf, ...startsBeforeEnd, end: MoreThan(input.start) }
            ]
        });
    }

    private async saveSubs(manager: EntityManager, periodId: number, input: SessionInput) {
        if (input.subs.length === 0) return [];

        const saved = await manager.save(SubPeriod, input.subs.map((sub) => ({
            start: sub.start,
            end: sub.end,
            periodType: { id: sub.periodTypeId },
            period: { id: periodId }
        })));
        return saved.map((row, index) => ({
            id: row.id,
            start: row.start,
            end: row.end,
            periodTypeId: input.subs[index].periodTypeId
        }));
    }

    private toStoredSession(period: Period): StoredSession {
        return {
            id: period.id,
            start: period.start,
            end: period.end,
            note: period.note,
            subs: period.subPeriods.map((sub) => ({
                id: sub.id,
                start: sub.start,
                end: sub.end,
                periodTypeId: sub.periodType.id
            }))
        };
    }
}
