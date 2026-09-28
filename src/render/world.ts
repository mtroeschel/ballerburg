/**
 * Rendering der Welt: Sternenhimmel, Berge/Terrain (mit Kratern),
 * Windfahne und Eingriffe. Monochrom: weiß auf schwarz.
 */
import { WORLD } from '../config.js';
import { makeRng } from '../core/rng.js';
import { bg, fg, fgA } from './palette.js';
import { drawPixelText } from './font.js';
import type { TerrainData } from '../types.js';

/** Zeichnet einen punktförmigen Sternenhimmel (deterministisch). */
export function renderSky(ctx: CanvasRenderingContext2D, seed: number): void {
  const rng = makeRng(seed ^ 0x51a7);
  ctx.save();
  ctx.fillStyle = fgA(0.35);
  for (let i = 0; i < 36; i++) {
    const x = rng.next() * WORLD.width;
    const y = rng.next() * WORLD.height * 0.38;
    const s = rng.next() < 0.25 ? 2 : 1;
    ctx.fillRect(x, y, s, s);
  }
  ctx.restore();
}

/** Zeichnet das Terrain als weiße Fläche unter der Bodenlinie. */
export function renderTerrain(ctx: CanvasRenderingContext2D, t: TerrainData): void {
  const w = t.width;
  const H = WORLD.height;
  ctx.save();
  ctx.fillStyle = bg();
  ctx.fillRect(0, 0, w, H);

  ctx.fillStyle = fg();
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x < w; x++) {
    ctx.lineTo(x, t.heights[x]!);
  }
  ctx.lineTo(w, H);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Zeichnet die zwei Burgen (Sprite-Aufruf nachgeschaltet). */
export interface CastleRenderTarget {
  player: number;
  peakX: number;
}

/** Hintergrundtext (z. B. "BALLERBURG") im Pixel-Font. */
export function renderLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  pixel: number,
  color?: string,
): void {
  drawPixelText(ctx, x, y, text, pixel, color);
}