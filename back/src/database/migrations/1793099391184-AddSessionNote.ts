import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSessionNote1793099391184 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "period" ADD "note" character varying(500)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "period" DROP COLUMN "note"`);
    }

}
