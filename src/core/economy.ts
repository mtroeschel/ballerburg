/**
 * Wirtschaft: Steuern, Bevölkerungswanderung, Einkommen, Preise.
 * Reine Funktionen; der Spielzustand wird in game.ts geändert.
 */
import { CASTLE, ECONOMY } from '../config.js';
import type { CastleState } from '../types.js';

/** Steuereinnahmen pro Runde. */
export function taxIncome(population: number, taxRate: number): number {
  return Math.round(population * taxRate / 100);
}

/** Aktive Fördertürme. */
export function towerCount(c: CastleState): number {
  let n = 0;
  for (const b of c.buildings) if (b.kind === 'tower' && b.active) n++;
  return n;
}

/** Einkommen aus Fördertürmen. */
export function towerIncome(c: CastleState): number {
  return towerCount(c) * CASTLE.towerIncome;
}

/**
 * Bevölkerungswanderung je Runde:
 * niedrige Steuern → Wachstum, hohe Steuern → Abwanderung,
 * dazu leichte Kriegsabnutzung.
 */
export function driftPopulation(population: number, taxRate: number): number {
  let p = population;
  if (taxRate < ECONOMY.growthTaxBelow) {
    p *= ECONOMY.growthRate;
  } else if (taxRate > ECONOMY.emigrationTaxAbove) {
    const over = taxRate - ECONOMY.emigrationTaxAbove;
    p *= 1 - Math.min(0.15, over * ECONOMY.emigrationFactor);
  }
  p *= ECONOMY.warAttrition;
  p = Math.max(ECONOMY.populationMin, Math.min(ECONOMY.populationMax, Math.round(p)));
  return p;
}

/** Gold für n Kugeln. */
export function ballCost(count: number): number {
  return count * CASTLE.priceBall;
}

/** Gold für `units` Pulver (5 Einheiten je Gold). */
export function powderCost(units: number): number {
  return Math.max(1, Math.ceil(units / CASTLE.powderPerGold));
}

/** Pulver-Einheiten, die man sich für `gold` maximal leisten kann. */
export function maxPowderFor(gold: number): number {
  return Math.floor(gold * CASTLE.powderPerGold);
}

/** Pulververbrauch pro Schuss in Abhängigkeit von der Pulvermenge (0..100). */
export function powderConsumed(powderSetting: number): number {
  const s = Math.max(0, Math.min(100, powderSetting));
  return Math.max(1, Math.round(s / 5));
}