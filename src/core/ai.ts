/**
 * KI-Gegner (Einzelspieler-Modus).
 *
 * Schusssuche: Kandidaten [Winkel, Pulver] werden mit der ECHTEN Ballistik
 * simuliert und nach erwartetem Schaden bewertet. Schwierigkeitsgrade
 * begrenzen Suchraster und fügen Ziel-Fehler hinzu (auch Wind-Unsicherheit,
 * falls die eigene Windfahne zerstört ist).
 *
 * Management: Prioritätsliste mit Budget-Disziplin.
 */
import { AI_CFG, AI_TARGET_WEIGHT, CASTLE, PHYSICS, WIND_SIM } from '../config.js';
import { simulateShot, muzzleSpeedFor } from './ballistics.js';
import { cannonMuzzle, castleTargets, towerCount, damagedWalls } from './castle.js';
import { powderConsumed } from './economy.js';
import { windAccel } from './wind.js';
import type {
  BuildingTarget,
  CastleState,
  Difficulty,
  GameState,
  PlayerId,
} from '../types.js';

export interface AiDecision {
  action: 'fire' | 'manage';
  angle?: number;
  powder?: number;
  manageAction?: string;
}

export interface AiContext {
  state: GameState;
  enemy: CastleState;
  own: CastleState;
  /** Tatsächlicher Wind (falls Windfahne der KI intakt, sonst Schätzung). */
  aimWind: number;
  targets: BuildingTarget[];
  /** Geschätzte Beschleunigung (mit Fehler). */
  accel: number;
}

function weight(kind: string): number {
  return (AI_TARGET_WEIGHT as Record<string, number>)[kind] ?? 10;
}

/** Simuliert einen Kandidaten und bewertet den Treffer. */
function scoreCandidate(ctx: AiContext, angle: number, powder: number): number | null {
  const need = powderConsumed(powder);
  if (need > ctx.own.powder) return null;

  const speed = muzzleSpeedFor(powder);
  const start = cannonMuzzle(ctx.own, ctx.state.activePlayer === 0 ? 1 : -1);
  const facing: 1 | -1 = ctx.state.activePlayer === 0 ? 1 : -1;
  const traj = simulateShot({
    start,
    facing,
    angleDeg: angle,
    muzzleSpeed: speed,
    windAccel: ctx.accel,
    terrain: ctx.state.terrain,
    targets: ctx.targets,
  });
  const imp = traj.impact;
  if (imp.kind !== 'building') return 0;

  const owner = buildingOwner(ctx.state, imp.targetId!);
  if (!owner) return 0;
  const b = owner.buildings.find((x) => x.id === imp.targetId);
  if (!b) return 0;
  const dmg = Math.max(PHYSICS.minImpactDmg, Math.round(Math.hypot(imp.vx, imp.vy) / PHYSICS.impactDmgFactor));
  const factor = Math.min(1.5, dmg / b.hp);
  let score = weight(b.kind) * factor;
  if (owner.player !== ctx.state.activePlayer) {
    // Treffer auf Gegner
    return score + Math.hypot(imp.vx, imp.vy) / 4000;
  }
  // Eigene Gebäude meiden
  return -weight(b.kind) * 0.8;
}

function buildingOwner(state: GameState, id: number): CastleState | null {
  for (const c of state.castles) {
    for (const b of c.buildings) if (b.id === id) return c;
  }
  return null;
}

/** Wind-Schätzung inkl. Ziel-Fehler durch die Schwierigkeit. */
function aimWindFor(state: GameState, difficulty: Difficulty): number {
  const own = state.castles[state.activePlayer];
  const vaneOk = own.buildings.some((b) => b.kind === 'windvane' && b.active);
  if (vaneOk) return state.wind.speed;
  const err = AI_CFG[difficulty].windErr;
  const guess = state.wind.speed + state.rng.float(-err, err);
  return Math.max(-WIND_SIM.maxUnits, Math.min(WIND_SIM.maxUnits, guess));
}

/**
 * Wählt die nächste Aktion der KI. Muss deterministisch wirkend
 * auf state.rng zugreifen (Reproduzierbarkeit).
 */
export function aiDecide(state: GameState, difficulty: Difficulty): AiDecision {
  const own = state.castles[state.activePlayer]!;
  const enemy = state.castles[1 - state.activePlayer]!;

  // --- Management-Prioritäten (mit Budget-Disziplin) ---
  const cannonOk = own.buildings.some((b) => b.kind === 'cannon' && b.active);
  if (!cannonOk) {
    if (own.gold >= CASTLE.priceCannon + AI_CFG.manageReserve) {
      return { action: 'manage', manageAction: 'replaceCannon' };
    }
    // Ohne Kanone und ohne Geld: trotzdem feuerbereit sein? → aufgeben nicht; managen
    return { action: 'manage', manageAction: 'none' };
  }
  // Eine neu gebaute Kanone ist erst in der nächsten eigenen Runde
  // feuerbereit – dann keinen Schuss erzwingen (Chancengleichheit).
  const cannonReadyFlag = own.buildings.some(
    (b) => b.kind === 'cannon' && b.active && b.ready,
  );
  if (!cannonReadyFlag) {
    return { action: 'manage', manageAction: 'none' };
  }
  if (own.balls <= 5) return { action: 'manage', manageAction: 'buyBalls' };
  if (own.powder < 30) return { action: 'manage', manageAction: 'buyPowder' };
  if (damagedWalls(own).length > 0 && own.gold > 700) {
    return { action: 'manage', manageAction: 'repairWalls' };
  }
  if (towerCount(own) < CASTLE.maxTowers && own.gold > 1400) {
    return { action: 'manage', manageAction: 'buildTower' };
  }

  // Optionsweise `manageChance` – sonst feuern.
  if (state.rng.next() < AI_CFG.manageChance) {
    return { action: 'manage', manageAction: 'none' };
  }

  // --- Schusssuche ---
  const cfg = AI_CFG[difficulty];
  const targets = [...castleTargets(own), ...castleTargets(enemy)];
  const ctx: AiContext = {
    state,
    enemy,
    own,
    aimWind: aimWindFor(state, difficulty),
    targets,
    accel: 0,
  };
  ctx.accel = windAccel(ctx.aimWind);

  let best: { angle: number; powder: number; score: number } | null = null;
  for (let angle = 12; angle <= 88; angle += cfg.angleStep) {
    for (let powder = 10; powder <= 100; powder += cfg.powderStep) {
      const s = scoreCandidate(ctx, angle, powder);
      if (s === null) continue;
      if (best === null || s > best.score) {
        best = { angle, powder, score: s };
      }
    }
  }

  if (!best) return { action: 'fire', angle: 60, powder: 70 };

  // Zufälliger Ziel-Fehler nach Schwierigkeit.
  const angleErr = state.rng.float(-cfg.angleErr, cfg.angleErr);
  const powderErr = state.rng.float(-cfg.powderErr, cfg.powderErr);
  const angle = Math.max(5, Math.min(89, best.angle + angleErr));
  const powder = Math.max(5, Math.min(100, Math.round(best.powder + powderErr)));
  return { action: 'fire', angle, powder };
}