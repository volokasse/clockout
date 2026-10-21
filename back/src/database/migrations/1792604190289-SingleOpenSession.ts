import { MigrationInterface, QueryRunner } from "typeorm";

export class SingleOpenSession1792604190289 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE UNIQUE INDEX "UQ_period_single_open" ON "period" ((true)) WHERE "end" IS NULL`
        );
        await queryRunner.query(
            `CREATE UNIQUE INDEX "UQ_sub_period_single_open" ON "sub_period" ("periodId") WHERE "end" IS NULL`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "UQ_period_single_open"`);
        await queryRunner.query(`DROP INDEX "UQ_sub_period_single_open"`);
    }
}
