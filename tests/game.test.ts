import { describe, expect, it } from 'vitest';
import {
  applyBuildTower,
  applyBuyBalls,
  applyBuyPowder,
  applyReplaceCannon,
  applyRepairWalls,
  beginRound,
  closeManage,
  createGame,
  endManageTurn,
  fire,
  forfeit,
  openManage,
  planShot,
  setTax,
  update,
} from '../src/core/game.js';
import { CASTLE } from '../src/config.js';
import type { GameConfig, GameState } from '../src/types.js';

function cfg(overrides: Partial<GameConfig> = {}): GameConfig {
  return {
    mode: 'hotseat',
    difficulty: 'medium',
    startingGold: 1000,
    maxRounds: 0,
    seed: 1337,
    ...overrides,
  };
}

/** Ruft update auf, bis die Phase nicht mehr `from` ist (bzw. Abbruch). */
function updateUntil(state: GameState, from: string, maxFrames = 6000): void {
  let i = 0;
  while (state.phase === from && i < maxFrames) {
    update(state, 1 / 60);
    i++;
  }
}

describe('Spielablauf (Ablauf der Runden)', () => {
  it('startet mit Runde 1 und Phase aim', () => {
    const s = createGame(cfg());
    expect(s.phase).toBe('setup');
    beginRound(s);
    expect(s.round).toBe(1);
    expect(s.phase).toBe('aim');
    expect(s.castles[0]!.gold).toBeGreaterThan(1000); // Einkommen geflossen
  });

  it('Rundentausch nach abgeschlossenem Turn', () => {
    const s = createGame(cfg());
    beginRound(s);
    openManage(s);
    expect(s.phase).toBe('manage');
    endManageTurn(s);
    expect(s.phase).toBe('aim');
    expect(s.activePlayer).toBe(1);
    expect(s.round).toBe(2);
  });
});

describe('Feuern', () => {
  it('verbraucht Kugel + Pulver und startet den Flug', () => {
    const s = createGame(cfg());
    beginRound(s);
    const c0 = s.castles[0]!;
    const ballsBefore = c0.balls;
    const powderBefore = c0.powder;
    const ok = fire(s, 60, 50);
    expect(ok).toBe(true);
    expect(c0.balls).toBe(ballsBefore - 1);
    expect(c0.powder).toBeLessThan(powderBefore);
    expect(s.phase).toBe('flight');
    expect(s.pendingShot).not.toBeNull();
  });

  it('verweigert ohne Kugeln', () => {
    const s = createGame(cfg());
    beginRound(s);
    s.castles[0]!.balls = 0;
    expect(fire(s, 60, 50)).toBe(false);
    expect(s.phase).toBe('aim');
  });

  it('verweigert ohne Kanone', () => {
    const s = createGame(cfg());
    beginRound(s);
    const cannon = s.castles[0]!.buildings.find((b) => b.kind === 'cannon')!;
    cannon.active = false;
    expect(fire(s, 60, 50)).toBe(false);
  });

  it('löst den Einschlag und den Rundentausch aus', () => {
    const s = createGame(cfg());
    beginRound(s);
    fire(s, 60, 50);
    updateUntil(s, 'flight');
    // Nach Flug → resolution → Ende des Turns
    updateUntil(s, 'resolution');
    expect(s.phase).toBe('aim');
    expect(s.activePlayer).toBe(1);
  });
});

