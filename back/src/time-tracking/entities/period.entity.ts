import { Entity, PrimaryGeneratedColumn, Column, OneToMany, JoinColumn, ManyToOne, Index } from "typeorm";
import { SubPeriod } from "./sub-period.entity.js";
import { PeriodType } from "./period-type.entity.js";
import type { Relation } from "typeorm";

@Entity()
@Index('UQ_period_single_open', { synchronize: false })
export class Period {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
    start: Date;

    @Column({ type: 'timestamptz', nullable: true })
    end: Date | null;

    @ManyToOne(() => PeriodType, { nullable: false })
    @JoinColumn()
    periodType: Relation<PeriodType>;

    @OneToMany(() => SubPeriod, (subPeriod) => subPeriod.period)
    subPeriods: Relation<SubPeriod[]>;
}
