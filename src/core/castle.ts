/**
 * Burgmodell: Gebäude-Layouts auf dem Berg, Zustand (HP), Ziele für
 * die Ballistik. Deterministisch; die Optik kümmert sich um Sprites.
 */
import { CASTLE } from '../config.js';
import { heightAt } from './ballistics.js';
import type { Building, BuildingKind, BuildingTarget, CastleState, PlayerId, TerrainData } from '../types.js';

/** Größen der Gebäude (Bildschirm-Pixel). */
export const BUILDING_SIZE: Record<BuildingKind, { w: number; h: number }> = Object.freeze({
  throne: Object.freeze({ w: 46, h: 30 }),
  windvane: Object.freeze({ w: 10, h: 12 }),
  cannon: Object.freeze({ w: 20, h: 16 }),
  ballstore: Object.freeze({ w: 26, h: 15 }),
  powderstore: Object.freeze({ w: 26, h: 15 }),
  treasury: Object.freeze({ w: 26, h: 15 }),
  tower: Object.freeze({ w: 13, h: 30 }),
  wall: Object.freeze({ w: 22, h: 12 }),
});

/** X-Versätze der Gebäude relativ zum Gipfel (Spieler 0; Spieler 1 spiegelt). */
type Slot = { kind: BuildingKind; dx: number };

const FIXED_SLOTS: Slot[] = [
  { kind: 'throne', dx: 0 },
  { kind: 'ballstore', dx: 26 },
  { kind: 'powderstore', dx: -26 },
  { kind: 'treasury', dx: -52 },
  { kind: 'cannon', dx: 84 },
];

const WALL_SLOTS: Slot[] = [
  { kind: 'wall', dx: -78 },
  { kind: 'wall', dx: 30 },
  { kind: 'wall', dx: 58 },
];

const TOWER_SLOTS: Slot[] = CASTLE.towerSlots.map((dx) => ({ kind: 'tower' as BuildingKind, dx }));

const LAYOUT = Object.freeze({
  fixed: Object.freeze(FIXED_SLOTS),
  walls: Object.freeze(WALL_SLOTS),
  towers: Object.freeze(TOWER_SLOTS),
});

/** Start-Anzahl aktiver Fördertürme. */
const STARTING_TOWERS = 2;

let buildingIdCounter = 0;
function nextId(): number {
  return buildingIdCounter++;
}

function makeBuilding(
  kind: BuildingKind,
  x: number,
  baseY: number,
  active = true,
): Building {
  const { w, h } = BUILDING_SIZE[kind];
  const hp = CASTLE.hp[kind];
  return { id: nextId(), kind, x, baseY, w, h, hp, maxHp: hp, active, everActive: active, ready: active };
}

/**
 * Baut eine Burg auf den übergebenen Gipfel. `facing` = +1 (Spieler 0,
 * schießt nach rechts) oder -1 (Spieler 1, schießt nach links).
 */
export function buildCastle(
  player: PlayerId,
  peakX: number,
  facing: 1 | -1,
  terrain: TerrainData,
): CastleState {
  const buildings: Building[] = [];

  const place = (kind: BuildingKind, x: number, baseY: number, active = true): Building => {
    const b = makeBuilding(kind, x, baseY, active);
    buildings.push(b);
    return b;
  };

  // Festbauten
  let throne: Building | null = null;
  let cannon: Building | null = null;
  for (const s of LAYOUT.fixed) {
    const x = peakX + facing * s.dx;
    const baseY = heightAt(terrain, x) - 2;
    const b = place(s.kind, x, baseY);
    if (s.kind === 'throne') throne = b;
    if (s.kind === 'cannon') cannon = b;
  }

  // Windfahne auf dem Thronsaal-Dach
  if (throne) {
    const vaneX = throne.x;
    const vaneBase = throne.baseY - throne.h + 2;
    place('windvane', vaneX, vaneBase);
  }

  // Mauern
  for (const s of LAYOUT.walls) {
    const x = peakX + facing * s.dx;
    const baseY = heightAt(terrain, x) - 2;
    place(s.kind, x, baseY);
  }

  // Fördertürme (zunächst inaktiv; aktive = gebaute)
  for (const s of LAYOUT.towers) {
    const x = peakX + facing * s.dx;
    const baseY = heightAt(terrain, x) - 2;
    place(s.kind, x, baseY, false);
  }

  // Starttürme aktivieren (die dem Gipfel am nächsten liegenden Slots)
  const towerSlots = buildings.filter((b) => b.kind === 'tower');
  towerSlots.sort((a, b) => Math.abs(a.x - peakX) - Math.abs(b.x - peakX));
  for (let i = 0; i < Math.min(STARTING_TOWERS, towerSlots.length); i++) {
    towerSlots[i]!.active = true;
  }

  void cannon; // Referenz für die Mündung wird zur Laufzeit ermittelt
  return {
    player,
    name: player === 0 ? 'KÖNIG BLAU' : 'KÖNIG ROT',
    gold: 0, // wird vom Spiel gesetzt
    balls: 0,
    powder: 0,
    population: 0,
    taxRate: 0,
    buildings,
    lastIncome: 0,
    surrendered: false,
  };
}

/** Aktive Gebäude einer Burg als Kollisionsziele. */
export function castleTargets(c: CastleState): BuildingTarget[] {
  const out: BuildingTarget[] = [];
  for (const b of c.buildings) {
    if (!b.active) continue;
    out.push({
      id: b.id,
      x1: b.x - b.w / 2,
      y1: b.baseY - b.h,
      x2: b.x + b.w / 2,
      y2: b.baseY,
    });
  }
  return out;
}

export function cannonOf(c: CastleState): Building | null {
  return c.buildings.find((b) => b.kind === 'cannon' && b.active) ?? null;
}

export function cannonExists(c: CastleState): boolean {
  return c.buildings.some((b) => b.kind === 'cannon' && b.active);
}

/** Mündungsposition (Weltkoordinaten) für Spieler `facing`.
 * Liegt klar außerhalb des Kanonen-Rechtecks, damit der Schuss nicht
 * sofort das eigene Geschütz trifft. */
export function cannonMuzzle(c: CastleState, facing: 1 | -1): { x: number; y: number } {
  const cannon = c.buildings.find((b) => b.kind === 'cannon' && b.active);
  if (!cannon) return { x: 0, y: 0 };
  return { x: cannon.x + facing * (cannon.w / 2 + 8), y: cannon.baseY - 14 };
}

export function towerCount(c: CastleState): number {
  let n = 0;
  for (const b of c.buildings) if (b.kind === 'tower' && b.active) n++;
  return n;
}

export function activeTowers(c: CastleState): Building[] {
  return c.buildings.filter((b) => b.kind === 'tower' && b.active);
}

/** Nächster freier Turm-Slot (Anker-Bau), den man kaufen kann. */
export function nextTowerSlot(c: CastleState): Building | null {
  return c.buildings.find((b) => b.kind === 'tower' && !b.active) ?? null;
}

export function damagedWalls(c: CastleState): Building[] {
  return c.buildings.filter((b) => b.kind === 'wall' && b.active && b.hp < b.maxHp);
}

export function buildingById(c: CastleState, id: number): Building | null {
  for (const b of c.buildings) if (b.id === id) return b;
  return null;
}

export function findCastleWithBuilding(state: { castles: [CastleState, CastleState] }, id: number): CastleState | null {
  for (const c of state.castles) {
    if (buildingById(c, id)) return c;
  }
  return null;
}

export function windvaneActive(c: CastleState): boolean {
  return c.buildings.some((b) => b.kind === 'windvane' && b.active);
}