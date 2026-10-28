import { Body, Controller, Get, Put, UsePipes, ValidationPipe } from '@nestjs/common';
import { WeeklyTargetDto } from './dto/weekly-target.dto.js';
import { PreferencesService } from './preferences.service.js';

@Controller('preferences')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class PreferencesController {
    constructor(
        private readonly preferences: PreferencesService
    ) {}

    @Get('weekly-target')
    async weeklyTarget() {
        return { minutes: await this.preferences.getWeeklyTargetMinutes() };
    }

    @Put('weekly-target')
    async updateWeeklyTarget(@Body() body: WeeklyTargetDto) {
        return { minutes: await this.preferences.setWeeklyTargetMinutes(body.minutes) };
    }
}
