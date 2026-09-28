/**
 * Spiel-Orchestrierung: Runden, Feuern, Einschlags-Auflösung,
 * Verwaltung, Sieg/Niederlage. Reines, deterministisches Modul.
 */
import { CASTLE, CRATER, ECONOMY, PHYSICS } from '../config.js';
import { simulateRoll, simulateShot, muzzleSpeedFor } from './ballistics.js';
import {
  buildCastle,
  buildingById,
  cannonExists,
  cannonMuzzle,
  cannonOf,
  castleTargets,
  damagedWalls,
  findCastleWithBuilding,
  nextTowerSlot,
  towerCount,
  windvaneActive,
} from './castle.js';
import {
  ballCost,
  driftPopulation,
  powderConsumed,
  powderCost,
  taxIncome,
  towerIncome,
} from './economy.js';
import { generatePeaks, generateTerrain, addCrater } from './terrain.js';
import { initialWind, nextWind, windAccel } from './wind.js';
import { makeRng } from './rng.js';
import { aiDecide, type AiDecision } from './ai.js';
import type {
  Building,
  CastleState,
  GameConfig,
  GameEvent,
  GameState,
  PlayerId,
  RollHit,
  RollStep,
  ShotPlan,
  Step,
} from '../types.js';

const OTHER: Record<PlayerId, PlayerId> = { 0: 1, 1: 0 };

function push(state: GameState, ev: GameEvent): void {
  state.events.push(ev);
  if (state.events.length > 200) state.events.splice(0, state.events.length - 200);
}

function message(state: GameState, text: string): void {
  state.message = text;
  push(state, { kind: 'message', text });
}

function addExplosion(state: GameState, x: number, y: number, duration: number, big: boolean): void {
  state.explosions.push({ x, y, age: 0, duration, big });
}

/* ------------------------------ Spielerzeugung ------------------------------ */

export function createGame(config: GameConfig): GameState {
  const rng = makeRng(config.seed);
  const terrain = generateTerrain({ seed: config.seed });
  const peaks = generatePeaks(makeRng(config.seed), terrain.width);
  peaks.sort((a, b) => a.x - b.x);

  const c0 = createCastleState(0, config);
  const c1 = createCastleState(1, config);
  c0.buildings = buildCastle(0, peaks[0]!.x, 1, terrain).buildings;
  c1.buildings = buildCastle(1, peaks[1]!.x, -1, terrain).buildings;

  return {
    config,
    rng,
    terrain,
    castles: [c0, c1],
    wind: { speed: initialWind(rng) },
    activePlayer: 0,
    round: 0,
    phase: 'setup',
    pendingShot: null,
    explosions: [],
    events: [],
    message: '',
    winner: null,
    victoryReason: '',
    preview: true,
    decorSeed: rng.int(1_000_000),
    aiThinkLeft: 0,
  };
}

function createCastleState(player: PlayerId, config: GameConfig): CastleState {
  return {
    player,
    name: player === 0 ? 'KÖNIG AZUR' : 'KÖNIG RUBIN',
    gold: config.startingGold,
    balls: CASTLE.startBalls,
    powder: CASTLE.startPowder,
    population: ECONOMY.startPopulation,
    taxRate: ECONOMY.startTax,
    buildings: [],
    lastIncome: 0,
    surrendered: false,
  };
}

/** Frischt den Spielzustand mit neuen Einstellungen auf. */
export function resetGame(state: GameState, config: GameConfig): void {
  const fresh = createGame(config);
  state.config = fresh.config;
  state.rng = fresh.rng;
  state.terrain = fresh.terrain;
  state.castles = fresh.castles;
  state.wind = fresh.wind;
  state.activePlayer = 0;
  state.round = 0;
  state.phase = 'setup';
  state.pendingShot = null;
  state.explosions = [];
  state.events = [];
  state.message = '';
  state.winner = null;
  state.victoryReason = '';
  state.preview = fresh.preview;
  state.decorSeed = fresh.decorSeed;
  state.aiThinkLeft = 0;
}

/** Startet die erste Runde (Setup → Spiel). */
export function startGame(state: GameState): void {
  state.phase = 'turnStart';
  beginRound(state);
}

