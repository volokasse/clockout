import { MigrationInterface, QueryRunner } from "typeorm";

export class InitClockout1792535343429 implements MigrationInterface {
    name = 'InitClockout1792535343429'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "period_type" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, CONSTRAINT "PK_8e33998052a02860f87b9b8e91e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "sub_period" ("id" SERIAL NOT NULL, "start" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "end" TIMESTAMP WITH TIME ZONE, "periodTypeId" integer NOT NULL, "periodId" integer NOT NULL, CONSTRAINT "PK_785749f0701e684ec1ac95f74a0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "period" ("id" SERIAL NOT NULL, "start" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "end" TIMESTAMP WITH TIME ZONE, "periodTypeId" integer NOT NULL, CONSTRAINT "PK_cabecec858892ab647cd28673b8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "preferences" ("id" integer NOT NULL, "weekly_target_minutes" integer NOT NULL DEFAULT '2100', "time_zone" character varying(64) NOT NULL DEFAULT 'Europe/Paris', CONSTRAINT "preferences_target_positive" CHECK ("weekly_target_minutes" >= 0), CONSTRAINT "preferences_singleton" CHECK ("id" = 1), CONSTRAINT "PK_17f8855e4145192bbabd91a51be" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "sub_period" ADD CONSTRAINT "FK_7b73852f29ff342c594382d0783" FOREIGN KEY ("periodTypeId") REFERENCES "period_type"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sub_period" ADD CONSTRAINT "FK_b7e5b0c7559d82b9fdec588559a" FOREIGN KEY ("periodId") REFERENCES "period"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "period" ADD CONSTRAINT "FK_8a7c046624dd02ed8d93b438616" FOREIGN KEY ("periodTypeId") REFERENCES "period_type"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "period" DROP CONSTRAINT "FK_8a7c046624dd02ed8d93b438616"`);
        await queryRunner.query(`ALTER TABLE "sub_period" DROP CONSTRAINT "FK_b7e5b0c7559d82b9fdec588559a"`);
        await queryRunner.query(`ALTER TABLE "sub_period" DROP CONSTRAINT "FK_7b73852f29ff342c594382d0783"`);
        await queryRunner.query(`DROP TABLE "preferences"`);
        await queryRunner.query(`DROP TABLE "period"`);
        await queryRunner.query(`DROP TABLE "sub_period"`);
        await queryRunner.query(`DROP TABLE "period_type"`);
    }

}
