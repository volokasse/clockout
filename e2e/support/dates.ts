const PARIS = 'Europe/Paris';

// Lundi de la semaine précédente, en heure de Paris, au format AAAA-MM-JJ.
// Toujours dans le passé (le serveur refuse les sessions futures) et jamais à
// cheval sur un changement d'heure (ils ont lieu le dimanche).
export function previousMonday(now = new Date()): string {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: PARIS }).format(now); // 2026-10-29
    const [year, month, day] = today.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    const sinceMonday = (date.getUTCDay() + 6) % 7; // 0 = lundi
    date.setUTCDate(date.getUTCDate() - sinceMonday - 7);
    return date.toISOString().slice(0, 10);
}

// AAAA-MM-JJ + n jours, en arithmétique UTC pure (aucun changement d'heure).
export function addDays(isoDate: string, days: number): string {
    const date = new Date(`${isoDate}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

// 2026-10-19 -> 19/10/2026 (format affiché par l'application).
export function toFrenchDate(isoDate: string): string {
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
}
