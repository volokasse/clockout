import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Post, UseFilters } from "@nestjs/common";
import { TimeTrackingService } from "./time-tracking.service.js";
import { SUB_PERIOD_TYPES, SubPeriodTypeId } from "./period-types.js";
import { InvalidTransitionFilter } from "./invalid-transition.filter.js";

const parseSubType = (value: unknown): SubPeriodTypeId => {
    if (!SUB_PERIOD_TYPES.includes(value as SubPeriodTypeId)) {
        throw new BadRequestException(`periodTypeId must be one of: ${SUB_PERIOD_TYPES.join(', ')}`);
    }
    return value as SubPeriodTypeId;
}

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
    sub(@Body('periodTypeId') periodTypeId: unknown) {
        return this.timeTracking.sub(parseSubType(periodTypeId));
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
