import { applyDecorators } from "@nestjs/common";
import { ArrayMaxSize, IsArray, IsIn, IsISO8601, IsOptional, IsString, Matches, MaxLength, ValidateNested } from "class-validator";
import { SUB_PERIOD_TYPES } from "../period-types.js";
import type { SubPeriodTypeId } from "../period-types.js";
import { Type } from "class-transformer";
import { DraftSub } from "../session-validation.js";


const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

export const IsInstant = () => applyDecorators(
    IsISO8601({ strict: true, strictSeparator: true }),
    Matches(INSTANT, { message: '$property must include a time and a time zone' })
);

export class SubInputDto {
    @IsIn(SUB_PERIOD_TYPES)
    periodTypeId: SubPeriodTypeId;

    @IsInstant()
    start: string;

    @IsOptional()
    @IsInstant()
    end?: string | null;
}

export class SessionInputDto {
    @IsInstant()
    start: string;

    @IsOptional()
    @IsInstant()
    end?: string | null;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    note?: string | null;

    @IsArray()
    @ArrayMaxSize(50)
    @ValidateNested({ each: true })
    @Type(() => SubInputDto)
    subs: SubInputDto[]
}

export interface SessionInput {
    start: Date;
    end: Date | null;
    note: string | null;
    subs: DraftSub[]
}

export function toSessionInput(dto: SessionInputDto): SessionInput {
    const note = dto.note?.trim();
    return {
        start: new Date(dto.start),
        end: dto.end ? new Date(dto.end) : null,
        note: note ?? null,
        subs: dto.subs.map((sub) => ({
            periodTypeId: sub.periodTypeId,
            start: new Date(sub.start),
            end: sub.end ? new Date(sub.end) : null
        }))
    };
}
