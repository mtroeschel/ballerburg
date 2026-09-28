/**
 * Eingabe: Maus (Zielen), Mausrad (Pulver), Tastatur-Kurzbefehle.
 * Wandelt UI-Eingaben in Controller-Aufrufe um.
 */
import type { Canvas2D } from '../render/canvas.js';
import type { Controller } from '../types.js';

export interface AimUi {
  angle: number;
  powder: number;
  /** Spieler, für den die aktuellen Zielwerte gelten (Reset zu Turnbeginn). */
  turnPlayer?: number;
}

/** Sicherer Winkelbereich: nicht zu flach (Kugel fällt nur herunter). */
export const AIM_RANGE = Object.freeze({ min: 15, max: 85 });
/** Mindest-Pulver, damit ein Schuss überhaupt etwas trägt. */
export const MIN_POWDER = 5;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function attachInput(c2d: Canvas2D, ctrl: Controller, aim: AimUi): void {
  let forfeitArmed = false;
  let forfeitAt = -1;

  const humanTurn = (): boolean =>
    ctrl.game.config.mode === 'hotseat' || ctrl.game.activePlayer === 0;

  const hasCannon = (): boolean =>
    ctrl.game.castles[ctrl.game.activePlayer]!.buildings.some(
      (b) => b.kind === 'cannon' && b.active,
    );

  const canAim = (): boolean =>
    ctrl.game.phase === 'aim' && humanTurn() && hasCannon();

  const updateAngleFromPointer = (wx: number, wy: number): void => {
    const c = ctrl.game.castles[ctrl.game.activePlayer]!;
    const cannon = c.buildings.find((b) => b.kind === 'cannon' && b.active);
    if (!cannon) return;
    const facing: 1 | -1 = c.player === 0 ? 1 : -1;
    const pivotY = cannon.baseY - 10;

    // Symmetrisches Schleuder-Zielen:
    // - "Weite" = horizontale Entfernung der Maus von der Kanone (in
    //   Schussrichtung gemessen); die hintere Hälfte wird gespiegelt,
    //   damit der volle Winkelbereich AUF BEIDEN SEITEN glatt läuft.
    // - Elevation steigt mit der Höhe der Maus über der Kanone und
    //   sinkt mit größerer Weite (Modell "Rohr auf den Punkt richten").
    const away = facing * (wx - cannon.x);
    const d = Math.max(40, Math.abs(away) * 0.55);
    const dyUp = pivotY - wy;
    const angle = (Math.atan2(dyUp, d) * 180) / Math.PI;
    ctrl.aim(clamp(angle, AIM_RANGE.min, AIM_RANGE.max));
  };

  c2d.canvas.addEventListener('mousemove', (e) => {
    if (!canAim()) return;
    const w = c2d.screenToWorld(e.clientX, e.clientY);
    updateAngleFromPointer(w.x, w.y);
  });

  c2d.canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      if (!canAim()) return;
      const delta = e.deltaY > 0 ? 4 : -4;
      aim.powder = clamp(aim.powder + delta, MIN_POWDER, 100);
      ctrl.setPowder(aim.powder);
    },
    { passive: false },
  );

  const buyQuick = (n: number): void => {
    switch (n) {
      case 1: ctrl.buyBalls(5); break;
      case 2: ctrl.buyPowder(25); break;
      case 3: ctrl.repairWalls(); break;
      case 4: ctrl.buildTower(); break;
    }
  };

  window.addEventListener('keydown', (e) => {
    if (ctrl.game.phase === 'setup') return;
    const k = e.key;
    const shift = e.shiftKey;

    switch (k) {
      case 'ArrowLeft':
      case 'a': case 'A':
        if (canAim()) {
          aim.angle = clamp(aim.angle - (shift ? 8 : 1), AIM_RANGE.min, AIM_RANGE.max);
          ctrl.aim(aim.angle);
        }
        e.preventDefault();
        break;
      case 'ArrowRight':
      case 'd': case 'D':
        if (canAim()) {
          aim.angle = clamp(aim.angle + (shift ? 8 : 1), AIM_RANGE.min, AIM_RANGE.max);
          ctrl.aim(aim.angle);
        }
        e.preventDefault();
        break;
      case 'ArrowUp':
      case 'w': case 'W':
        if (canAim()) {
          aim.powder = clamp(aim.powder + 2, MIN_POWDER, 100);
          ctrl.setPowder(aim.powder);
        }
        e.preventDefault();
        break;
      case 'ArrowDown':
      case 's': case 'S':
        if (canAim()) {
          aim.powder = clamp(aim.powder - 2, MIN_POWDER, 100);
          ctrl.setPowder(aim.powder);
        }
        e.preventDefault();
        break;
      case ' ':
      case 'Enter':
        if (canAim()) ctrl.fire();
        e.preventDefault();
        break;
      case 'm': case 'M':
        if (ctrl.game.phase === 'manage') ctrl.closeManage();
        else if (ctrl.game.phase === 'aim' && humanTurn()) ctrl.openManage();
        break;
      case 'Escape':
        if (ctrl.game.phase === 'manage') ctrl.closeManage();
        break;
      case 't': case 'T':
        ctrl.togglePreview();
        break;
      case 'n': case 'N':
        if (ctrl.game.phase === 'manage') ctrl.endManageTurn();
        else if (ctrl.game.phase === 'aim' && humanTurn()) ctrl.openManage();
        break;
      case '1': case '2': case '3': case '4':
        if (ctrl.game.phase === 'manage') buyQuick(parseInt(k, 10));
        break;
      case 'q': case 'Q':
        if (ctrl.game.phase !== 'aim' && ctrl.game.phase !== 'manage') break;
        if (forfeitArmed && Date.now() - forfeitAt < 2500) {
          ctrl.forfeit();
          forfeitArmed = false;
        } else {
          forfeitArmed = true;
          forfeitAt = Date.now();
        }
        break;
    }
  });
}