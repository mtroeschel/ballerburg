/**
 * Ballerburg – Einstieg: Game-Loop (fixed timestep), Bootstrapping.
 */
import { WORLD } from './config.js';
import { createSound } from './audio/sound.js';
import { setPalette } from './render/palette.js';
import {
  applyBuildTower,
  applyBuyBalls,
  applyBuyPowder,
  applyReplaceCannon,
  applyRepairWalls,
  cannonReady,
  closeManage,
  createGame,
  endManageTurn,
  fire,
  forfeit,
  hasCannon,
  isAiTurn,
  openManage,
  planShot,
  resetGame,
  setTax,
  startGame,
  update as gameUpdate,
} from './core/game.js';
import { setupCanvas, applyCamera, restoreCamera } from './render/canvas.js';
import { renderCastles } from './render/castle.js';
import { renderExplosions, renderProjectile, renderTrajectoryPreview } from './render/projectile.js';
import { renderSky, renderTerrain } from './render/world.js';
import { buildHud } from './ui/hud.js';
import { attachInput, type AimUi } from './ui/input.js';
import { buildMenus } from './ui/menu.js';
import type { Controller, GameConfig, GameState } from './types.js';

function defaultConfig(): GameConfig {
  return {
    mode: 'ai',
    difficulty: 'medium',
    startingGold: 1000,
    maxRounds: 0,
    seed: Math.floor(Math.random() * 1_000_000),
    color: 'white',
  };
}

/** Wendet die gewählte Bildschirmfarbe auf Canvas + DOM an. */
function applyColor(config: GameConfig): void {
  const name = config.color === 'phosphor' ? 'phosphor' : 'white';
  setPalette(name);
  const root = document.documentElement;
  root.style.setProperty('--accent', name === 'phosphor' ? '#6fe8ff' : '#8cf0ff');
}

