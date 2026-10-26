export type SessionStatus = 'none' | 'period' | 'subed';

export interface Span {
  id: number;
  start: string;
  end: string | null;
}

export interface SubSpan extends Span {
  periodTypeId: number;
}

export interface SessionResponse {
  status: SessionStatus;
  session: Span | null;
  sub: SubSpan | null;
  subs: SubSpan[];
  workedMs: number;
  elapsedMs: number;
}
