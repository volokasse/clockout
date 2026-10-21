import { Module } from "@nestjs/common";
import { TimeTrackingController } from "./time-tracking.controller.js";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Period } from "./entities/period.entity.js";
import { SubPeriod } from "./entities/sub-period.entity.js";
import { PeriodType } from "./entities/period-type.entity.js";
import { Preferences } from "../preferences/entities/preferences.entity.js";
import { TimeTrackingService } from "./time-tracking.service.js";
import { Clock, SystemClock } from "./clock.js";

@Module({
    imports: [TypeOrmModule.forFeature([
        Period,
        SubPeriod,
        PeriodType,
        Preferences
    ])],
    providers: [
        TimeTrackingService,
        { provide: Clock, useClass: SystemClock }
    ],
    controllers: [TimeTrackingController]
})
export class TimeTrackingModule {

}
