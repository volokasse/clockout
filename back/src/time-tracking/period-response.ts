export interface PeriodResponse {
    id: number,
    start: string,
    end: string | null,
    periodType: number,
    subPeriods: {
        id: number,
        start: string,
        end: string | null
    }[]
}
