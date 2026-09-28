import { describe, expect, it } from 'vitest';
import {
  ballCost,
  driftPopulation,
  maxPowderFor,
  powderConsumed,
  powderCost,
  taxIncome,
  towerIncome,
  towerCount,
} from '../src/core/economy.js';
import { CASTLE, ECONOMY } from '../src/config.js';
import type { CastleState } from '../src/types.js';

function castle(): CastleState {
  return {
    player: 0,
    name: 'TEST',
    gold: 1000,
    balls: 20,
    powder: 50,
    population: 300,
    taxRate: 40,
    buildings: [],
    lastIncome: 0,
    surrendered: false,
  };
}

describe('Steuern', () => {
  it('Steuereinnahmen = Bevölkerung × Steuersatz', () => {
    expect(taxIncome(300, 40)).toBe(120);
    expect(taxIncome(300, 0)).toBe(0);
    expect(taxIncome(250, 50)).toBe(125);
  });

  it('Bevölkerungswanderung: hohe Steuern → Abwanderung, niedrige → Wachstum', () => {
    expect(driftPopulation(300, 80)).toBeLessThan(300);
    expect(driftPopulation(300, 20)).toBeGreaterThan(300);
    // Kriegsabnutzung begrenzt das Wachstum nicht ins Unermessliche
    expect(driftPopulation(500, 20)).toBeLessThanOrEqual(500);
    expect(driftPopulation(1, 90)).toBeGreaterThanOrEqual(ECONOMY.populationMin);
  });
});

describe('Türme', () => {
  it('Einkommen zählt nur aktive Türme', () => {
    const c = castle();
    c.buildings = [
      { id: 1, kind: 'tower', x: 0, baseY: 0, w: 10, h: 20, hp: 22, maxHp: 22, active: true, everActive: true, ready: true },
      { id: 2, kind: 'tower', x: 0, baseY: 0, w: 10, h: 20, hp: 22, maxHp: 22, active: false, everActive: false, ready: false },
    ];
    expect(towerCount(c)).toBe(1);
    expect(towerIncome(c)).toBe(CASTLE.towerIncome);
  });
});

describe('Preise', () => {
  it('Kugeln kosten 4 Gold je Stück', () => {
    expect(ballCost(5)).toBe(20);
  });
  it('Pulver: 5 Einheiten je Gold (aufgerundet)', () => {
    expect(powderCost(5)).toBe(1);
    expect(powderCost(10)).toBe(2);
    expect(powderCost(1)).toBe(1);
  });
  it('maxPowderFor rechnet Gold in Einheiten um', () => {
    expect(maxPowderFor(10)).toBe(50);
  });
  it('Verbrauch pro Schuss steigt mit der Pulvermenge', () => {
    expect(powderConsumed(0)).toBe(1);
    expect(powderConsumed(50)).toBe(10);
    expect(powderConsumed(100)).toBe(20);
  });
});