describe('Sieg durch Zerstörung des Thronsaals', () => {
  it('setzt den Gewinner, wenn der gegnerische Thronsaal zerstört wird', () => {
    const s = createGame(cfg());
    beginRound(s);
    const enemy = s.castles[1]!;
    const throne = enemy.buildings.find((b) => b.kind === 'throne')!;
    throne.hp = 1;

    // Künstlicher direkter Treffer auf den Thronsaal (Treffer-Auflösung pur).
    s.pendingShot = {
      shooter: 0,
      angleDeg: 45,
      powder: 50,
      muzzleSpeed: 800,
      windAccel: 0,
      start: { x: 100, y: 0 },
      flySteps: [{ x: 100, y: 0, vx: 0, vy: 0, t: 0 }],
      impact: { kind: 'building', targetId: throne.id, time: 0.01, x: throne.x, y: throne.baseY, vx: 500, vy: -100 },
      rollSteps: [],
      rollHit: null,
      playT: 999,
    };
    s.phase = 'flight';
    updateUntil(s, 'flight');
    updateUntil(s, 'resolution');

    expect(s.winner).toBe(0);
    expect(s.phase).toBe('gameOver');
  });

  it('Kapitulation beendet das Spiel mit dem Gegner als Sieger', () => {
    const s = createGame(cfg());
    beginRound(s);
    forfeit(s);
    expect(s.winner).toBe(1);
    expect(s.phase).toBe('gameOver');
    expect(s.castles[0]!.surrendered).toBe(true);
  });

  it('Sprengschaden: Naheinschlag zerstört den geschwächten Thronsaal', () => {
    const s = createGame(cfg());
    beginRound(s);
    const enemy = s.castles[1]!;
    const throne = enemy.buildings.find((b) => b.kind === 'throne')!;
    throne.hp = 1;

    // Künstlicher Terrain-Einschlag 9px unter dem Thronsaal-Kasten
    s.pendingShot = {
      shooter: 0,
      angleDeg: 60,
      powder: 60,
      muzzleSpeed: 700,
      windAccel: 0,
      start: { x: 200, y: 100 },
      flySteps: [{ x: 200, y: 100, vx: 0, vy: 0, t: 0 }],
      impact: { kind: 'terrain', targetId: null, time: 1, x: throne.x, y: throne.baseY + 9, vx: 600, vy: 300 },
      rollSteps: [],
      rollHit: null,
      playT: 999,
    };
    s.phase = 'flight';
    updateUntil(s, 'flight');
    updateUntil(s, 'resolution');

    expect(throne.active).toBe(false);
    expect(s.winner).toBe(0);
    expect(s.phase).toBe('gameOver');
  });
});

describe('Verwaltung', () => {
  it('Kugeln kaufen kostet Gold und erhöht den Bestand', () => {
    const s = createGame(cfg());
    beginRound(s);
    openManage(s);
    const c = s.castles[0]!;
    const gold = c.gold;
    expect(applyBuyBalls(s, 5)).toBe(true);
    expect(c.gold).toBe(gold - 20);
    expect(c.balls).toBe(CASTLE.startBalls + 5);
  });

  it('Kauf scheitert ohne genug Gold', () => {
    const s = createGame(cfg());
    beginRound(s);
    const c = s.castles[0]!;
    c.gold = 5;
    expect(applyBuyBalls(s, 5)).toBe(false);
    expect(c.balls).toBe(CASTLE.startBalls);
  });

  it('Kauf respektiert das Lager-Limit', () => {
    const s = createGame(cfg());
    beginRound(s);
    const c = s.castles[0]!;
    c.balls = CASTLE.maxBalls - 2;
    applyBuyBalls(s, 100);
    expect(c.balls).toBe(CASTLE.maxBalls);
  });

  it('Pulver nachkaufen', () => {
    const s = createGame(cfg());
    beginRound(s);
    openManage(s);
    const c = s.castles[0]!;
    c.powder = 20; // Lager teilweise leer, damit klar unter dem Limit
    const gold = c.gold;
    expect(applyBuyPowder(s, 25)).toBe(true);
    expect(c.powder).toBe(45);
    expect(c.gold).toBe(gold - powderCostOf(25));
  });

  it('Mauer-Reparatur heilt beschädigte Abschnitte', () => {
    const s = createGame(cfg());
    beginRound(s);
    const c = s.castles[0]!;
    const wall = c.buildings.find((b) => b.kind === 'wall')!;
    wall.hp = 1;
    const gold = c.gold;
    expect(applyRepairWalls(s)).toBe(true);
    expect(wall.hp).toBe(wall.maxHp);
    expect(c.gold).toBe(gold - CASTLE.priceWallRepair);
  });

  it('Kanonen-Ersatz reaktiviert die zerstörte Kanone', () => {
    const s = createGame(cfg());
    beginRound(s);
    const c = s.castles[0]!;
    const cannon = c.buildings.find((b) => b.kind === 'cannon')!;
    cannon.active = false;
    const gold = c.gold;
    expect(applyReplaceCannon(s)).toBe(true);
    expect(cannon.active).toBe(true);
    expect(cannon.ready).toBe(false); // erst nächste Runde feuerbereit
    expect(c.gold).toBe(gold - CASTLE.priceCannon);
  });

  it('Chancengleichheit: neue Kanone feuert erst ab der nächsten eigenen Runde', () => {
    const s = createGame(cfg());
    beginRound(s);
    const c = s.castles[0]!;
    const cannon = c.buildings.find((b) => b.kind === 'cannon')!;

    // Kanone verlieren → neu aufstellen → im selben Zug versuchen zu feuern
    cannon.active = false;
    cannon.ready = false;
    expect(applyReplaceCannon(s)).toBe(true);
    expect(fire(s, 60, 50)).toBe(false); // gleiche Runde: blockiert

    // Eigener Turn endet, Gegner-Turn endet → wieder Spieler 0 (neue Runde)
    openManage(s);
    endManageTurn(s);
    expect(s.activePlayer).toBe(1);
    openManage(s);
    endManageTurn(s);
    expect(s.activePlayer).toBe(0);
    expect(cannon.ready).toBe(true);
    expect(fire(s, 60, 50)).toBe(true); // jetzt feuerbereit
  });

  it('Kanone übersteht den ersten Treffer und wird erst durch den zweiten zerstört', () => {
    const s = createGame(cfg());
    beginRound(s);
    const enemy = s.castles[1]!;
    const cannon = enemy.buildings.find((b) => b.kind === 'cannon')!;
    const hp = cannon.hp;

    // Direkter Treffer (hohe Einschlagsgeschwindigkeit)
    const hit = (vx: number) => {
      s.pendingShot = {
        shooter: 0, angleDeg: 45, powder: 60, muzzleSpeed: 600, windAccel: 0,
        start: { x: 100, y: 0 },
        flySteps: [{ x: 100, y: 0, vx: 0, vy: 0, t: 0 }],
        impact: { kind: 'building', targetId: cannon.id, time: 0.01, x: cannon.x, y: cannon.baseY, vx, vy: -200 },
        rollSteps: [], rollHit: null, playT: 999,
      };
      s.phase = 'flight';
      updateUntil(s, 'flight');
      updateUntil(s, 'resolution');
    };
    hit(800); // ~820 px/s → 41 Schaden
    expect(cannon.active).toBe(true);
    expect(cannon.hp).toBeLessThan(hp);
    hit(800);
    expect(cannon.active).toBe(false);
  });

  it('Förderturm-Bau aktiviert einen Slot', () => {
    const s = createGame(cfg());
    beginRound(s);
    const c = s.castles[0]!;
    const gold = c.gold;
    const inactiveBefore = c.buildings.filter((b) => b.kind === 'tower' && !b.active).length;
    expect(applyBuildTower(s)).toBe(true);
    expect(c.gold).toBe(gold - CASTLE.priceTower);
    expect(c.buildings.filter((b) => b.kind === 'tower' && b.active).length).toBeGreaterThan(2);
    expect(inactiveBefore).toBeGreaterThan(1);
  });

  it('Steuersatz lässt sich einstellen (0..100 geklemmt)', () => {
    const s = createGame(cfg());
    beginRound(s);
    setTax(s, 55);
    expect(s.castles[0]!.taxRate).toBe(55);
    setTax(s, 500);
    expect(s.castles[0]!.taxRate).toBe(100);
  });
});

