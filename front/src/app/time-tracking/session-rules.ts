import { Violation, ViolationCode } from './history.model';

export interface DraftSub {
  periodTypeId: number;
  start: Date;
  end: Date | null;
}

export interface SessionDraft {
  start: Date;
  end: Date | null;
  subs: DraftSub[];
}

interface Interval {
  start: Date;
  end: Date | null;
}

const endMs = (interval: Interval): number =>
  interval.end ? interval.end.getTime() : Number.POSITIVE_INFINITY;

export const overlaps = (a: Interval, b: Interval): boolean =>
  a.start.getTime() < endMs(b) && b.start.getTime() < endMs(a);

const endsBeforeStart = (interval: Interval): boolean =>
  interval.end !== null && interval.end.getTime() <= interval.start.getTime();

export function validateDraft(draft: SessionDraft, now: Date): Violation[] {
  const violations: Violation[] = [];
  const add = (code: ViolationCode, path: string) => violations.push({ code, path, message: code });

  const sessionOrderOk = !endsBeforeStart(draft);
  if (!sessionOrderOk) add ('SESSION_END_BEFORE_START', 'end');

  if (draft.start.getTime() > now.getTime() || (draft.end && draft.end.getTime() > now.getTime())) {
    add('SESSION_IN_FUTURE', 'start');
  }

  const validSubs: { index: number, sub: DraftSub }[] = [];
  let openCount = 0;

  draft.subs.forEach((sub, index) => {
    const path = `subs[${index}]`;
    const orderOk = !endsBeforeStart(sub);
    if(!orderOk) add ('SUB_END_BEFORE_START', path);

    if (sub.end === null) {
      openCount++;
      if (draft.end !== null) add('SUB_OPEN_IN_CLOSED_SESSION', path);
      if (openCount > 1) add('SUB_MULTIPLE_OPEN', path);
    }
    const startsTooEarly = sub.start.getTime() < draft.start.getTime();
    const endsTooLate = sub.end !== null && endMs(sub) > endMs(draft);
    if (orderOk && (startsTooEarly || endsTooLate)) add('SUB_OUTSIDE_SESSION', path);
    if (orderOk) validSubs.push({ index, sub });
  });

  validSubs.forEach(({ index, sub: later }, position) => {
    if (validSubs.slice(0, position).some(({ sub: earlier }) => overlaps(earlier, later))) {
      add('SUBS_OVERLAP', `subs[${index}]`);
    }
  });

  return violations;
}
