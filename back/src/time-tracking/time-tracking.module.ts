import { Module } from "@nestjs/common";
import { TimeTrackingController } from "./time-tracking.controller.js";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Period } from "./entities/period.entity.js";
import { SubPeriod } from "./entities/sub-period.entity.js";
import { PeriodType } from "./entities/period-type.entity.js";
import { Preferences } from "../preferences/entities/preferences.entity.js";
import { TimeTrackingService } from "./time-tracking.service.js";
import { Clock, SystemClock } from "./clock.js";
import { HistoryService } from "./history.service.js";
import { HistoryController } from "./history.controller.js";
import { WeeklyReportService } from "./weekly-report.service.js";
import { WeeklyReportController } from "./weekly-report.controller.js";

@Module({
    imports: [TypeOrmModule.forFeature([
        Period,
        SubPeriod,
        PeriodType,
        Preferences
    ])],
    providers: [
        TimeTrackingService,
        HistoryService,
        WeeklyReportService,
        { provide: Clock, useClass: SystemClock }
    ],
    controllers: [TimeTrackingController, HistoryController, WeeklyReportController]
})
export class TimeTrackingModule {

}
