import { buildMessage, IsOptional, ValidateBy } from 'class-validator';
import { isCalendarDate } from '../week-rules.js';

// A real calendar day written YYYY-MM-DD ('2026-02-31' and '2026-1-5' are refused)
export const IsCalendarDate = () => ValidateBy({
    name: 'isCalendarDate',
    validator: {
        validate: (value: unknown) => typeof value === 'string' && isCalendarDate(value),
        defaultMessage: buildMessage(
            (eachPrefix) => `${eachPrefix}$property must be a valid date written YYYY-MM-DD`
        )
    }
});

export class WeeklyReportQueryDto {
    @IsOptional()
    @IsCalendarDate()
    date?: string;
}
