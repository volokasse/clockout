export interface SpanResponse {
    id: number;
    start: string;
    end: string | null;
}

export interface SubSpanResponse extends SpanResponse {
    periodTypeId: number;
}

export interface SessionResponse {
    status: 'none' | 'period' | 'subed';
    session: SpanResponse | null;
    sub: SubSpanResponse | null;
    subs: SubSpanResponse[];
    workedMs: number;
    elapsedMs: number;
}
