export const PERIOD_TYPE = {
    WORK: 1,
    BREAK: 2,
    SCOUTING: 3
} as const;

export const SUB_PERIOD_TYPES = [PERIOD_TYPE.BREAK, PERIOD_TYPE.SCOUTING] as const;
export type SubPeriodTypeId = (typeof SUB_PERIOD_TYPES)[number];
