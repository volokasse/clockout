import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query, UseFilters, UsePipes, ValidationPipe } from "@nestjs/common";
import { SessionErrorFilter } from "./session-error.filter.js";
import { HistoryService } from "./history.service.js";
import { SessionRangeQueryDto, toRange } from "./dto/session-range.dto.js";
import { SessionInputDto, toSessionInput } from "./dto/session-input.dto.js";

@Controller('sessions')
@UseFilters(SessionErrorFilter)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class HistoryController {
    constructor(
        private readonly history: HistoryService
    ) {}

    @Get()
    list(@Query() query: SessionRangeQueryDto) {
        const { from, to } = toRange(query);
        return this.history.list(from, to);
    }

    @Get(':id')
    get(@Param('id', ParseIntPipe) id: number) {
        return this.history.get(id);
    }

    @Post()
    create(@Body() body: SessionInputDto) {
        return this.history.create(toSessionInput(body));
    }

    @Put(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() body: SessionInputDto) {
        return this.history.update(id, toSessionInput(body));
    }
}
