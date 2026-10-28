/** Minutes -> "7 h 30" (display only, the server does the arithmetic). */
export function formatMinutes(totalMinutes: number): string {
  const safe = Math.max(0, Math.floor(totalMinutes));
  const hours = Math.floor(safe / 60);
  const minutes = String(safe % 60).padStart(2, '0');
  return `${hours}h${minutes}`;
}

/** Signed minutes -> "+0 h 30", "-1 h 15" or "0 h 00" (plain ASCII minus). */
export function formatSignedMinutes(deltaMinutes: number): string {
  const whole = Math.floor(Math.abs(deltaMinutes));
  // No sign when nothing is shown: "+0 h 00" or "-0 h 00" would be misleading.
  let sign: string = '';
  if (whole !== 0) sign = deltaMinutes < 0 ? '-' : '+';
  return `${sign}${formatMinutes(whole)}`;
}
