import { describe, expect, it } from 'vitest';
import { simulateRoll, simulateShot, muzzleSpeedFor } from '../src/core/ballistics.js';
import { PHYSICS } from '../src/config.js';
import type { TerrainData } from '../src/types.js';

function flatTerrain(height = 470, width = 960): TerrainData {
  return { heights: Array.from({ length: width }, () => height), width, groundY: height };
}

/** Fester Kugelradius für Vorhersagbarkeit der Tests. */
const R = 6;

describe('simulateShot – flaches Terrain', () => {
  it('trifft den erwarteten Punkt ohne Wind (45°, 600 px/s)', () => {
    const ter = flatTerrain();
    const { impact } = simulateShot({
      start: { x: 100, y: 300 },
      angleDeg: 45,
      muzzleSpeed: 600,
      windAccel: 0,
      terrain: ter,
      targets: [],
      ballRadius: R,
    });
    expect(impact.kind).toBe('terrain');
    // Formel: v²/g + Start-(h)-Korrektur; Toleranz wegen Einzelschritt-Disktretisierung.
    expect(impact.x).toBeGreaterThan(660);
    expect(impact.x).toBeLessThan(730);
    expect(Math.abs(impact.y - (ter.groundY - R))).toBeLessThan(6);
  });

  it('ist deterministisch (gleiche Eingabe → gleicher Aufschlag)', () => {
    const ter = flatTerrain();
    const opts = {
      start: { x: 80, y: 260 },
      angleDeg: 55,
      muzzleSpeed: 720,
      windAccel: -40,
      terrain: ter,
      targets: [],
      ballRadius: R,
    };
    const a = simulateShot(opts);
    const b = simulateShot(opts);
    expect(a.impact.x).toBe(b.impact.x);
    expect(a.impact.y).toBe(b.impact.y);
    expect(a.impact.time).toBe(b.impact.time);
  });

  it('facing=-1 schießt nach links (Spieler 2 / rechter Berg)', () => {
    const ter = flatTerrain();
    const { impact } = simulateShot({
      start: { x: 800, y: 300 },
      angleDeg: 45,
      muzzleSpeed: 600,
      windAccel: 0,
      facing: -1,
      terrain: ter,
      targets: [],
      ballRadius: R,
    });
    expect(impact.kind).toBe('terrain');
    expect(impact.x).toBeLessThan(800); // landet links von der Mündung
  });

  it('facing=+1 (Standard) schießt nach rechts', () => {
    const ter = flatTerrain();
    const { impact } = simulateShot({
      start: { x: 100, y: 300 },
      angleDeg: 45,
      muzzleSpeed: 600,
      windAccel: 0,
      facing: 1,
      terrain: ter,
      targets: [],
      ballRadius: R,
    });
    expect(impact.x).toBeGreaterThan(100);
  });

  it('Wind nach rechts verlängert die Reichweite nach rechts', () => {
    const ter = flatTerrain();
    const base = (wind: number) =>
      simulateShot({
        start: { x: 150, y: 300 },
        angleDeg: 40,
        muzzleSpeed: 600,
        windAccel: wind,
        terrain: ter,
        targets: [],
        ballRadius: R,
      }).impact.x;
    const noWind = base(0);
    const withWind = base(120);
    expect(withWind).toBeGreaterThan(noWind + 40);
  });

  it('Wind nach links verkürzt die Reichweite', () => {
    const ter = flatTerrain();
    const base = (wind: number) =>
      simulateShot({
        start: { x: 150, y: 300 },
        angleDeg: 40,
        muzzleSpeed: 600,
        windAccel: wind,
        terrain: ter,
        targets: [],
        ballRadius: R,
      }).impact.x;
    expect(base(-120)).toBeLessThan(base(0) - 30);
  });
});

describe('simulateShot – Terrain-Kollision', () => {
  it('trifft ein hohes Hindernis (Pyramide/Stufe)', () => {
    const ter = flatTerrain();
    // Hohe Stufe zwischen x=400 und x=460
    for (let i = 400; i <= 460; i++) ter.heights[i] = 200;
    const { impact } = simulateShot({
      start: { x: 100, y: 300 },
      angleDeg: 25,
      muzzleSpeed: 750,
      windAccel: 0,
      terrain: ter,
      targets: [],
      ballRadius: R,
    });
    expect(impact.kind).toBe('terrain');
    expect(impact.x).toBeGreaterThanOrEqual(380);
    expect(impact.x).toBeLessThanOrEqual(470);
  });
});

describe('simulateShot – Gebäudekollision', () => {
  it('trifft ein Gebäude in der Flugbahn (steiler Abstieg)', () => {
    const ter = flatTerrain();
    const targets = [{ id: 42, x1: 600, y1: 80, x2: 650, y2: 110 }];
    const { impact } = simulateShot({
      start: { x: 100, y: 300 },
      angleDeg: 60,
      muzzleSpeed: 800,
      windAccel: 0,
      terrain: ter,
      targets,
      ballRadius: R,
    });
    expect(impact.kind).toBe('building');
    expect(impact.targetId).toBe(42);
    expect(impact.x).toBeGreaterThanOrEqual(600);
    expect(impact.x).toBeLessThanOrEqual(650);
  });
});

describe('simulateShot – Mündungsgeschwindigkeit', () => {
  it('Pulver 100 → volle Mündungsgeschwindigkeit; Pulver 0 → 0', () => {
    expect(muzzleSpeedFor(100)).toBe(PHYSICS.maxMuzzleSpeed);
    expect(muzzleSpeedFor(0)).toBe(0);
    expect(muzzleSpeedFor(50)).toBe(PHYSICS.maxMuzzleSpeed / 2);
  });
});

describe('simulateRoll', () => {
  it('rollt auf ebenem Grund aus (Reibung) und stoppt', () => {
    const ter = flatTerrain();
    const res = simulateRoll({
      start: { x: 200, y: ter.groundY - R },
      vx: 220,
      terrain: ter,
      targets: [],
      ballRadius: R,
    });
    expect(res.ended).toBe('stopped');
    expect(res.steps.length).toBeGreaterThan(2);
    expect(Math.abs(res.steps[res.steps.length - 1]!.vx)).toBeLessThan(4);
    // Rollt nach rechts
    expect(res.steps[res.steps.length - 1]!.x).toBeGreaterThan(200);
  });

  it('trifft beim Rollen ein Gebäude', () => {
    const ter = flatTerrain();
    const targets = [{ id: 7, x1: 260, y1: 440, x2: 290, y2: 464 }];
    const res = simulateRoll({
      start: { x: 200, y: 464 },
      vx: 200,
      terrain: ter,
      targets,
      ballRadius: R,
    });
    expect(res.ended).toBe('hit');
    expect(res.hit?.targetId).toBe(7);
  });
});