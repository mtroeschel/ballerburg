/**
 * HUD (DOM-Overlay): Spielerwerte, Wind, Runde, Aktions-Buttons.
 */
import type { Controller, GameState } from '../types.js';

export interface Hud {
  update(state: GameState, ui: { angle: number; powder: number }): void;
}

export interface HudButtons {
  fire: HTMLButtonElement;
  manage: HTMLButtonElement;
  preview: HTMLButtonElement;
  forfeit: HTMLButtonElement;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

const fmt = (n: number): string => (n < 0 ? '−' : '') + Math.abs(Math.round(n)).toString();

export function buildHud(root: HTMLElement, ctrl: Controller): { hud: Hud; buttons: HudButtons } {
  const hud = el('div', 'hud') as HTMLDivElement;
  hud.id = 'hud';

  /* Zeile 1: Spielerpanee + Wind */
  const row1 = el('div', 'row');
  const panes = [el('div', 'pane active'), el('div', 'pane')];

  for (let p = 0; p < 2; p++) {
    const name = el('span', 'name');
    const stats = el('div', 'stats');
    panes[p]!.appendChild(name);
    panes[p]!.appendChild(stats);
    row1.appendChild(panes[p]!);
  }

  const windbox = el('div', 'windbox');
  windbox.id = 'windbox';
  const wlabel = el('span');
  wlabel.textContent = 'WIND';
  const warrow = el('span', 'arrow');
  const wval = el('span', 'val');
  windbox.append(wlabel, warrow, wval);
  row1.appendChild(windbox);

  /* Zeile 2: Runde + Buttons */
  const row2 = el('div', 'row');
  const round = el('span', 'stat');
  round.id = 'round';
  const phase = el('span', 'stat');
  phase.id = 'phase';
  const aimInfo = el('span', 'stat');
  aimInfo.id = 'aiminfo';
  row2.append(round, phase, aimInfo);

  const btnFire = el('button', 'primary');
  btnFire.textContent = 'FEUERN';
  const btnManage = el('button');
  btnManage.textContent = 'VERWALTEN';
  const btnPrev = el('button');
  btnPrev.textContent = 'VORSCHAU: AUS';
  const btnForfeit = el('button');
  btnForfeit.textContent = 'AUFGEBEN';

  btnFire.addEventListener('click', () => ctrl.fire());
  btnManage.addEventListener('click', () => ctrl.openManage());
  btnPrev.addEventListener('click', () => ctrl.togglePreview());
  btnForfeit.addEventListener('click', () => ctrl.forfeit());
  row2.append(btnFire, btnManage, btnPrev, btnForfeit);

  hud.append(row1, row2);
  root.appendChild(hud);

  const msgline = el('div');
  msgline.id = 'msgline';
  root.appendChild(msgline);

  const help = el('div');
  help.id = 'helpbar';
  help.textContent =
    'MAUS: ZIELEN   RAD: PULVER\nLEERTASTE: FEUERN   M/ESC: VERWALTUNG\nT: VORSCHAU   N: TURN BEENDEN   Q: AUFGEBEN';
  root.appendChild(help);

  const labels = ['KÖNIG AZUR', 'KÖNIG RUBIN'];
  const colors = ['#9cf', '#f8a'];

  return {
    buttons: { fire: btnFire, manage: btnManage, preview: btnPrev, forfeit: btnForfeit },
    hud: {
      update(state, ui) {
        for (let p = 0; p < 2; p++) {
          const c = state.castles[p]!;
          const pane = panes[p]!;
          pane.className = state.activePlayer === p ? 'pane active' : 'pane';
          const nameEl = pane.querySelector('.name') as HTMLElement | null;
          if (nameEl) {
            nameEl.textContent = labels[p] ?? '';
            nameEl.style.color = colors[p] ?? '#fff';
          }
          const stats = pane.querySelector('.stats') as HTMLElement;
          stats.textContent =
            `GOLD ${fmt(c.gold)} · KUGELN ${fmt(c.balls)} · PULVER ${fmt(c.powder)} · ` +
            `BEVÖLKERUNG ${fmt(c.population)} · STEUER ${fmt(c.taxRate)}% · TÜRME ${countTowers(c)} · EINK ${fmt(c.lastIncome)}`;
          if (c.surrendered) stats.textContent += ' · KAPITULIERT';
        }

        // Wind
        const seesWind = windvaneVisible(state);
        if (seesWind) {
          warrow.textContent = windArrow(state.wind.speed);
          wval.textContent = fmt(Math.abs(state.wind.speed));
        } else {
          warrow.textContent = '?';
          wval.textContent = '?';
        }

        round.textContent = `RUNDE ${state.round}`;
        phase.textContent = phaseLabel(state);
        aimInfo.textContent = `WINKEL ${Math.round(ui.angle)}° · PULVER ${Math.round(ui.powder)}`;

        const canAim = state.phase === 'aim';
        const humanTurn = state.config.mode === 'hotseat' || state.activePlayer === 0;
        btnFire.disabled = !(canAim && humanTurn) || !hasCannon(state);
        btnManage.disabled = !(canAim && humanTurn);
        btnForfeit.disabled = !((state.phase === 'aim' || state.phase === 'manage') && humanTurn);
        btnPrev.textContent = state.preview ? 'VORSCHAU: AN' : 'VORSCHAU: AUS';

        msgline.textContent = state.message;
      },
    },
  };
}

function countTowers(c: { buildings: Array<{ kind: string; active: boolean }> }): number {
  let n = 0;
  for (const b of c.buildings) if (b.kind === 'tower' && b.active) n++;
  return n;
}

function hasCannon(state: GameState): boolean {
  return state.castles[state.activePlayer]!.buildings.some(
    (b) => b.kind === 'cannon' && b.active && b.ready,
  );
}

function windvaneVisible(state: GameState): boolean {
  return state.castles[state.activePlayer]!.buildings.some(
    (b) => b.kind === 'windvane' && b.active,
  );
}

function windArrow(speed: number): string {
  if (Math.abs(speed) < 0.5) return '=';
  return speed > 0 ? '→' : '←';
}

function phaseLabel(state: GameState): string {
  switch (state.phase) {
    case 'aim':
      return state.config.mode === 'ai' && state.activePlayer === 1 ? 'KI DENKT …' : 'ZIELEN';
    case 'flight':
    case 'resolution':
      return 'KUGEL UNTERWEGS …';
    case 'manage':
      return 'VERWALTUNG';
    case 'gameOver':
      return 'SPIELENDE';
    default:
      return '—';
  }
}