import type { SubSpanResponse } from "./session-response.js";

export interface SessionDetailResponse {
    id: number;
    start: string;
    end: string | null;
    note: string | null;
    status: 'open' | 'closed';
    subs: SubSpanResponse[];
    workedMs: number;
    elapsedMs: number;
}
