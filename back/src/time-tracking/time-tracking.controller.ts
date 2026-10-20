import { Controller, Get } from "@nestjs/common";
import { TimeTrackingService } from "./time-tracking.service.js";

@Controller('time-tracking')
export class TimeTrackingController {
    constructor(
        private readonly timeTracking: TimeTrackingService
    ) {}

    @Get()
    findAll() {
        return this.timeTracking.findAll();
    }
}
