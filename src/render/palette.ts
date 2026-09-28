/**
 * Monochrome Palette: "Weiß auf Schwarz" (Standard) oder
 * optional "Phosphor-Blau". Alle Render-Module lesen hier die Farben.
 */
export type PaletteName = 'white' | 'phosphor';

export interface Palette {
  fg: string;
  bg: string;
}

let pal: Palette = { fg: '#ffffff', bg: '#000000' };

export function setPalette(name: PaletteName): void {
  pal =
    name === 'phosphor'
      ? { fg: '#6fe8ff', bg: '#05121f' }
      : { fg: '#ffffff', bg: '#000000' };
}

export function fg(): string {
  return pal.fg;
}

export function bg(): string {
  return pal.bg;
}

/** Vordergrund mit Alpha (rgba). */
export function fgA(alpha: number): string {
  return withAlpha(pal.fg, alpha);
}

function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}