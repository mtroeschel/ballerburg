/**
 * Verfahrens-generierte Pixel-Sprites für die Burggebäude.
 * Monochrom: Gebäude dunkel auf hellem Berg; jede Gebäudeart hat eine
 * eigene, gut unterscheidbare Silhouette + Symbol (Zinnen+Fahne = Thron,
 * Rohr+Rad = Kanone, Kugelstapel = Kugellager, Fass = Pulverlager,
 * Münzen = Schatzkammer, Fördergerüst = Turm, Zahnkrone = Mauer).
 */
import { bg, fg, fgA } from './palette.js';
import { drawPixelText } from './font.js';
import type { Building, CastleState, GameState } from '../types.js';

export interface AimInfo {
  angleDeg: number;
  isActiveHumanShooter: boolean;
}

/** Zeichnet alle Burgen (niedrige Gebäude zuerst → Überlappung korrekt). */
export function renderCastles(ctx: CanvasRenderingContext2D, state: GameState, aim: AimInfo): void {
  const all: Array<{ b: Building; c: CastleState }> = [];
  for (const c of state.castles) {
    for (const b of c.buildings) {
      // Inaktive, nie gebaute Türme: nur Fundament andeuten.
      if (b.kind === 'tower' && !b.active && !b.everActive) {
        drawTowerSlot(ctx, b);
        continue;
      }
      if (!b.active) {
        drawRubble(ctx, b);
        continue;
      }
      all.push({ b, c });
    }
  }
  all.sort((a, z) => (a.b.baseY - a.b.h) - (z.b.baseY - z.b.h));
  for (const { b, c } of all) {
    drawBuilding(ctx, state, c, b, aim);
  }
}

function drawTowerSlot(ctx: CanvasRenderingContext2D, b: Building): void {
  ctx.save();
  ctx.strokeStyle = fgA(0.35);
  ctx.setLineDash([3, 3]);
  ctx.strokeRect(b.x - b.w / 2, b.baseY - 7, b.w, 7);
  ctx.restore();
}

function drawRubble(ctx: CanvasRenderingContext2D, b: Building): void {
  ctx.save();
  ctx.fillStyle = fgA(0.4);
  ctx.fillRect(b.x - b.w / 2 - 2, b.baseY - 6, b.w + 4, 6);
  ctx.fillStyle = bg();
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(b.x - b.w / 2 + ((i * 7) % (b.w - 2)), b.baseY - 5 + (i % 2) * 3, 3, 2);
  }
  ctx.restore();
}

