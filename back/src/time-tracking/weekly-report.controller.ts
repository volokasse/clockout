import { Controller, Get, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { WeeklyReportQueryDto } from './dto/weekly-report-query.dto.js';
import { WeeklyReportService } from './weekly-report.service.js';

@Controller('reports')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class WeeklyReportController {
    constructor(
        private readonly reports: WeeklyReportService
    ) {}

    @Get('weekly')
    weekly(@Query() query: WeeklyReportQueryDto) {
        return this.reports.weekly(query.date);
    }
}
