import { IsInstant } from "./session-input.dto.js";
import { BadRequestException } from "@nestjs/common";


export class SessionRangeQueryDto {
    @IsInstant()
    from: string;

    @IsInstant()
    to: string;
}

// from included, to excluded [from, to[
export function toRange(query: SessionRangeQueryDto): { from: Date, to: Date} {
    const from = new Date(query.from);
    const to = new Date(query.to);
    if (from.getTime() >= to.getTime()) {
        throw new BadRequestException('"from" must be before "to"');
    }
    return { from, to };
}