/** Dunkle Fläche mit hellem 1px-Rahmen (damit sich Gebäude abheben). */
function body(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = bg();
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = fg();
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

/** Helfer: gefüllter Kreis in gegebener Farbe. */
function circle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, fill: string): void {
  ctx.save();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Helfer: Dreieck (Pfad) in gegebener Farbe füllen. */
function tri(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, fill: string): void {
  ctx.save();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBuilding(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  c: CastleState,
  b: Building,
  aim: AimInfo,
): void {
  ctx.save();
  const x = b.x;
  const y = b.baseY;
  const half = b.w / 2;

  switch (b.kind) {
    /* ----- Thronsaal: Wehrbau mit Spitzdach + Fahne ----- */
    case 'throne': {
      const top = y - b.h; // Oberkante des Turms
      // Turm-Körper
      body(ctx, x - half, top + 2, b.w, b.h - 2);
      // Zinnen auf beiden Seiten der Dachkante
      ctx.fillStyle = bg();
      for (let i = 0; i < 5; i++) {
        const mx = x - half + 2 + i * (b.w - 4) / 4;
        ctx.fillRect(mx, top - 3, 3, 4);
      }
      // Spitzdach
      tri(ctx, x - half, top, x + half, top, x, top - 10, bg());
      ctx.strokeStyle = fg();
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - half, top);
      ctx.lineTo(x, top - 10);
      ctx.moveTo(x + half, top);
      ctx.lineTo(x, top - 10);
      ctx.stroke();
      // Fahne auf dem Dachfirst
      ctx.fillStyle = bg();
      ctx.fillRect(x - 1, top - 14, 2, 4);
      tri(ctx, x - 3, top - 14, x - 3, top - 10, x + 3, top - 10, fg());
      // Fenster
      ctx.fillStyle = fg();
      ctx.fillRect(x - half + 5, top + 8, 4, 5);
      ctx.fillRect(x + half - 9, top + 8, 4, 5);
      // Tür (Rundbogen)
      ctx.fillRect(x - 3, y - 9, 6, 9);
      tri(ctx, x - 3, y - 9, x + 3, y - 9, x, y - 11, fg());
      drawDamage(ctx, b);
      break;
    }

    /* ----- Windfahne: Türmchen mit Mast, Wetterhahn & Wimpel ----- */
    case 'windvane': {
      const vy = y - b.h;
      // Türmchen-Basis
      body(ctx, x - 4, y - 4, 8, 4);
      // Mast
      ctx.fillStyle = bg();
      ctx.fillRect(x - 1, vy + 1, 2, y - vy - 4);
      // Kugel (Drehlager)
      circle(ctx, x, vy + 1, 1.6, fg());
      // Wetterhahn: Pfeil in Windrichtung + Feder
      const dir = state.wind.speed >= 0 ? 1 : -1;
      const sway = Math.sin(state.round * 0.9) * 1.5;
      tri(ctx, x, vy - 2 + sway, x + dir * 7, vy - 2 + sway, x + dir * 7, vy + 3 + sway, bg());
      ctx.strokeStyle = fg();
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, vy - 2 + sway);
      ctx.lineTo(x - dir * 6, vy - 1 + sway);
      ctx.stroke();
      // Wimpel
      tri(ctx, x - 2, vy + 4, x + 2, vy + 4, x, vy + 9, fg());
      drawDamage(ctx, b);
      break;
    }

    /* ----- Kanone: Stufenplattform, Rohr (dreht sich), Räder, Kugeln ----- */
    case 'cannon': {
      drawCannon(ctx, x, y, state, c, b, aim);
      break;
    }

    /* ----- Kugellager: Schuppen mit Kugelstapel ----- */
    case 'ballstore': {
      const top = y - 10;
      body(ctx, x - half, top, b.w, 10);
      // Satteldach
      tri(ctx, x - half, top, x + half, top, x, top - 5, bg());
      // Kugelstapel (Dreieck): 3 Kugeln
      const balls = [
        { bx: x - 4, by: y - 8 },
        { bx: x + 2, by: y - 8 },
        { bx: x - 1, by: y - 12 },
      ];
      for (const p of balls) {
        circle(ctx, p.bx, p.by, 2.4, fg());
        circle(ctx, p.bx, p.by, 1, bg());
      }
      // Öffnung/Eingang
      ctx.fillStyle = fg();
      ctx.fillRect(x + half - 8, y - 6, 4, 6);
      drawDamage(ctx, b);
      break;
    }

    /* ----- Pulverlager: Kuppelmagazin mit Fass für Pulver ----- */
    case 'powderstore': {
      const top = y - 10;
      body(ctx, x - half, top, b.w, 10);
      // Kuppel
      ctx.save();
      ctx.fillStyle = bg();
      ctx.beginPath();
      ctx.arc(x, top, half, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = fg();
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
      // Fass mit 'P' und Reifen
      ctx.fillStyle = bg();
      ctx.fillRect(x - 4, y - 12, 8, 9);
      ctx.strokeStyle = fg();
      ctx.strokeRect(x - 3, y - 11, 6, 7);
      drawPixelText(ctx, x - 3, y - 10, 'P', 1, fg());
      // Sicherheitsmarke (Kreuz) über dem Fass
      ctx.fillStyle = fg();
      ctx.fillRect(x - 1, y - 14, 2, 2);
      ctx.fillRect(x - 3, y - 13, 2, 2);
      ctx.fillRect(x + 1, y - 13, 2, 2);
      drawDamage(ctx, b);
      break;
    }

    /* ----- Schatzkammer: Giebelhaus mit Münzhaufen + Krone ----- */
    case 'treasury': {
      const top = y - 10;
      body(ctx, x - half, top, b.w, 10);
      // Giebel
      tri(ctx, x - half, top, x + half, top, x, top - 5, bg());
      ctx.strokeStyle = fg();
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - half, top);
      ctx.lineTo(x + half, top);
      ctx.stroke();
      // Krone auf dem First
      tri(ctx, x - 2, top - 5, x + 2, top - 5, x, top - 8, fg());
      ctx.fillStyle = fg();
      ctx.fillRect(x - 1, top - 8, 2, 2);
      // Münzhaufen
      circle(ctx, x - 4, y - 6, 2.6, fg());
      circle(ctx, x + 2, y - 6, 2.6, fg());
      circle(ctx, x - 1, y - 9, 2, fg());
      drawDamage(ctx, b);
      break;
    }

    /* ----- Förderturm: schlankes Fördergerüst mit Seilrad ----- */
    case 'tower': {
      const top = y - b.h;
      // Beine (schräg)
      ctx.strokeStyle = bg();
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x - 6, y);
      ctx.lineTo(x - 4, top);
      ctx.moveTo(x + 6, y);
      ctx.lineTo(x + 4, top);
      ctx.stroke();
      // Querstreben
      ctx.strokeStyle = fg();
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 5, y - b.h / 2);
      ctx.lineTo(x + 5, y - b.h / 2);
      ctx.moveTo(x - 5, y - 4);
      ctx.lineTo(x + 5, y - 4);
      ctx.stroke();
      // Kabine oben
      body(ctx, x - 4, top, 8, 5);
      // Seilrad (großer Kreis mit Achse)
      circle(ctx, x, top - 4, 3.4, bg());
      circle(ctx, x, top - 4, 1.2, fg());
      // Seil
      ctx.strokeStyle = fg();
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, top - 4);
      ctx.lineTo(x, y - 6);
      ctx.stroke();
      circle(ctx, x, y - 5, 1.4, fg());
      drawDamage(ctx, b);
      break;
    }

    /* ----- Mauer: Zahnkrone mit Steinritzung ----- */
    case 'wall': {
      const top = y - b.h;
      body(ctx, x - half, top, b.w, b.h);
      // Zinnen
      ctx.fillStyle = bg();
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(x - half + 2 + i * (b.w - 4) / 3, top - 3, 3, 4);
      }
      // Steinritzungen
      ctx.strokeStyle = fg();
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - half + 6, top + 3);
      ctx.lineTo(x + half - 6, top + 3);
      ctx.moveTo(x - 2, top + 3);
      ctx.lineTo(x - 2, y - 2);
      ctx.moveTo(x + 3, top + 3);
      ctx.lineTo(x + 3, y - 2);
      ctx.stroke();
      drawDamage(ctx, b);
      break;
    }
  }
  ctx.restore();
}

