/**
 * Ballistik: Trajektorie einer Mörser-Kugel unter Gravitation + Wind
 * mit Terrain- und Gebäudekollision. Reines, deterministisches Modul.
 *
 * Bildschirm-Koordinaten: y wächst nach unten → Gravitation zeigt nach +y.
 */
import { PHYSICS } from '../config.js';
import type { BuildingTarget, Impact, RollHit, RollStep, Step, TerrainData } from '../types.js';

export interface ShotInput {
  start: { x: number; y: number };
  angleDeg: number;
  muzzleSpeed: number;
  windAccel: number;
  terrain: TerrainData;
  targets: readonly BuildingTarget[];
  /** Schussrichtung: +1 = nach rechts (Spieler 0), −1 = nach links (Spieler 1). */
  facing?: 1 | -1;
  /** Sim-Schrittweite (Sekunden). */
  dt?: number;
  maxTime?: number;
  ballRadius?: number;
  /** Sammelt alle Simulationsschritte (für Animation/Vorschau). */
  collect?: boolean;
}

export interface Trajectory {
  steps: Step[];
  impact: Impact;
}

export interface RollInput {
  start: { x: number; y: number };
  vx: number;
  terrain: TerrainData;
  targets: readonly BuildingTarget[];
  dt?: number;
  maxTime?: number;
  ballRadius?: number;
}

export interface RollResult {
  steps: RollStep[];
  hit: RollHit | null;
  ended: 'stopped' | 'timeout' | 'bounds' | 'hit';
}

/** Terrainhöhe an Spalte x (Bildschirm-y der Bodenlinie). */
export function heightAt(t: TerrainData, x: number): number {
  const i = Math.max(0, Math.min(t.width - 1, Math.round(x)));
  return t.heights[i]!;
}

function near(a: number, b: number, eps: number): boolean {
  return Math.abs(a - b) < eps;
}

function inRect(px: number, py: number, r: { x1: number; y1: number; x2: number; y2: number }): boolean {
  return px >= r.x1 && px <= r.x2 && py >= r.y1 && py <= r.y2;
}

function segIntersect(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): boolean {
  const cross = (ox: number, oy: number, px: number, py: number, qx: number, qy: number): number =>
    (px - ox) * (qy - oy) - (py - oy) * (qx - ox);
  const d1 = cross(ax, ay, bx, by, cx, cy);
  const d2 = cross(ax, ay, bx, by, dx, dy);
  const d3 = cross(cx, cy, dx, dy, ax, ay);
  const d4 = cross(cx, cy, dx, dy, bx, by);
  if (((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0))) return true;
  if (near(d1, 0, 1e-9) && inRect(cx, cy, { x1: Math.min(ax, bx), y1: Math.min(ay, by), x2: Math.max(ax, bx), y2: Math.max(ay, by) })) return true;
  if (near(d2, 0, 1e-9) && inRect(dx, dy, { x1: Math.min(ax, bx), y1: Math.min(ay, by), x2: Math.max(ax, bx), y2: Math.max(ay, by) })) return true;
  return false;
}

/** Trifft die Strecke (a→b) das um den Radius vergrößerte Rechteck? */
function pathHitsRect(
  ax: number, ay: number, bx: number, by: number,
  radius: number, t: BuildingTarget,
): boolean {
  const r = { x1: t.x1 - radius, y1: t.y1 - radius, x2: t.x2 + radius, y2: t.y2 + radius };
  if (inRect(ax, ay, r) || inRect(bx, by, r)) return true;
  return (
    segIntersect(ax, ay, bx, by, r.x1, r.y1, r.x2, r.y1) ||
    segIntersect(ax, ay, bx, by, r.x2, r.y1, r.x2, r.y2) ||
    segIntersect(ax, ay, bx, by, r.x1, r.y2, r.x2, r.y2) ||
    segIntersect(ax, ay, bx, by, r.x1, r.y1, r.x1, r.y2)
  );
}

/**
 * Simuliert den Flug der Kugel bis zum ersten Aufprall
 * (Terrain, Gebäude oder Verlassen der Karte).
 */
