/** Kleine Helfer für die Phasen-Zustandsmaschine (Lesbarkeit/Tests). */
import type { Phase } from '../types.js';

export const PHASE_LABEL: Record<Phase, string> = Object.freeze({
  setup: 'EINSTELLUNGEN',
  turnStart: 'RUNDENBEGINN',
  aim: 'ZIELEN',
  flight: 'KUGEL FLIEGT',
  resolution: 'EINSCHLAG',
  manage: 'VERWALTUNG',
  gameOver: 'SPIELENDE',
});

export function phaseLabel(p: Phase): string {
  return PHASE_LABEL[p];
}

/** Ist die Aktion (Feuern/Verwalten) in dieser Phase erlaubt? */
export function canAct(p: Phase): boolean {
  return p === 'aim';
}