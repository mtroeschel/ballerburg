/**
 * Deterministischer Pseudozufallsgenerator (mulberry32).
 * Ermoeglicht reproduzierbare Spiele/Testfälle ueber einen Seed.
 */
export interface Rng {
  /** Zufallszahl in [0,1) */
  next(): number;
  /** Ganzzahl in [0,n) */
  int(n: number): number;
  /** Ganzzahl in [a,b] (inklusive) */
  range(a: number, b: number): number;
  /** Zahl in [a,b) */
  float(a: number, b: number): number;
  /** Zufälliges Element */
  pick<T>(items: readonly T[]): T;
}

export function makeRng(seed: number): Rng {
  let s = seed & 0xffffffff;
  if (s === 0) s = 0x9e3779b9;

  const impl: Rng = {
    next(): number {
      s += 0x6d2b79f5;
      let z = s;
      z = (z ^ (z >>> 15)) * (z | 1);
      z ^= z + (z ^ (z >>> 7)) * (z | 61);
      return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
    },
    int(n: number): number {
      return Math.floor(impl.next() * n);
    },
    range(a: number, b: number): number {
      return a + impl.int(b - a + 1);
    },
    float(a: number, b: number): number {
      return a + impl.next() * (b - a);
    },
    pick<T>(items: readonly T[]): T {
      return items[impl.int(items.length)] as T;
    },
  };
  return impl;
}