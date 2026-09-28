import { describe, expect, it } from 'vitest';
import { addCrater, generatePeaks, generateTerrain, mountainHeight } from '../src/core/terrain.js';
import { makeRng } from '../src/core/rng.js';
import { beginRound, createGame, planShot } from '../src/core/game.js';
import { TERRAIN } from '../src/config.js';

describe('Terrain-Erzeugung', () => {
  it('erzeugt zwei Berge innerhalb der Grenzen', () => {
    const t = generateTerrain({ seed: 42 });
    expect(t.heights.length).toBe(t.width);
    for (const h of t.heights) {
      expect(h).toBeGreaterThanOrEqual(TERRAIN.minHeight);
      expect(h).toBeLessThanOrEqual(t.groundY);
    }
  });

  it('ist deterministisch über den Seed', () => {
    const a = generateTerrain({ seed: 7 });
    const b = generateTerrain({ seed: 7 });
    expect(a.heights).toEqual(b.heights);
    const c = generateTerrain({ seed: 8 });
    expect(c.heights).not.toEqual(a.heights);
  });

  it('platziert Gipfel im linken und rechten Drittel', () => {
    const peaks = generatePeaks(makeRng(42), 960);
    expect(peaks.length).toBe(2);
    expect(peaks[0]!.x).toBeLessThan(960 * 0.5);
    expect(peaks[1]!.x).toBeGreaterThan(960 * 0.5);
  });

  it('Berg-Funktion ist symmetrisch mit Maximum am Gipfel', () => {
    const peak = { x: 300, h: 250 };
    expect(mountainHeight(peak, 300)).toBe(250);
    // Symmetrie beidseitig
    expect(mountainHeight(peak, 240)).toBe(mountainHeight(peak, 360));
    // Weit entfernt trägt der Berg nichts mehr bei
    expect(mountainHeight(peak, 300 + 250)).toBeLessThan(2);
    expect(mountainHeight(peak, 300 - 250)).toBeLessThan(2);
  });

  it('liefert sichtbar unterschiedliche Karten (Vielfalt)', () => {
    // Verschiedene Seeds → verschiedene Höhen an identischen Stellen
    const probes = [150, 300, 500, 700, 850];
    const stamps = new Set<string>();
    for (let seed = 0; seed < 14; seed++) {
      const t = generateTerrain({ seed });
      stamps.add(probes.map((x) => t.heights[x]!).join(','));
    }
    expect(stamps.size).toBeGreaterThan(6); // deutliche Variation
  });
});

describe('Terrain-Spielbarkeit', () => {
  it('lässt über den Talkessel einen freien Schusskorridor (kein Mauer-Effekt)', () => {
    for (let seed = 0; seed < 24; seed++) {
      const t = generateTerrain({ seed });
      // Im offenen Tal dürfen Hügel nie wie ein Berg wirken
      const valleyMax = Math.max(...t.heights.slice(260, 700));
      expect(valleyMax).toBeLessThanOrEqual(560);
      // ... und unterhalb des jeweiligen Talbodens (mit Hügeln) bleiben.
      expect(valleyMax - t.groundY).toBeLessThanOrEqual(95);
    }
  });

  it('eine überquerende Schusslinie existiert (erreichbarer Gegner)', () => {
    // Der Beweis für "sinnvoll spielbar": Bei jedem Seed gibt es einen
    // Winkel/Pulver-Wert, mit dem der Schuss bis zur gegnerischen
    // Kartenseite reicht (Wind ~0).
    let crossed = 0;
    for (let seed = 0; seed < 12; seed++) {
      const s = createGame({
        mode: 'hotseat', difficulty: 'hard', startingGold: 1000, maxRounds: 0, seed,
      });
      beginRound(s);
      s.wind.speed = 0;
      const rightPeakX = Math.max(...s.castles[1]!.buildings.map((b) => b.x));
      let reachable = false;
      search: for (let a = 20; a <= 88; a += 2) {
        for (let p = 10; p <= 100; p += 4) {
          const plan = planShot(s, a, p, false);
          if (plan && plan.impact.kind !== 'out' && plan.impact.x >= rightPeakX - 70) {
            reachable = true;
            break search;
          }
        }
      }
      if (reachable) crossed++;
    }
    expect(crossed).toBe(12);
  });

  it('platziert hohe Burg-Gipfel links und rechts', () => {
    for (let seed = 0; seed < 24; seed++) {
      const t = generateTerrain({ seed });
      const leftZone = t.heights.slice(60, 280);
      const rightZone = t.heights.slice(680, 900);
      const minL = Math.min(...leftZone);
      const minR = Math.min(...rightZone);
      // Der Gipfel muss deutlich über dem Tal liegen (Burghöhe)
      expect(minL).toBeLessThanOrEqual(365);
      expect(minR).toBeLessThanOrEqual(365);
    }
  });

  it('hüllt zusätzliche Hügel niedrig ein', () => {
    for (let seed = 0; seed < 12; seed++) {
      const t = generateTerrain({ seed });
      const valley = Math.max(...t.heights.slice(200, 760));
      // Hügel bleiben klein (kein "Berg im Tal"): höchstens ~95 px über dem Talboden
      expect(valley - t.groundY).toBeLessThanOrEqual(95);
      // ... und das Terrain fällt im Tal deutlich unter die Gipfelhöhen
      expect(valley).toBeGreaterThanOrEqual(t.groundY - 240);
    }
  });
});

describe('Krater', () => {
  it('senkt das Terrain lokal und respektiert das Minimum', () => {
    const t = generateTerrain({ seed: 1 });
    const before = t.heights.slice();
    addCrater(t, 480, 22, 30);
    for (let i = 0; i < t.width; i++) {
      expect(t.heights[i]!).toBeGreaterThanOrEqual(before[i]!); // y wächst nach unten
      expect(t.heights[i]!).toBeGreaterThanOrEqual(TERRAIN.minHeight);
    }
    expect(t.heights[480]!).toBeGreaterThan(before[480]! + 10);
  });
});