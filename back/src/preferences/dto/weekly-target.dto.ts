import { IsInt, Max, Min } from "class-validator";
import { MAX_WEEKLY_TARGET_MINUTES } from "../weekly-target.js";

export class WeeklyTargetDto {
    @IsInt()
    @Min(0)
    @Max(MAX_WEEKLY_TARGET_MINUTES)
    minutes: number;
}
