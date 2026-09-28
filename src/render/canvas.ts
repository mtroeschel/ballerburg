/**
 * Canvas-Setup mit DPI-Skalierung und "Letterbox"-Kamera:
 * Die Welt (960×540) wird maßstäblich in das Fenster gezeichnet.
 */
import { WORLD } from '../config.js';
import { bg } from './palette.js';

export interface Camera {
  /** Skalierungsfaktor Pixel → Bildschirm. */
  scale: number;
  /** Offset in Bildschirm-Pixeln (Letterbox). */
  ox: number;
  oy: number;
  /** Zeichnet verfügen bereits über die Kamera-Transformation. */
}

export interface Canvas2D {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  cam: { scale: number; ox: number; oy: number };
  dpr: number;
  /** Bildschirmfenster-Größe in CSS-Pixeln. */
  viewW: number;
  viewH: number;
  /** Weltkoordinate → Bildschirm (CSS-Pixel). */
  worldToScreen(x: number, y: number): { x: number; y: number };
  screenToWorld(sx: number, sy: number): { x: number; y: number };
  /** Setzt die dpr-Basistransformation und füllt den Rahmen schwarz. */
  beginFrame(): void;
  resize(): void;
}

export function setupCanvas(canvas: HTMLCanvasElement): Canvas2D {
  const g = canvas.getContext('2d');
  if (!g) throw new Error('Canvas nicht verfügbar');

  const c: Canvas2D = {
    canvas,
    ctx: g,
    cam: { scale: 1, ox: 0, oy: 0 },
    dpr: 1,
    viewW: 0,
    viewH: 0,
    worldToScreen(sx, sy) {
      return { x: sx * this.cam.scale + this.cam.ox, y: sy * this.cam.scale + this.cam.oy };
    },
    screenToWorld(sx, sy) {
      return { x: (sx - this.cam.ox) / this.cam.scale, y: (sy - this.cam.oy) / this.cam.scale };
    },
    beginFrame() {
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      g.fillStyle = bg();
      g.fillRect(0, 0, this.viewW, this.viewH);
    },
    resize() {
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const w = Math.max(320, window.innerWidth);
      const h = Math.max(240, window.innerHeight);
      this.viewW = w;
      this.viewH = h;
      this.dpr = dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const scale = Math.min(w / WORLD.width, h / WORLD.height);
      const ox = (w - WORLD.width * scale) / 2;
      const oy = (h - WORLD.height * scale) / 2;
      this.cam.scale = scale;
      this.cam.ox = ox;
      this.cam.oy = oy;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = bg();
      g.fillRect(0, 0, w, h);
    },
  };
  return c;
}

/** Setzt die Kamera-Transformation für Weltkoordinaten (nach beginFrame). */
export function applyCamera(ctx: CanvasRenderingContext2D, c: Canvas2D): void {
  ctx.save();
  ctx.translate(c.cam.ox, c.cam.oy);
  ctx.scale(c.cam.scale, c.cam.scale);
}

export function restoreCamera(ctx: CanvasRenderingContext2D): void {
  ctx.restore();
}