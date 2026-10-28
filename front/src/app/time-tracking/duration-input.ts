/** Largest weekly target accepted by the server: 7 days x 24 h x 60 min. */
export const MAX_WEEKLY_TARGET_MINUTES = 10_080;

export interface HoursMinutes {
  hours: number;
  minutes: number;
}

/** Hours + minutes typed in the form -> total minutes sent to the API. */
export function toMinutes(hours: number, minutes: number): number {
  return hours * 60 + minutes;
}

/** Total minutes received from the API -> hours + minutes shown in the form. */
export function splitMinutes(total: number): HoursMinutes {
  const safe = Math.max(0, Math.floor(total));
  return { hours: Math.floor(safe / 60), minutes: safe % 60 };
}
