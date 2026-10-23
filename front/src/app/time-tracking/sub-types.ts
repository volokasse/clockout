export const PERIOD_TYPE = {
  WORK: 1,
  BREAK: 2,
  SCOUTING: 3
} as const;

export type SubTypeId = typeof PERIOD_TYPE.BREAK | typeof PERIOD_TYPE.SCOUTING;

export interface SubTypeInfo {
  id: SubTypeId;
  startLabel: string;
  statusLabel: string;
  endLabel: string;
}

export const SUB_TYPES: readonly SubTypeInfo[] = [
  {
    id: PERIOD_TYPE.BREAK,
    startLabel: 'Pause',
    statusLabel: 'En pause',
    endLabel: 'Reprendre'
  },
  {
    id: PERIOD_TYPE.SCOUTING,
    startLabel: 'Veille',
    statusLabel: 'Fais de la veille',
    endLabel: 'Terminer la veille'
  }
];

export function subTypeInfo(id: number): SubTypeInfo | undefined {
  return SUB_TYPES.find((type) => type.id === id);
}