/* ------------------------------ Rundenablauf ------------------------------ */

export function beginRound(state: GameState): void {
  if (state.winner !== null) return;
  state.round += 1;
  state.wind.speed = nextWind(state.rng, state.wind.speed);
  push(state, { kind: 'windChange', speed: state.wind.speed });

  const c = state.castles[state.activePlayer];
  const taxes = taxIncome(c.population, c.taxRate);
  const towers = towerIncome(c);
  c.lastIncome = taxes + towers;
  c.gold += c.lastIncome;
  c.population = driftPopulation(c.population, c.taxRate);
  push(state, { kind: 'income', player: c.player, amount: c.lastIncome });

  state.phase = 'aim';
  if (state.config.mode === 'ai' && state.activePlayer === 1) {
    state.aiThinkLeft = 0.8 + (state.round % 5) * 0.1;
  }
  // Eine in der Vorrunde neu gebaute Kanone wird zu Beginn der nächsten
  // eigenen Runde feuerbereit (gleiche Regel für Mensch und KI).
  for (const b of c.buildings) {
    if (b.kind === 'cannon' && b.active) b.ready = true;
  }
  message(state, `RUNDE ${state.round} – ${c.name} IST AM ZUG (EINKOMMEN +${c.lastIncome} GOLD)`);

  if (!cannonExists(c)) {
    message(state, `RUNDE ${state.round} – ${c.name}: KANONE ZERSTÖRT! VERWALTUNG ÖFFNEN (M).`);
  }
}

/* ------------------------------ Feuern ------------------------------ */

export function planShot(state: GameState, angleDeg: number, powder: number, collect = true): ShotPlan | null {
  const player = state.activePlayer;
  const c = state.castles[player];
  const cannon = cannonOf(c);
  if (!cannon) return null;
  const facing: 1 | -1 = player === 0 ? 1 : -1;
  const muzzle = cannonMuzzle(c, facing);
  const speed = muzzleSpeedFor(powder);
  const accel = windAccel(state.wind.speed);
  const targets = [...castleTargets(c), ...castleTargets(state.castles[OTHER[player]])];

  const traj = simulateShot({
    start: muzzle,
    facing,
    angleDeg,
    muzzleSpeed: speed,
    windAccel: accel,
    terrain: state.terrain,
    targets,
    collect,
  });

  let rollSteps: RollStep[] = [];
  let rollHit: RollHit | null = null;
  if (traj.impact.kind === 'terrain') {
    const rollVx = Math.max(-PHYSICS.maxRollSpeed, Math.min(PHYSICS.maxRollSpeed, traj.impact.vx));
    const roll = simulateRoll({
      start: { x: traj.impact.x, y: traj.impact.y },
      vx: rollVx,
      terrain: state.terrain,
      targets,
    });
    rollSteps = roll.steps;
    rollHit = roll.hit;
  }

  return {
    shooter: player,
    angleDeg,
    powder,
    muzzleSpeed: speed,
    windAccel: accel,
    start: muzzle,
    flySteps: traj.steps,
    impact: traj.impact,
    rollSteps,
    rollHit,
    playT: 0,
  };
}

function impactSpeed(imp: { vx: number; vy: number }): number {
  return Math.hypot(imp.vx, imp.vy);
}

export function fire(state: GameState, angleDeg: number, powder: number): boolean {
  if (state.phase !== 'aim') return false;
  if (powder < CASTLE.minPowderForShot) {
    message(state, `PULVERMENGE ZU GERING (MIN ${CASTLE.minPowderForShot}) – ERHÖHE DIE PULVERMENGE.`);
    return false;
  }
  const c = state.castles[state.activePlayer];
  if (!cannonExists(c)) {
    message(state, 'KEINE KANONE – REKONSTRUIERE SIE ÜBER DIE VERWALTUNG (M).');
    return false;
  }
  if (!cannonReady(state)) {
    message(state, 'DIE NEUE KANONE IST NOCH NICHT FEUERBEREIT (ab nächster Runde).');
    return false;
  }
  if (c.balls < 1) {
    message(state, 'KEINE KUGELN MEHR – KAUFE NACH (M / VERWALTUNG).');
    return false;
  }
  const need = powderConsumed(powder);
  if (c.powder < need) {
    message(state, `NICHT GENUG PULVER IM LAGER (${need} EINHEITEN NÖTIG).`);
    return false;
  }
  c.balls -= 1;
  c.powder -= need;
  const plan = planShot(state, angleDeg, powder, true);
  if (!plan) return false;
  state.pendingShot = plan;
  state.phase = 'flight';
  push(state, { kind: 'fired' });
  message(state, 'FEUER!');
  return true;
}