export function simulateShot(input: ShotInput): Trajectory {
  const dt = input.dt ?? PHYSICS.simDt;
  const maxT = input.maxTime ?? PHYSICS.maxFlightTime;
  const r = input.ballRadius ?? PHYSICS.ballRadius;
  const g = PHYSICS.gravity;

  const a = (input.angleDeg * Math.PI) / 180;
  const facing = input.facing ?? 1;
  let x = input.start.x;
  let y = input.start.y;
  let vx = facing * Math.cos(a) * input.muzzleSpeed;
  let vy = -Math.sin(a) * input.muzzleSpeed;
  const steps: Step[] = input.collect ? [{ x, y, vx, vy, t: 0 }] : [];

  let t = 0;
  const width = input.terrain.width;
  while (t < maxT) {
    const nx = x + vx * dt;
    const ny = y + vy * dt;
    t += dt;

    // Karte verlassen?
    if (nx < -80 || nx > width + 80 || ny > input.terrain.groundY + 200) {
      return { steps, impact: { kind: 'out', targetId: null, time: t, x: nx, y: ny, vx, vy } };
    }

    // Gebäudetreffer (Schritt-Segment gegen Ziel-Rechtecke)?
    for (const tg of input.targets) {
      if (pathHitsRect(x, y, nx, ny, r, tg)) {
        return {
          steps,
          impact: { kind: 'building', targetId: tg.id, time: t, x: nx, y: ny, vx, vy },
        };
      }
    }

    // Terrain-Kollision?
    const surf = heightAt(input.terrain, nx);
    if (ny >= surf - r) {
      return {
        steps,
        impact: {
          kind: 'terrain',
          targetId: null,
          time: t,
          x: nx,
          y: Math.min(ny, surf - r),
          vx,
          vy,
        },
      };
    }

    x = nx;
    y = ny;
    vy += g * dt;
    vx += input.windAccel * dt;
    if (input.collect) steps.push({ x, y, vx, vy, t });
  }

  return { steps, impact: { kind: 'out', targetId: null, time: t, x, y, vx, vy } };
}

/**
 * Rollt die Kugel nach einem Terrain-Aufprall weiter (Friction + Hang).
 * Trifft sie dabei ein Gebäude, stoppt sie dort (RollHit).
 */
export function simulateRoll(input: RollInput): RollResult {
  const dt = input.dt ?? PHYSICS.simDt;
  const maxT = input.maxTime ?? PHYSICS.maxRollTime;
  const r = input.ballRadius ?? PHYSICS.ballRadius;
  const g = PHYSICS.gravity;

  let x = input.start.x;
  let y = input.start.y;
  let vx = input.vx;
  const steps: RollStep[] = [{ x, y, vx, t: 0 }];
  let t = 0;
  const width = input.terrain.width;

  while (t < maxT && Math.abs(vx) > 2) {
    const nx = x + vx * dt;
    t += dt;
    if (nx < -80 || nx > width + 80) {
      return { steps, hit: null, ended: 'bounds' };
    }
    const surf = heightAt(input.terrain, nx);
    const ny = surf - r;

    // Gebäudekollision während des Rollens?
    for (const tg of input.targets) {
      if (pathHitsRect(x, y, nx, ny, r, tg)) {
        return { steps, hit: { targetId: tg.id, speed: Math.abs(vx) }, ended: 'hit' };
      }
    }

    // Hang-Beschleunigung: abwärts (surf kleiner) → schneller.
    const prevSurf = y + r;
    const slope = (surf - prevSurf) / Math.max(1e-6, nx - x);
    if (slope < -0.02) {
      vx += -slope * g * PHYSICS.rollSlopeAccel * dt;
    }
    // Reibung
    vx -= Math.sign(vx) * PHYSICS.rollFriction * dt;

    x = nx;
    y = ny;
    steps.push({ x, y, vx, t });
  }

  const ended = Math.abs(vx) <= 2 ? 'stopped' : 'timeout';
  return { steps, hit: null, ended };
}

/** Mündungsgeschwindigkeit aus Pulvermenge (0..100). */
export function muzzleSpeedFor(powder: number): number {
  const p = Math.max(0, Math.min(100, powder));
  return (p / 100) * PHYSICS.maxMuzzleSpeed;
}