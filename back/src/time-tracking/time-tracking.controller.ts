import { Controller, Get, HttpCode, HttpStatus, Post, UseFilters } from "@nestjs/common";
import { TimeTrackingService } from "./time-tracking.service.js";
import { PERIOD_TYPE } from "./period-types.js";
import { InvalidTransitionFilter } from "./invalid-transition.filter.js";

@Controller('time-tracking')
@UseFilters(InvalidTransitionFilter)
export class TimeTrackingController {
    constructor(
        private readonly timeTracking: TimeTrackingService
    ) {}

    @Get()
    findAll() {
        return this.timeTracking.findAll();
    }

    @Get('current')
    current() {
        return this.timeTracking.current();
    }

    @Post('start')
    start() {
        return this.timeTracking.start();
    }

    @Post('sub')
    @HttpCode(HttpStatus.OK)
    sub(subType: typeof PERIOD_TYPE[keyof typeof PERIOD_TYPE]) {
        return this.timeTracking.sub(subType);
    }

    @Post('endsub')
    @HttpCode(HttpStatus.OK)
    endsub() {
        return this.timeTracking.endSub();
    }

    @Post('end')
    @HttpCode(HttpStatus.OK)
    end() {
        return this.timeTracking.end();
    }
}
