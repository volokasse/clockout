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

export type ViolationCode =
    | 'SESSION_END_BEFORE_START'
    | 'SESSION_IN_FUTURE'
    | 'SESSIONS_OVERLAP'
    | 'SUB_END_BEFORE_START'
    | 'SUB_OUTSIDE_SESSION'
    | 'SUB_OPEN_IN_CLOSED_SESSION'
    | 'SUB_MULTIPLE_OPEN'
    | 'SUBS_OVERLAP';

export interface Violation {
    code: ViolationCode;
    path: string;
    message: string;
}
