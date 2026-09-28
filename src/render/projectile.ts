/**
 * Rendering von Kugel (mit Schweif), Explosionen und Partikeln.
 */
import { bg, fg, fgA } from './palette.js';
import { PHYSICS } from '../config.js';
import { ballPositionAt } from '../core/game.js';
import { makeRng } from '../core/rng.js';
import type { GameState, ShotPlan } from '../types.js';

/** Zeichnet die fliegende Kugel + Schweif während des Flugs. */
export function renderProjectile(ctx: CanvasRenderingContext2D, state: GameState): void {
  const plan = state.pendingShot;
  if (!plan || state.phase !== 'flight') return;
  const pos = ballPositionAt(plan, plan.playT);
  if (!pos) return;

  // Schweif: einige zurückliegende Punkte
  ctx.save();
  ctx.fillStyle = fgA(0.5);
  const dt = PHYSICS.simDt;
  for (let i = 4; i <= 16; i++) {
    const t = plan.playT - i * dt;
    if (t < 0) break;
    const p = ballPositionAt(plan, t);
    if (!p) break;
    ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
  }
  ctx.restore();

  // Kugel: gefüllt mit Kontur (auf hellem Terrain sichtbar)
  ctx.save();
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, PHYSICS.ballRadius, 0, Math.PI * 2);
  ctx.fillStyle = fg();
  ctx.fill();
  ctx.strokeStyle = bg();
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Kernpunkt
  ctx.fillStyle = bg();
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Zeichnet Explosionen (Ring + Partikel), monochrom. */
export function renderExplosions(ctx: CanvasRenderingContext2D, state: GameState, timeSec: number): void {
  for (const e of state.explosions) {
    const f = Math.min(1, e.age / e.duration);
    const r = 6 + f * e.duration * 34;
    const alpha = 1 - f;

    // weißer Blitz-Kern
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = fg();
    ctx.beginPath();
    ctx.arc(e.x, e.y, Math.max(1.5, r * 0.35), 0, Math.PI * 2);
    ctx.fill();

    // Ring
    ctx.strokeStyle = fg();
    ctx.lineWidth = 2.2 * (1 - f) + 0.8;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();

    // Partikel (deterministisch)
    const rng = makeRng(Math.round(e.x * 7919 + e.y * 104729 + timeSec * 0));
    ctx.save();
    ctx.fillStyle = bg();
    for (let i = 0; i < 10; i++) {
      const ang = rng.next() * Math.PI * 2;
      const dist = rng.next() * r * 0.9;
      const px = e.x + Math.cos(ang) * dist;
      const py = e.y + Math.sin(ang) * dist * 0.8;
      const s = rng.next() < 0.5 ? 2 : 1;
      ctx.fillRect(px, py, s, s);
    }
    ctx.restore();
  }
}

/** Punktierte Trajektorien-Vorschau (optional, T) + Einschlagmarkierung. */
export function renderTrajectoryPreview(ctx: CanvasRenderingContext2D, plan: ShotPlan): void {
  ctx.save();
  ctx.fillStyle = fgA(0.55);
  const step = Math.max(1, Math.round(plan.flySteps.length / 90));
  for (let i = 0; i < plan.flySteps.length; i += step) {
    const s = plan.flySteps[i]!;
    ctx.fillRect(s.x - 1, s.y - 1, 2, 2);
  }
  // Einschlagspunkt anzeigen (Kreuz)
  ctx.fillStyle = fgA(0.9);
  const cx = plan.impact.x;
  const cy = Math.min(plan.impact.y, 535);
  ctx.fillRect(cx - 4, cy - 1, 2, 2);
  ctx.fillRect(cx + 3, cy - 1, 2, 2);
  ctx.fillRect(cx - 1, cy - 4, 2, 2);
  ctx.fillRect(cx - 1, cy + 3, 2, 2);
  ctx.restore();
}