function boot(): void {
  const canvas = document.getElementById('game') as HTMLCanvasElement | null;
  const root = document.getElementById('root') as HTMLDivElement | null;
  if (!canvas || !root) return;

  const c2d = setupCanvas(canvas);
  const sound = createSound();

  let state = createGame(defaultConfig());
  const aim: AimUi = { angle: 60, powder: 65 };

  const humanTurn = (): boolean => state.config.mode === 'hotseat' || state.activePlayer === 0;
  let manageDirty = false;

  const ctrl: Controller = {
    get game() {
      return state;
    },
    aim(angle) {
      aim.angle = Math.max(12, Math.min(88, angle));
    },
    setPowder(p) {
      aim.powder = Math.max(0, Math.min(100, p));
    },
    fire() {
      if (fire(state, aim.angle, aim.powder)) {
        sound.cannonFire();
      }
    },
    openManage() {
      openManage(state);
      manageDirty = true;
    },
    closeManage() {
      closeManage(state);
    },
    endManageTurn() {
      endManageTurn(state);
      manageDirty = true;
    },
    forfeit() {
      forfeit(state);
    },
    buyBalls(n) {
      if (applyBuyBalls(state, n)) {
        sound.click();
        manageDirty = true;
      }
    },
    buyPowder(units) {
      if (applyBuyPowder(state, units)) {
        sound.click();
        manageDirty = true;
      }
    },
    repairWalls() {
      if (applyRepairWalls(state)) {
        sound.click();
        manageDirty = true;
      }
    },
    replaceCannon() {
      if (applyReplaceCannon(state)) {
        sound.click();
        manageDirty = true;
      }
    },
    buildTower() {
      if (applyBuildTower(state)) {
        sound.click();
        manageDirty = true;
      }
    },
    setTax(t) {
      setTax(state, t);
    },
    togglePreview() {
      state.preview = !state.preview;
    },
    startGame(config) {
      applyColor(config);
      resetGame(state, config);
      startGame(state);
      manageDirty = true;
    },
    backToMenu() {
      state.phase = 'setup';
      state.winner = null;
      state.pendingShot = null;
      state.explosions.length = 0;
    },
    rematch() {
      const cfg: GameConfig = {
        ...state.config,
        seed: Math.floor(Math.random() * 1_000_000),
      };
      applyColor(cfg);
      resetGame(state, cfg);
      startGame(state);
      manageDirty = true;
    },
    update(dt) {
      gameUpdate(state, dt);
    },
  };

  const { hud, buttons } = buildHud(root, ctrl);
  const menus = buildMenus(root, ctrl);
  attachInput(c2d, ctrl, aim);

  window.addEventListener('resize', () => c2d.resize());
  c2d.resize();

  const handleEvents = (): void => {
    for (const ev of state.events) {
      switch (ev.kind) {
        case 'fired':
          sound.cannonFire();
          break;
        case 'impact':
          sound.impact();
          break;
        case 'buildingDestroyed':
          if (ev.buildingKind === 'powderstore') sound.bigExplosion();
          else sound.impact();
          break;
        case 'victory':
          sound.victory();
          break;
      }
    }
    state.events.length = 0;
  };

  const render = (): void => {
    const ctx = c2d.ctx;
    c2d.beginFrame(); // schwarzer Rahmen + dpr-Basis
    applyCamera(ctx, c2d);

    renderSky(ctx, state.decorSeed);
    renderTerrain(ctx, state.terrain);

    const canShowAim = state.phase === 'aim' && humanTurn() && hasCannon(state) && !isAiTurn(state);
    const showPreview = state.preview && canShowAim && cannonReady(state);
    let previewPlan: ReturnType<typeof planShot> = null;
    if (showPreview) {
      previewPlan = planShot(state, aim.angle, aim.powder, true);
    }
    renderCastles(ctx, state, { angleDeg: aim.angle, isActiveHumanShooter: canShowAim });
    if (previewPlan) renderTrajectoryPreview(ctx, previewPlan);
    renderProjectile(ctx, state);
    renderExplosions(ctx, state, performance.now() / 1000);
    restoreCamera(ctx);

    void WORLD;
  };

  // Menü-Refresh (Verwaltung nur bei Bedarf neu aufbauen)
  let lastPhase = '';
  const refreshMenus = (): void => {
    if (state.phase === 'manage' && (manageDirty || lastPhase !== 'manage')) {
      manageDirty = false;
      menus.refresh(state);
    } else if (state.phase !== 'manage') {
      menus.refresh(state);
    }
    lastPhase = state.phase;
  };

  // Zielwerte je Turn zurücksetzen: verhindert "eingefrorene" flache
  // Einstellungen über mehrere Runden (Kanone schießt nur noch herunter).
  const resetAimForTurn = (): void => {
    if (state.phase === 'aim') {
      if (aim.turnPlayer !== state.activePlayer) {
        aim.turnPlayer = state.activePlayer;
        aim.angle = 55;
        aim.powder = 60;
      }
    } else {
      aim.turnPlayer = undefined;
    }
  };

  // Game-Loop (fixed timestep 60 Hz); bei Fehlern anzeigen + anhalten
  const STEP = 1 / 60;
  let acc = 0;
  let last = performance.now();
  let lastTick = performance.now();
  let dead = false;
  const fatal = (err: unknown): void => {
    if (dead) return;
    dead = true;
    const pre = document.createElement('pre');
    pre.style.cssText = 'position:absolute;left:8px;top:200px;max-width:640px;color:#ff6;background:#000;border:1px solid #f66;padding:10px;font-size:12px;white-space:pre-wrap;z-index:99;';
    pre.textContent = `FEHLER: ${err instanceof Error ? `${err.message}\n${err.stack}` : String(err)}`;
    const root = document.getElementById('root') as HTMLDivElement;
    root.appendChild(pre);
    void c2d;
  };
  const frame = (now: number): void => {
    try {
      lastTick = now;
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.25) dt = 0.25;

      acc += dt;
      while (acc >= STEP) {
        handleEvents();
        gameUpdate(state, STEP);
        acc -= STEP;
      }

      render();
      resetAimForTurn();
      hud.update(state, aim);
      refreshMenus();
    } catch (err) {
      fatal(err);
      return;
    }
    requestAnimationFrame(frame);
  };
  try {
    requestAnimationFrame(frame);
  } catch (err) {
    fatal(err);
  }

  // Watchdog: Browser pausieren rAF in Hintergrund-Tabs → Loop per
  // Timer weitertreiben, damit das Spiel nie einfriert ohne Fehler.
  const watchdog = (): void => {
    if (dead) return;
    const now = performance.now();
    if (now - lastTick > 300) {
      lastTick = now;
      frame(now);
    }
    setTimeout(watchdog, 250);
  };
  setTimeout(watchdog, 250);
}

try {
  boot();
} catch (err) {
  const pre = document.createElement('pre');
  pre.style.cssText = 'position:absolute;left:8px;top:120px;max-width:640px;color:#ff6;background:#000;border:1px solid #f66;padding:10px;font-size:12px;white-space:pre-wrap;z-index:99;';
  pre.textContent = `BOOT-FEHLER: ${err instanceof Error ? `${err.message}\n${err.stack}` : String(err)}`;
  (document.getElementById('root') as HTMLDivElement).appendChild(pre);
}