import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity()
export class PeriodType {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;
}
