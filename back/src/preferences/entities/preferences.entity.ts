import { Entity, PrimaryColumn, Column, Check } from "typeorm";

@Entity()
@Check('preferences_singleton', '"id" = 1')
@Check('preferences_target_positive', '"weekly_target_minutes" >= 0')
export class Preferences {
    @PrimaryColumn()
    id: number;

    @Column({ name: 'weekly_target_minutes', default: 2100 })
    weeklyTargetMinutes: number;

    @Column({ name: 'time_zone', type: 'varchar', length: 64, default: 'Europe/Paris' })
    timeZone: string;
}
