export interface SpanResponse {
    id: number;
    start: string;
    end: string | null;
}

export interface SessionResponse {
    status: 'none' | 'period' | 'subed';
    session: SpanResponse | null;
    sub: SpanResponse | null;
    workedMs: number;
}
