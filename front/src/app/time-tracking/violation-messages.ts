import { Violation, ViolationCode } from "./history.model";


const MESSAGES: Record<ViolationCode, string> = {
  SESSION_END_BEFORE_START: "L'heure de départ doit être après l'heure d'arrivée.",
  SESSION_IN_FUTURE: "Une session ne peut pas être dans le futur.",
  SESSIONS_OVERLAP: "Cette session chevauche une autre session.",
  SUB_END_BEFORE_START: "La fin doit être après le début.",
  SUB_OUTSIDE_SESSION: "Doit rester dans les horaires de la session",
  SUB_OPEN_IN_CLOSED_SESSION: "Une pause sans fin n'est possible que dans une session en cours.",
  SUB_MULTIPLE_OPEN: "Une seule sous-période peut être en cours à la fois.",
  SUBS_OVERLAP: "Chevauche une autre pause."
};

export function describeViolation(violation: Violation): string {
  const text = MESSAGES[violation.code] ?? violation.message;
  const match = /^subs\[(\d+)\]$/.exec(violation.path);
  return match ? `Pause ${Number(match[1]) + 1} : ${text}` : text;
}