function drawDamage(ctx: CanvasRenderingContext2D, b: Building): void {
  if (b.hp >= b.maxHp) return;
  const frac = 1 - b.hp / b.maxHp;
  const cracks = Math.min(5, Math.ceil(frac * 6));
  ctx.save();
  ctx.fillStyle = fg();
  for (let i = 0; i < cracks; i++) {
    ctx.fillRect(b.x + ((i * 11) % b.w) - b.w / 2 + 2, b.baseY - 4 - (i % 4) * 3, 3, 2);
  }
  ctx.restore();
}

function drawCannon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  state: GameState,
  c: CastleState,
  b: Building,
  aim: AimInfo,
): void {
  const facing: 1 | -1 = c.player === 0 ? 1 : -1;
  const pivotX = x;
  const pivotY = y - 11;

  // Stufenplattform
  body(ctx, x - b.w / 2, y - 6, b.w, 6);
  body(ctx, x - b.w / 2 + 3, y - 9, b.w - 6, 3);

  // Räder (hinter dem Rohr)
  circle(ctx, x - 6, y - 6, 3, bg());
  circle(ctx, x - 6, y - 6, 1.2, fg());
  circle(ctx, x + 6, y - 6, 3, bg());
  circle(ctx, x + 6, y - 6, 1.2, fg());

  // Kugelstapel daneben (Munition)
  circle(ctx, x - facing * 9, y - 8, 1.8, fg());
  circle(ctx, x - facing * 10, y - 10, 1.6, fg());

  // Rohr
  const shootAngle = aim.isActiveHumanShooter ? aim.angleDeg : 55;
  const a = (shootAngle * Math.PI) / 180;
  const len = 24;
  const ex = pivotX + facing * Math.cos(a) * len;
  const ey = pivotY - Math.sin(a) * len;

  ctx.save();
  ctx.strokeStyle = bg();
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(pivotX, pivotY);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  ctx.strokeStyle = fg();
  ctx.lineWidth = 1.4;
  ctx.stroke();
  // Mündungsring
  circle(ctx, ex, ey, 2.4, fg());
  circle(ctx, ex, ey, 1.1, bg());
  ctx.restore();

  if (b.hp < b.maxHp) drawDamage(ctx, b);
}