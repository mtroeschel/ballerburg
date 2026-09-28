/** Zentrale Spieltypen (framework-frei). */
import type { Rng } from './core/rng.js';

export type PlayerId = 0 | 1;
export type Difficulty = 'easy' | 'medium' | 'hard';
export type GameMode = 'ai' | 'hotseat';

export type BuildingKind =
  | 'throne'
  | 'cannon'
  | 'windvane'
  | 'ballstore'
  | 'powderstore'
  | 'treasury'
  | 'tower'
  | 'wall';

export interface Building {
  id: number;
  kind: BuildingKind;
  /** Anker-x (Mitte) in Weltkoordinaten. */
  x: number;
  /** Basis-y (Boden des Gebäudes) in Weltkoordinaten. */
  baseY: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  active: boolean;
  /** Wurde das Gebäude jemals errichtet? (Fundament vs. Trümmer) */
  everActive: boolean;
  /** Feuerbereit? (nur relevant für Kanonen: neue Kanone braucht einen Turn) */
  ready: boolean;
}

export interface CastleState {
  player: PlayerId;
  name: string;
  gold: number;
  balls: number;
  powder: number;
  population: number;
  taxRate: number;
  buildings: Building[];
  lastIncome: number;
  surrendered: boolean;
}

export interface WindState {
  /** Wind in Einheiten; negativ = von rechts nach links. */
  speed: number;
}

export interface TerrainData {
  /** Eine Höhe pro Spalte (y der Bodenlinie, Bildschirmkoordinaten). */
  heights: number[];
  width: number;
  groundY: number;
}

export interface GameConfig {
  mode: GameMode;
  difficulty: Difficulty;
  startingGold: number;
  /** 0 = kein Limit. */
  maxRounds: number;
  seed: number;
  /** Optik: weiß auf schwarz (Standard) oder Phosphor-Blau. */
  color?: 'white' | 'phosphor';
}

export type Phase =
  | 'setup'
  | 'turnStart'
  | 'aim'
  | 'flight'
  | 'resolution'
  | 'manage'
  | 'gameOver';

/** Ein Simulationsschritt der Kugel. */
export interface Step {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
}

export interface Impact {
  kind: 'terrain' | 'building' | 'out';
  targetId: number | null;
  time: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface RollStep {
  x: number;
  y: number;
  vx: number;
  t: number;
}

export interface RollHit {
  targetId: number;
  speed: number;
}

/** Komplett vorberechneter Schuss (Animation = Wiedergabe). */
export interface ShotPlan {
  shooter: PlayerId;
  angleDeg: number;
  powder: number;
  muzzleSpeed: number;
  windAccel: number;
  start: { x: number; y: number };
  flySteps: Step[];
  impact: Impact;
  rollSteps: RollStep[];
  rollHit: RollHit | null;
  /** Abgespielte Zeit während der Flug-Animation (s). */
  playT: number;
}

export interface Explosion {
  x: number;
  y: number;
  age: number;
  duration: number;
  big: boolean;
}

export type GameEvent =
  | { kind: 'fired' }
  | { kind: 'impact'; impact: Impact }
  | { kind: 'buildingHit'; player: PlayerId; buildingId: number; dmg: number; destroyed: boolean }
  | { kind: 'buildingDestroyed'; player: PlayerId; buildingKind: BuildingKind }
  | { kind: 'ballStoreHit'; player: PlayerId; lost: number }
  | { kind: 'treasuryHit'; player: PlayerId; lost: number }
  | { kind: 'powderExplosion'; player: PlayerId }
  | { kind: 'income'; player: PlayerId; amount: number }
  | { kind: 'windChange'; speed: number }
  | { kind: 'crater' }
  | { kind: 'victory'; winner: PlayerId; reason: string }
  | { kind: 'message'; text: string };

export interface GameState {
  config: GameConfig;
  rng: Rng;
  terrain: TerrainData;
  castles: [CastleState, CastleState];
  wind: WindState;
  activePlayer: PlayerId;
  round: number;
  phase: Phase;
  pendingShot: ShotPlan | null;
  explosions: Explosion[];
  events: GameEvent[];
  message: string;
  winner: PlayerId | null;
  victoryReason: string;
  /** Zeigt die Trajektorien-Vorschau an (optionaler Komfort). */
  preview: boolean;
  /** Deterministische Dekor-Randoms für die Optik. */
  decorSeed: number;
  /** Countdown, bis die KI ihre Entscheidung trifft (s). */
  aiThinkLeft: number;
}

export interface BuildingTarget {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Von der UI/Steuerung verwendete Schnittstelle zum Spiel. */
export interface Controller {
  readonly game: GameState;
  aim(angleDeg: number): void;
  setPowder(powder: number): void;
  fire(): void;
  openManage(): void;
  closeManage(): void;
  endManageTurn(): void;
  forfeit(): void;
  buyBalls(count: number): void;
  buyPowder(units: number): void;
  repairWalls(): void;
  replaceCannon(): void;
  buildTower(): void;
  setTax(tax: number): void;
  togglePreview(): void;
  startGame(config: GameConfig): void;
  backToMenu(): void;
  /** Spiele mit denselben Einstellungen erneut (Sieg/Niederlage-Screen). */
  rematch(): void;
  update(dt: number): void;
}