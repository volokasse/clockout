import { SessionDetail, SessionPayload } from "./history.model";
import { PERIOD_TYPE, SubTypeId } from "./sub-types";

export interface SubFormValue {
  periodTypeId: SubTypeId;
  start: string;
  end: string;
}

export interface SessionFormValue {
  start: string;
  end: string;
  note: string;
  subs: SubFormValue[];
}

const pad = (n: number) => String(n).padStart(2, '0');

// ISO (UTC) -> value of <input type="datetime-local"> : "2026-10-22T09:00" in local hour.
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `${date}T${time}`;
}

// Value of an <input type="datetime-local"> -> ISO (UTC). Empty : null.
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function emptySub(): SubFormValue {
  return { periodTypeId: PERIOD_TYPE.BREAK, start: '', end: '' };
}

export function toFormValue(session: SessionDetail | null): SessionFormValue {
  if (!session) return { start: '', end: '', note: '', subs: [] };
  return {
    start: toLocalInput(session.start),
    end: toLocalInput(session.end),
    note: session.note ?? '',
    subs: session.subs.map((sub) => ({
      periodTypeId: sub.periodTypeId as SubTypeId,
      start: toLocalInput(sub.start),
      end: toLocalInput(sub.end)
    }))
  };
}

export function toPayload(value: SessionFormValue): SessionPayload {
  const note = value.note.trim();
  return {
    start: fromLocalInput(value.start) ?? '',
    end: fromLocalInput(value.end),
    note: note || null,
    subs: value.subs.map((sub) => ({
      periodTypeId: sub.periodTypeId,
      start: fromLocalInput(sub.start) ?? '',
      end: fromLocalInput(sub.end)
    }))
  };
}