/* ------------------------------ Kugel-Animation ------------------------------ */

/** Aktuelle Kugelposition zur Zeit t (Interpolation), oder null. */
export function ballPositionAt(plan: ShotPlan, t: number): { x: number; y: number } | null {
  const total = plan.impact.time + rollDuration(plan);
  if (t > total) return null;
  const dt = PHYSICS.simDt;
  if (t <= plan.impact.time) {
    if (plan.flySteps.length === 0) return { x: plan.start.x, y: plan.start.y };
    return interp(plan.flySteps, t / dt);
  }
  // Rollphase
  if (plan.rollSteps.length === 0) return { x: plan.impact.x, y: plan.impact.y };
  const ri = (t - plan.impact.time) / dt;
  const rs = plan.rollSteps;
  const j = Math.min(rs.length - 1, ri);
  const a = rs[Math.floor(j)]!;
  const b = rs[Math.min(Math.floor(j) + 1, rs.length - 1)]!;
  const f = j - Math.floor(j);
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

function interp(steps: readonly Step[], i: number): { x: number; y: number } {
  if (steps.length === 1) return { x: steps[0]!.x, y: steps[0]!.y };
  const i0 = Math.max(0, Math.min(steps.length - 2, Math.floor(i)));
  const f = Math.max(0, Math.min(1, i - i0));
  const a = steps[i0]!;
  const b = steps[i0 + 1]!;
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

export function rollDuration(plan: ShotPlan): number {
  return plan.rollSteps.length > 0 ? (plan.rollSteps.length - 1) * PHYSICS.simDt : 0;
}

function advanceFlight(state: GameState, dt: number): void {
  const plan = state.pendingShot;
  if (!plan) {
    state.phase = 'resolution';
    return;
  }
  plan.playT += dt;
  if (plan.playT >= plan.impact.time + rollDuration(plan)) {
    resolveImpact(state, plan);
  }
}

/* ------------------------------ Einschlags-Auflösung ------------------------------ */

function resolveImpact(state: GameState, plan: ShotPlan): void {
  const imp = plan.impact;
  push(state, { kind: 'impact', impact: imp });

  if (imp.kind === 'terrain') {
    const speed = impactSpeed(imp);
    const depth = CRATER.depth * Math.max(0.45, Math.min(1.4, speed / 700));
    addCrater(state.terrain, imp.x, depth, CRATER.radius);
    push(state, { kind: 'crater' });
    addExplosion(state, imp.x, imp.y, 1.0, false);
  } else {
    addExplosion(state, imp.x, imp.y, 1.15, true);
  }

  const hitList: Array<{ targetId: number; speed: number }> = [];
  let primaryBuildingId: number | null = null;
  if (imp.kind === 'building' && imp.targetId !== null) {
    hitList.push({ targetId: imp.targetId, speed: impactSpeed(imp) });
    primaryBuildingId = imp.targetId;
  }
  if (plan.rollHit) hitList.push(plan.rollHit);

  for (const h of hitList) {
    const castle = findCastleWithBuilding(state, h.targetId);
    if (!castle) continue;
    const b = buildingById(castle, h.targetId);
    if (b) damageBuilding(state, castle, b, Math.max(h.speed, 60));
  }

  // Sprengschaden: Einschläge in der Nähe von Gebäuden richten
  // abgeschwächten Schaden an (so lässt sich ein Schloss "einschießen").
  if (imp.kind !== 'out') {
    const speed = impactSpeed(imp);
    const r = PHYSICS.splashRadius;
    for (const castle of state.castles) {
      for (const b of castle.buildings) {
        if (!b.active) continue;
        if (primaryBuildingId !== null && b.id === primaryBuildingId) continue;
        const dist = distPointRect(imp.x, imp.y, {
          x1: b.x - b.w / 2,
          y1: b.baseY - b.h,
          x2: b.x + b.w / 2,
          y2: b.baseY,
        });
        if (dist > r + PHYSICS.ballRadius) continue;
        const falloff = Math.max(0, 1 - dist / r);
        damageBuilding(state, castle, b, speed, PHYSICS.splashFactor * falloff);
      }
    }
  }

  state.phase = 'resolution';
}

/** Abstand eines Punktes zu einem Rechteck (0 = innerhalb). */
function distPointRect(px: number, py: number, rc: { x1: number; y1: number; x2: number; y2: number }): number {
  const dx = Math.max(rc.x1 - px, 0, px - rc.x2);
  const dy = Math.max(rc.y1 - py, 0, py - rc.y2);
  return Math.hypot(dx, dy);
}

function damageBuilding(
  state: GameState,
  castle: CastleState,
  b: Building,
  speed: number,
  factor = 1,
): void {
  const raw = Math.max(PHYSICS.minImpactDmg, Math.round(speed / PHYSICS.impactDmgFactor));
  let dmg = Math.max(1, Math.round(raw * factor));
  if (b.kind === 'wall') dmg = Math.max(1, Math.round(dmg * CASTLE.wallDmgFactor));
  b.hp -= dmg;
  push(state, { kind: 'buildingHit', player: castle.player, buildingId: b.id, dmg, destroyed: b.hp <= 0 });
  if (b.hp <= 0 && b.active) {
    destroyBuilding(state, castle, b);
  }
}

function destroyBuilding(state: GameState, castle: CastleState, b: Building): void {
  b.active = false;
  push(state, { kind: 'buildingDestroyed', player: castle.player, buildingKind: b.kind });

  switch (b.kind) {
    case 'throne': {
      state.winner = OTHER[castle.player];
      state.victoryReason = 'THRONSAAL ZERSTÖRT';
      push(state, { kind: 'victory', winner: state.winner, reason: state.victoryReason });
      break;
    }
    case 'cannon':
      message(state, `${castle.name}: KANONE ZERSTÖRT – MUSS REKONSTRUIERT WERDEN.`);
      break;
    case 'windvane':
      message(state, `${castle.name}: WINDFAHNE ZERSTÖRT – WIND NICHT MEHR SICHTBAR.`);
      break;
    case 'ballstore': {
      const lost = Math.floor(castle.balls * 0.5);
      castle.balls -= lost;
      push(state, { kind: 'ballStoreHit', player: castle.player, lost });
      message(state, `${castle.name}: KUGELLAGER GETROFFEN (−${lost} KUGELN).`);
      break;
    }
    case 'powderstore': {
      castle.powder = 0;
      push(state, { kind: 'powderExplosion', player: castle.player });
      addExplosion(state, b.x, b.baseY - b.h / 2, 1.3, true);
      message(state, `${castle.name}: PULVERLAGER EXPLODIERT – GESAMTES PULVER VERLOREN.`);
      break;
    }
    case 'treasury': {
      const lost = Math.round(castle.gold * 0.25);
      castle.gold -= lost;
      push(state, { kind: 'treasuryHit', player: castle.player, lost });
      message(state, `${castle.name}: SCHATZKAMMER GELEERT (−${lost} GOLD).`);
      break;
    }
    case 'tower':
      message(state, `${castle.name}: FÖRDERTURM ZERSTÖRT.`);
      break;
    case 'wall':
      message(state, `${castle.name}: MAUERABSCHNITT ZERSTÖRT.`);
      break;
  }
}

/* ------------------------------ Rundentausch ------------------------------ */

function endTurn(state: GameState): void {
  state.pendingShot = null;
  const draw = state.config.maxRounds > 0 && state.round >= state.config.maxRounds && state.winner === null;
  if (state.winner === null && !draw) {
    state.activePlayer = OTHER[state.activePlayer];
  }
  if (draw) {
    state.phase = 'gameOver';
    state.victoryReason = 'RUNDEN-LIMIT ERREICHT – UNENTSCHIEDEN';
    message(state, state.victoryReason);
  } else if (state.winner !== null) {
    state.phase = 'gameOver';
    const w = state.castles[state.winner];
    message(state, `${w.name} SIEGT (${state.victoryReason})!`);
  } else {
    state.phase = 'turnStart';
    beginRound(state);
  }
}

/** Haupt-Update: Animation + KI-Scheduling. */
export function update(state: GameState, dt: number): void {
  for (let i = state.explosions.length - 1; i >= 0; i--) {
    state.explosions[i]!.age += dt;
    if (state.explosions[i]!.age >= state.explosions[i]!.duration) {
      state.explosions.splice(i, 1);
    }
  }

  switch (state.phase) {
    case 'flight':
      advanceFlight(state, dt);
      break;
    case 'resolution':
      if (state.explosions.length === 0) endTurn(state);
      break;
    case 'aim':
      if (state.config.mode === 'ai' && state.activePlayer === 1) {
        state.aiThinkLeft -= dt;
        if (state.aiThinkLeft <= 0) performAiTurn(state);
      }
      break;
    default:
      break;
  }
}

function performAiTurn(state: GameState): void {
  const decision = aiDecide(state, state.config.difficulty);
  if (decision.action === 'manage') {
    applyAiDecision(state, decision);
    endTurn(state);
  } else if (decision.action === 'fire') {
    // Sicherheitsnetz: Falls ein Schuss aus Ressourcengründen scheitert,
    // nicht in der Zielphase hängen bleiben.
    if (!fire(state, decision.angle!, decision.powder!)) {
      endTurn(state);
    }
  }
}

function applyAiDecision(state: GameState, d: AiDecision): void {
  const c = state.castles[state.activePlayer];
  switch (d.manageAction) {
    case 'replaceCannon':
      applyReplaceCannon(state);
      break;
    case 'buyBalls':
      applyBuyBalls(state, Math.min(20, CASTLE.maxBalls - c.balls));
      break;
    case 'buyPowder':
      applyBuyPowder(state, Math.min(60, CASTLE.maxPowder - c.powder));
      break;
    case 'repairWalls':
      applyRepairWalls(state);
      break;
    case 'buildTower':
      applyBuildTower(state);
      break;
    case 'none':
    case undefined:
      break;
  }
}

/* ------------------------------ Verwaltung ------------------------------ */

export function openManage(state: GameState): void {
  if (state.phase === 'aim') state.phase = 'manage';
}

export function closeManage(state: GameState): void {
  if (state.phase === 'manage') state.phase = 'aim';
}

export function endManageTurn(state: GameState): void {
  if (state.phase !== 'manage') return;
  state.phase = 'turnStart';
  endTurn(state);
}

export function setTax(state: GameState, tax: number): void {
  const c = state.castles[state.activePlayer];
  c.taxRate = Math.max(0, Math.min(100, Math.round(tax)));
  message(state, `${c.name}: STEUERSATZ = ${c.taxRate}%.`);
}

export function applyBuyBalls(state: GameState, count: number): boolean {
  const c = state.castles[state.activePlayer];
  const n = Math.max(0, Math.min(Math.floor(count), CASTLE.maxBalls - c.balls));
  if (n <= 0) return false;
  const cost = ballCost(n);
  if (c.gold < cost) {
    message(state, 'NICHT GENUG GOLD FÜR KUGELN.');
    return false;
  }
  c.gold -= cost;
  c.balls += n;
  message(state, `${c.name}: ${n} KUGELN GEKAUFT (−${cost} GOLD).`);
  return true;
}

export function applyBuyPowder(state: GameState, units: number): boolean {
  const c = state.castles[state.activePlayer];
  const n = Math.max(0, Math.min(Math.floor(units), CASTLE.maxPowder - c.powder));
  if (n <= 0) return false;
  const cost = powderCost(n);
  if (c.gold < cost) {
    message(state, 'NICHT GENUG GOLD FÜR PULVER.');
    return false;
  }
  c.gold -= cost;
  c.powder += n;
  message(state, `${c.name}: ${n} EINHEITEN PULVER GEKAUFT (−${cost} GOLD).`);
  return true;
}

export function applyRepairWalls(state: GameState): boolean {
  const c = state.castles[state.activePlayer];
  const walls = damagedWalls(c);
  if (walls.length === 0) {
    message(state, 'ALLE MAUERABSCHNITTE SIND UNVERSEHRT.');
    return false;
  }
  const cost = walls.length * CASTLE.priceWallRepair;
  if (c.gold < cost) {
    message(state, `NICHT GENUG GOLD FÜR DIE MAUERREPARATUR (${cost} GOLD).`);
    return false;
  }
  c.gold -= cost;
  for (const w of walls) {
    w.hp = w.maxHp;
  }
  message(state, `${walls.length} MAUERABSCHNITT(E) REPARIERT (−${cost} GOLD).`);
  return true;
}

export function applyReplaceCannon(state: GameState): boolean {
  const c = state.castles[state.activePlayer];
  if (cannonExists(c)) {
    message(state, 'DIE KANONE IST BEREITS INTAKT.');
    return false;
  }
  if (c.gold < CASTLE.priceCannon) {
    message(state, `NICHT GENUG GOLD FÜR EINE NEUE KANONE (${CASTLE.priceCannon} GOLD).`);
    return false;
  }
  c.gold -= CASTLE.priceCannon;
  const slot = c.buildings.find((b) => b.kind === 'cannon');
  if (slot) {
    slot.active = true;
    slot.everActive = true;
    slot.ready = false; // erst ab der nächsten eigenen Runde feuerbereit
    slot.hp = slot.maxHp;
  }
  message(state, `${c.name}: NEUE KANONE AUFGESTELLT (−${CASTLE.priceCannon} GOLD) – FEUERBEREIT AB NÄCHSTER RUNDE.`);
  return true;
}

export function applyBuildTower(state: GameState): boolean {
  const c = state.castles[state.activePlayer];
  if (towerCount(c) >= CASTLE.maxTowers) {
    message(state, 'MAXIMALE ANZAHL FÖRDERTÜRME ERREICHT (5).');
    return false;
  }
  const slot = nextTowerSlot(c);
  if (!slot) {
    message(state, 'KEIN BAUPLATZ MEHR FÜR TÜRME.');
    return false;
  }
  if (c.gold < CASTLE.priceTower) {
    message(state, `NICHT GENUG GOLD FÜR EINEN FÖRDERTURM (${CASTLE.priceTower} GOLD).`);
    return false;
  }
  c.gold -= CASTLE.priceTower;
  slot.active = true;
  slot.everActive = true;
  slot.ready = true;
  slot.hp = slot.maxHp;
  message(state, `${c.name}: FÖRDERTURM GEBAUT (−${CASTLE.priceTower} GOLD).`);
  return true;
}

export function forfeit(state: GameState): void {
  if (state.phase !== 'aim' && state.phase !== 'manage') return;
  const c = state.castles[state.activePlayer];
  c.surrendered = true;
  state.winner = OTHER[c.player];
  state.victoryReason = 'KAPITULATION';
  state.phase = 'gameOver';
  push(state, { kind: 'victory', winner: state.winner, reason: state.victoryReason });
  message(state, `${c.name} KAPITULIERT – ${state.castles[state.winner].name} SIEGT!`);
}

/** Kann der aktive Spieler den Wind sehen (Windfahne intakt)? */
export function canSeeWind(state: GameState): boolean {
  return windvaneActive(state.castles[state.activePlayer]);
}

/** Hat der aktive Spieler eine aktive Kanone? */
export function hasCannon(state: GameState): boolean {
  return cannonExists(state.castles[state.activePlayer]);
}

/** Kann der aktive Spieler mit seiner Kanone feuern (aktiv UND feuerbereit)? */
export function cannonReady(state: GameState): boolean {
  return state.castles[state.activePlayer]!.buildings.some(
    (b) => b.kind === 'cannon' && b.active && b.ready,
  );
}

export function isAiTurn(state: GameState): boolean {
  return state.config.mode === 'ai' && state.activePlayer === 1;
}

/** Anzahl aktiver Fördertürme (für Anzeigen). */
export function countTowers(state: GameState): number {
  return towerCount(state.castles[state.activePlayer]);
}