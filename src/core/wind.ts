/**
 * Windmodell: Richtungs-/Stärke-Wechsel je Runde.
 * Wind wird in "Einheiten" gemessen (negativ = von rechts nach links);
 * Beschleunigung = speed * WIND_ACCEL_PER_UNIT.
 */
import { PHYSICS, WIND_SIM } from '../config.js';
import type { Rng } from './rng.js';

export function windAccel(speedUnits: number): number {
  return speedUnits * PHYSICS.windAccelPerUnit;
}

/** Neuer Wind für die nächste Runde. */
export function nextWind(rng: Rng, prev: number): number {
  const max = WIND_SIM.maxUnits;
  let s = prev;

  if (rng.next() < WIND_SIM.calmChance) {
    s = 0;
  } else {
    s += rng.range(WIND_SIM.stepMin, WIND_SIM.stepMax) * (rng.next() < 0.5 ? -1 : 1);
    if (rng.next() < WIND_SIM.flipChance) s = -s;
    s = Math.max(-max, Math.min(max, s));
  }
  return s;
}

/** Initialer Wind. */
export function initialWind(rng: Rng): number {
  return rng.range(-WIND_SIM.startRange, WIND_SIM.startRange);
}