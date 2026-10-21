export type SessionAction = 'start' | 'sub' | 'endsub' | 'end';
export type SessionStatus = 'none' | 'period' | 'subed';

export interface Span {
    id: number;
    start: Date;
    end: Date | null;
}

/*
| Action | Route        | Depuis                 | Effet                        | Vers               |
|--------|--------------|------------------------|------------------------------|--------------------|
| start  | POST /start  | no session             | start the session            | period             |
| sub    | POST /sub    | period                 | create the sub period        | subed              |
| endsub | POST /endsub | subed                  | end the sub period           | period             |
| end    | POST /end    | period or subed        | end period and/or sub period | no running session |
*/

export type SessionState =
    | { status: 'none'}
    | { status: 'period'; session: Span; subs: Span[]; }
    | { status: 'subed'; session: Span; subs: Span[]; sub: Span; };
