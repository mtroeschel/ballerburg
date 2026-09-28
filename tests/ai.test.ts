import { describe, expect, it } from 'vitest';
import { aiDecide } from '../src/core/ai.js';
import { beginRound, createGame, update, fire } from '../src/core/game.js';
import { AI_CFG } from '../src/config.js';
import type { GameConfig, GameState } from '../src/types.js';

function cfg(overrides: Partial<GameConfig> = {}): GameConfig {
  return {
    mode: 'ai',
    difficulty: 'hard',
    startingGold: 1000,
    maxRounds: 0,
    seed: 2024,
    ...overrides,
  };
}

function beginAiming(state: GameState): void {
  if (state.phase === 'setup') beginRound(state);
}

describe('KI-Entscheidungen (Struktur)', () => {
  it('liefert einen gültigen Feuerschuss (Winkel in [5,89], Pulver in [5,100])', () => {
    const s = createGame(cfg());
    beginAiming(s);
    for (const diff of ['easy', 'medium', 'hard'] as const) {
      const d = aiDecide(s, diff);
      expect(d.action).toBe('fire');
      expect(d.angle).toBeGreaterThanOrEqual(5);
      expect(d.angle).toBeLessThanOrEqual(89);
      expect(d.powder).toBeGreaterThanOrEqual(5);
      expect(d.powder).toBeLessThanOrEqual(100);
    }
  });

  it('managt, wenn die Kanone zerstört ist (und Geld reicht)', () => {
    const s = createGame(cfg());
    beginAiming(s);
    s.activePlayer = 1;
    const cannon = s.castles[1]!.buildings.find((b) => b.kind === 'cannon')!;
    cannon.active = false;
    s.castles[1]!.gold = 2000;
    const d = aiDecide(s, 'hard');
    expect(d.action).toBe('manage');
    expect(d.manageAction).toBe('replaceCannon');
  });

  it('managt bei leerem Kugellager', () => {
    const s = createGame(cfg());
    beginAiming(s);
    s.activePlayer = 1;
    s.castles[1]!.balls = 0;
    const d = aiDecide(s, 'hard');
    expect(d.action).toBe('manage');
    expect(d.manageAction).toBe('buyBalls');
  });

  it('Budget-Disziplin: ohne Gold wird trotzdem gemanagt statt irgendein Schuss', () => {
    const s = createGame(cfg());
    beginAiming(s);
    s.activePlayer = 1;
    s.castles[1]!.gold = 0;
    s.castles[1]!.balls = 2;
    s.castles[1]!.powder = 5;
    const d = aiDecide(s, 'hard');
    // Ballbestand niedrig → manage (Versorgung), niemals Feuer aus der Not heraus
    expect(d.action).toBe('manage');
  });
});

describe('KI-Feuern auf Standard-Terrain', () => {
  /** aiDecide wirft mit `manageChance` zufällig ein Management ein;
   *  wir wiederholen bis zu 20×, bis die KI feuert (deterministisch). */
  function decideFire(s: GameState, diff: 'easy' | 'medium' | 'hard') {
    for (let i = 0; i < 20; i++) {
      const d = aiDecide(s, diff);
      if (d.action === 'fire') return d;
    }
    return aiDecide(s, diff);
  }

  it('zielt über den Talkessel auf die gegnerische Bergseite', () => {
    // KI (hart, kaum Ziel-Fehler) soll mit echten Wetterdaten
    // zumindest auf die rechte (gegnerische) Kartenhälfte treffen.
    let hitRight = 0;
    for (let seed = 0; seed < 5; seed++) {
      const s = createGame(cfg({ seed }));
      beginAiming(s);
      const d = decideFire(s, 'hard');
      expect(d.action).toBe('fire');
      fire(s, d.angle!, d.powder!);
      // Flug vollständig abspielen
      let i = 0;
      while (s.phase === 'flight' && i++ < 9000) update(s, 1 / 60);
      const plan = s.pendingShot;
      if (plan && plan.impact.kind === 'terrain' && plan.impact.x > 480) hitRight++;
      if (plan && plan.impact.kind === 'building') hitRight++;
      // Aufräumen für nächsten Seed
      while (s.phase !== 'aim' && s.phase !== 'gameOver' && i < 2000) update(s, 1 / 60);
    }
    expect(hitRight).toBeGreaterThanOrEqual(3);
  });
});

describe('KI-Konfiguration', () => {
  it('Schwierigkeitsgrade haben absteigende Fehler-Toleranzen', () => {
    expect(AI_CFG.easy.angleErr).toBeGreaterThan(AI_CFG.medium.angleErr);
    expect(AI_CFG.medium.angleErr).toBeGreaterThan(AI_CFG.hard.angleErr);
  });
});