function powderCostOf(units: number): number {
  return Math.max(1, Math.ceil(units / CASTLE.powderPerGold));
}

describe('Planung (planShot)', () => {
  it('erzeugt einen plausiblen Schussplan mit Flugschritten und Einschlag', () => {
    const s = createGame(cfg());
    beginRound(s);
    // Winkel/Pulver so wählen, dass der Ball den Talkessel überquert
    const plan = planShot(s, 60, 60, true);
    expect(plan).not.toBeNull();
    expect(plan!.flySteps.length).toBeGreaterThan(30);
    expect(['terrain', 'building', 'out']).toContain(plan!.impact.kind);
  });

  it('kein Plan ohne aktive Kanone', () => {
    const s = createGame(cfg());
    beginRound(s);
    s.castles[0]!.buildings.find((b) => b.kind === 'cannon')!.active = false;
    expect(planShot(s, 60, 60, true)).toBeNull();
  });

  it('Spieler 2 (rechte Burg) schießt nach links zum Gegner', () => {
    const s = createGame(cfg());
    beginRound(s);
    s.wind.speed = 0; // Wind isolieren
    s.activePlayer = 1;
    const cannon = s.castles[1]!.buildings.find((b) => b.kind === 'cannon')!;
    expect(fire(s, 60, 60)).toBe(true);
    // Flug abspielen
    let i = 0;
    while (s.phase !== 'resolution' && i++ < 9000) update(s, 1 / 60);
    const plan = s.pendingShot;
    expect(plan).not.toBeNull();
    expect(plan!.impact.kind).not.toBe('out');
    // Links von der Mündung (Richtung des Gegners) gelandet
    expect(plan!.impact.x).toBeLessThan(cannon.x - 30);
  });
});

describe('Verwaltungs-UI-Transitions', () => {
  it('openManage/closeManage schalten nur aus der Zielphase um', () => {
    const s = createGame(cfg());
    beginRound(s);
    openManage(s);
    expect(s.phase).toBe('manage');
    closeManage(s);
    expect(s.phase).toBe('aim');
  });
});