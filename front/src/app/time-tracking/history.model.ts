import { SubSpan } from "./session.model";
import { SubTypeId } from "./sub-types";


export interface SessionDetail {
  id: number;
  start: string;
  end: string | null;
  note: string | null;
  status: 'open' | 'closed';
  subs: SubSpan[];
  workedMs: number;
  elapsedMs: number;
}

export interface SubPayload {
  periodTypeId: SubTypeId;
  start: string;
  end: string | null;
}

export interface SessionPayload {
  start: string;
  end: string | null;
  note: string | null;
  subs: SubPayload[];
}
