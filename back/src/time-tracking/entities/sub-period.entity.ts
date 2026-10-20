import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { Period } from "./period.entity.js";
import { PeriodType } from "./period-type.entity.js";
import type { Relation } from "typeorm";

@Entity()
export class SubPeriod {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
    start: Date;

    @Column({ type: 'timestamptz', nullable: true })
    end: Date | null;

    @ManyToOne(() => PeriodType, { nullable: false })
    @JoinColumn()
    periodType: Relation<PeriodType>;

    @ManyToOne(() => Period, (period) => period.subPeriods, { nullable: false })
    period: Relation<Period>
}
