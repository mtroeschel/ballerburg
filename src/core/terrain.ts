/**
 * Terrain: Höhenprofil (Heightmap), zufällige Berg-Erzeugung mit
 * garantierten Spielbarkeits-Constraints, Krater.
 * Deterministisch über den übergebenen Seed.
 *
 * Spielbarkeits-Regeln:
 *  - Genau ZWEI hohe Gipfel (einer pro Burg) an den Kartenrändern; dazwischen
 *    bleibt ein niedriges Tal, damit immer ein Schusskorridor existiert.
 *  - Gipfelhöhe/-breite/-form werden per Seed zufällig variiert.
 *  - Zusätzliche kleine Hügel im Tal bleiben niedrig (kein Mauer-Effekt).
 *  - Alles bleibt im erlaubten Höhenfenster [minHeight, Talboden].
 */
import { TERRAIN } from '../config.js';
import { makeRng, type Rng } from './rng.js';
import type { TerrainData } from '../types.js';

export interface TerrainGenOptions {
  seed: number;
  width?: number;
  groundY?: number;
  /** Deaktiviert die zufälligen Hügel (für deterministische Basistests). */
  noBumps?: boolean;
}

/** Ein Berg/Hügel: Mittelpunkt, Höhe über dem Tal, Breite (Foot u=1), Form (Potenz). */
export interface Peak {
  x: number;
  /** Max. Höhe über dem Talboden (px). */
  h: number;
  /** Breite bis zum Fußpunkt (Default: TERRAIN.mountainWidth). */
  w?: number;
  /** Form-Potenz: 1.2 spitz … 3.0 flach/torgish (Default: TERRAIN.mountainPower). */
  k?: number;
}

/** Erzeugt das Höhenprofil zweier Berge (mit Hügeln) und einem Tal dazwischen. */
export function generateTerrain(opts: TerrainGenOptions): TerrainData {
  const rng = makeRng(opts.seed);
  const width = opts.width ?? 960;
  const groundY = opts.groundY ?? rng.range(TERRAIN.valleyMin, TERRAIN.valleyMax);

  const peaks = generatePeaks(rng, width);
  const bumps = opts.noBumps ? [] : generateBumps(rng, width);

  const heights: number[] = [];
  for (let x = 0; x < width; x++) {
    let drop = 0;
    for (const p of peaks) drop = Math.max(drop, mountainHeight(p, x));
    for (const b of bumps) drop = Math.max(drop, mountainHeight(b, x));
    // Ganz am Rand leicht anheben (Bildrahmen).
    const edgeLift =
      TERRAIN.edgeLift * Math.max(0, 1 - x / 70) +
      TERRAIN.edgeLift * Math.max(0, 1 - (width - x) / 70);
    heights.push(Math.max(TERRAIN.minHeight, groundY - drop - edgeLift));
  }
  return { heights, width, groundY };
}

/**
 * Die zwei Burg-Gipfel: links und rechts, mit zufälliger Höhe, Breite und
 * Form. Die Positionen bleiben in den äußeren Randbändern, damit der
 * Talkessel in der Mitte frei bleibt.
 */
export function generatePeaks(rng: Rng, width: number): Peak[] {
  const lx = width * rng.float(0.1, 0.2);
  const rx = width * rng.float(0.8, 0.9);
  const mkPeak = (x: number): Peak => ({
    x,
    h: rng.range(TERRAIN.peakMin, TERRAIN.peakMax),
    w: rng.range(TERRAIN.mountainWidthMin, TERRAIN.mountainWidthMax),
    k: rng.float(TERRAIN.mountainPowerMin, TERRAIN.mountainPowerMax),
  });
  return [mkPeak(lx), mkPeak(rx)];
}

/** 0..n kleine, niedrige Hügel im offenen Tal (dezent unterhalb der Peaks). */
export function generateBumps(rng: Rng, width: number): Peak[] {
  const count = rng.int(TERRAIN.bumpMaxCount + 1);
  const out: Peak[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      x: width * rng.float(0.24, 0.76),
      h: rng.range(TERRAIN.bumpHeightMin, TERRAIN.bumpHeightMax),
      w: rng.range(TERRAIN.bumpWidthMin, TERRAIN.bumpWidthMax),
      k: rng.float(2.0, 3.2),
    });
  }
  return out;
}

/**
 * Höhenbeitrag eines Berges/Hügels an x (px über dem Talboden).
 * Form: h * (1 − u^k) für 0 ≤ u < 1 → bei u=0 volle Höhe, am Fuß 0.
 */
export function mountainHeight(p: Peak, x: number): number {
  const w = p.w && p.w > 0 ? p.w : TERRAIN.mountainWidth;
  const k = p.k && p.k > 0 ? p.k : TERRAIN.mountainPower;
  const u = Math.abs(x - p.x) / w;
  if (u >= 1) return 0;
  return p.h * (1 - Math.pow(u, k));
}

/** Dictionary-Form für ältere Aufrufer/Tests. */
export function mountainHeightAt(px: number, h: number, w: number, k: number, x: number): number {
  return mountainHeight({ x: px, h, w, k }, x);
}

/** Setzt einen Krater (Senkung der Bodenlinie in einem Radius). */
export function addCrater(terrain: TerrainData, x: number, depth: number, radius: number = 30): void {
  const r0 = Math.max(4, radius);
  const x0 = Math.round(x);
  const x1 = Math.max(0, x0 - Math.ceil(r0 * 2.2));
  const x2 = Math.min(terrain.width - 1, x0 + Math.ceil(r0 * 2.2));
  for (let i = x1; i <= x2; i++) {
    const dx = (i - x0) / r0;
    const k = Math.exp(-(dx * dx) * 1.1);
    const delta = Math.round(depth * k);
    const cur = terrain.heights[i]!;
    terrain.heights[i] = Math.max(TERRAIN.minHeight, cur + delta);
  }
}

/**
 * Glätte das Terrain leicht (Erosion), damit Krater natürlich wirken.
 * Optional, wird aktuell nicht im Spielzyklus aufgerufen.
 */
export function erode(terrain: TerrainData, strength: number = 0.5): void {
  const h = terrain.heights;
  const out = h.slice();
  for (let i = 1; i < h.length - 1; i++) {
    out[i] = h[i]! + (h[i - 1]! + h[i + 1]! - 2 * h[i]!) * strength;
  }
  terrain.heights = out;
}