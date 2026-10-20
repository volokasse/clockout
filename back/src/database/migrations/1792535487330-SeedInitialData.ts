import { MigrationInterface, QueryRunner } from "typeorm";

export class SeedInitialData1792535487330 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`INSERT INTO period_type VALUES(1, 'Travail')`);
        await queryRunner.query(`INSERT INTO period_type VALUES(2, 'Pause')`);
        await queryRunner.query(`INSERT INTO period_type VALUES(3, 'Veille')`);
        await queryRunner.query(`INSERT INTO preferences VALUES(1, 2100, 'Europe/Paris')`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM period_type WHERE id IN (1, 2, 3)`);
        await queryRunner.query(`DELETE FROM preferences WHERE id = 1`);
    }
}
