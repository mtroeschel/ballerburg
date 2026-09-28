/**
 * DOM-Menüs: Setup (Vor dem Spiel), Verwaltung (je Turn),
 * Spielende (Sieg/Niederlage).
 */
import { CASTLE, SETUP } from '../config.js';
import type { Controller, Difficulty, GameMode, GameState } from '../types.js';

export interface Menus {
  refresh(state: GameState): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

function overlayPanel(title: string): { ov: HTMLDivElement; panel: HTMLDivElement; h: HTMLHeadingElement } {
  const ov = el('div', 'overlay');
  ov.dataset.role = 'overlay';
  const panel = el('div', 'panel');
  const h = el('h1');
  h.textContent = title;
  panel.appendChild(h);
  ov.appendChild(panel);
  return { ov, panel, h };
}

/* ------------------------------- Setup ------------------------------- */

function buildSetup(root: HTMLElement, ctrl: Controller): HTMLDivElement {
  const { ov, panel, h } = overlayPanel('BALLERBURG');
  ov.id = 'setup-overlay';
  ov.classList.add('on');

  const sub = el('p');
  sub.textContent = 'MÖRSER-ARTILLERIE · WIRTSCHAFT · WIND · MONOCHROM';
  panel.appendChild(sub);

  const mkField = (legend: string): HTMLElement => {
    const f = el('fieldset');
    const l = el('legend');
    l.textContent = legend;
    f.appendChild(l);
    return f;
  };
  const mkRadio = (name: string, value: string, label: string, checked: boolean, disabled = false): HTMLLabelElement => {
    const lab = el('label');
    const inp = el('input');
    inp.type = 'radio';
    inp.name = name;
    inp.value = value;
    inp.checked = checked;
    inp.disabled = disabled;
    lab.appendChild(inp);
    lab.appendChild(document.createTextNode(label));
    return lab;
  };

  /* Modus */
  const modeF = mkField('Modus');
  modeF.appendChild(mkRadio('mode', 'ai', 'Einzelspieler (gegen Computer)', true));
  modeF.appendChild(mkRadio('mode', 'hotseat', 'Hot-Seat (2 Spieler im Wechsel)', false));
  panel.appendChild(modeF);

  /* Schwierigkeit */
  const diffF = mkField('Schwierigkeit (gegen Computer)');
  diffF.appendChild(mkRadio('diff', 'easy', 'Leicht', true));
  diffF.appendChild(mkRadio('diff', 'medium', 'Mittel', false));
  diffF.appendChild(mkRadio('diff', 'hard', 'Schwer', false));
  panel.appendChild(diffF);

  /* Startgeld */
  const goldF = mkField('Startgeld');
  for (const g of SETUP.startingGoldOptions) {
    goldF.appendChild(mkRadio('gold', String(g), `${g} GOLD`, g === SETUP.defaultStartingGold));
  }
  panel.appendChild(goldF);

  /* Rundenlimit */
  const roundF = mkField('Rundenlimit');
  roundF.appendChild(mkRadio('rounds', '0', 'Kein Limit', true));
  roundF.appendChild(mkRadio('rounds', '50', '50 Runden (dann Unentschieden)', false));
  panel.appendChild(roundF);

  /* Farbmodus */
  const colorF = mkField('Bildschirmfarbe');
  colorF.appendChild(mkRadio('color', 'white', 'Weiß auf Schwarz', true));
  colorF.appendChild(mkRadio('color', 'phosphor', 'Phosphor-Blau (Monochrom)', false));
  panel.appendChild(colorF);

  const startBtn = el('button', 'primary');
  startBtn.textContent = 'SPIEL STARTEN';
  startBtn.addEventListener('click', () => {
    const mode: GameMode = radio('mode') === 'hotseat' ? 'hotseat' : 'ai';
    const diff: Difficulty = radio('diff') as Difficulty;
    const gold = parseInt(radio('gold') ?? String(SETUP.defaultStartingGold), 10);
    const rounds = parseInt(radio('rounds') ?? '0', 10);
    ctrl.startGame({
      mode,
      difficulty: mode === 'ai' ? diff : 'medium',
      startingGold: gold,
      maxRounds: rounds,
      seed: Math.floor(Math.random() * 1_000_000),
      color: radio('color') === 'phosphor' ? 'phosphor' : 'white',
    });
  });
  const btnRow = el('div', 'btnrow');
  btnRow.appendChild(startBtn);
  panel.appendChild(btnRow);

  const help = el('small');
  help.style.display = 'block';
  help.style.marginTop = '8px';
  help.style.lineHeight = '1.5';
  help.textContent =
    'STEUERUNG: Maus = Winkel · Mausrad = Pulver · Leertaste = Feuern · ' +
    'M = Verwaltung · T = Vorschau · Q = Aufgeben (2×).\n' +
    'Ziel: Zerstöre den gegnerischen Thronsaal. Höhere Winkel werfen über ' +
    'den Berg. Wind (Fahne) versetzt die Kugel!';
  panel.appendChild(help);

  root.appendChild(ov);

  modeF.querySelectorAll('input').forEach((i: HTMLInputElement) => {
    i.addEventListener('change', () => {
      const hot = radio('mode') === 'hotseat';
      diffF.querySelectorAll('input').forEach((d: HTMLInputElement) => (d.disabled = hot));
    });
  });
  void h;
  return ov;

  function radio(name: string): string | null {
    const labels = document.querySelectorAll(`input[name="${name}"]`);
    for (const i of labels) {
      const inp = i as HTMLInputElement;
      if (inp.checked) return inp.value;
    }
    return null;
  }
}

/* ------------------------------- Verwaltung ------------------------------- */

function buildManage(root: HTMLElement, ctrl: Controller): HTMLDivElement {
  const { ov, panel, h } = overlayPanel('Verwaltung');
  ov.id = 'manage-overlay';
  const body = el('div');
  body.id = 'manage-body';
  panel.appendChild(body);

  const actions = el('div', 'btnrow');

  const endBtn = el('button', 'primary');
  endBtn.textContent = 'TURN BEENDEN (N)';
  endBtn.addEventListener('click', () => ctrl.endManageTurn());

  const backBtn = el('button');
  backBtn.textContent = 'ZURÜCK ZUM ZIELEN (ESC)';
  backBtn.addEventListener('click', () => ctrl.closeManage());

  const quitBtn = el('button');
  quitBtn.textContent = 'AUFGEBEN (Q)';
  quitBtn.addEventListener('click', () => ctrl.forfeit());

  actions.append(endBtn, backBtn, quitBtn);
  panel.appendChild(actions);

  root.appendChild(ov);
  void h;

  return ov;
}

function buyRow(
  parent: HTMLElement,
  label: string,
  detail: string,
  counts: number[],
  onBuy: (n: number) => void,
): HTMLElement {
  const row = el('div', 'buyrow');
  const info = el('span', 'info');
  info.textContent = label;
  const small = el('small');
  small.textContent = detail;
  info.appendChild(small);
  const amounts = el('span', 'amounts');
  for (const n of counts) {
    const b = el('button');
    b.textContent = String(n);
    b.addEventListener('click', () => onBuy(n));
    amounts.appendChild(b);
  }
  row.append(info, amounts);
  parent.appendChild(row);
  return row;
}

function actionRow(
  parent: HTMLElement,
  label: string,
  detail: string,
  onClick: () => void,
  disabled: boolean,
): HTMLElement {
  const row = el('div', 'buyrow');
  const info = el('span', 'info');
  info.textContent = label;
  const small = el('small');
  small.textContent = detail;
  info.appendChild(small);
  const b = el('button');
  b.textContent = 'AUSFÜHREN';
  b.disabled = disabled;
  b.addEventListener('click', onClick);
  row.append(info, b);
  parent.appendChild(row);
  return row;
}

/** Baut den Inhalt der Verwaltung zu einem Turn-Neustart neu. */
export function refreshManageBody(state: GameState, ctrl: Controller): void {
  const body = document.getElementById('manage-body');
  const h = document.querySelector<HTMLHeadingElement>('#manage-overlay h1');
  if (!body || !h) return;
  const c = state.castles[state.activePlayer]!;
  h.textContent = `VERWALTUNG – ${c.name}`;
  body.replaceChildren();

  const summary = el('p');
  summary.textContent =
    `GOLD ${c.gold} · KUGELN ${c.balls}/${CASTLE.maxBalls} · PULVER ${c.powder}/${CASTLE.maxPowder} · ` +
    `BEVÖLKERUNG ${c.population} · STEUER ${c.taxRate}% · EINKOMMEN/RUNDE ${c.lastIncome} GOLD`;
  body.appendChild(summary);

  buyRow(body, 'KUGELN KAUFEN', `${CASTLE.priceBall} GOLD/STÜCK`, [1, 5, 10, 25], (n) => ctrl.buyBalls(n));
  buyRow(body, 'PULVER KAUFEN', `${CASTLE.powderPerGold} EINHEITEN/GOLD`, [10, 25, 50, 100], (n) => ctrl.buyPowder(n));

  const walls = c.buildings.filter((b) => b.kind === 'wall' && b.active && b.hp < b.maxHp).length;
  actionRow(
    body,
    'MAUER REPARIEREN',
    `${walls} beschädigt(e) Abschnitt(e) · je ${CASTLE.priceWallRepair} GOLD`,
    () => ctrl.repairWalls(),
    walls === 0,
  );

  const cannonOk = c.buildings.some((b) => b.kind === 'cannon' && b.active);
  actionRow(
    body,
    'KANONE ERSETZEN',
    `${CASTLE.priceCannon} GOLD (nur wenn zerstört)`,
    () => ctrl.replaceCannon(),
    cannonOk,
  );

  const towers = c.buildings.filter((b) => b.kind === 'tower' && b.active).length;
  actionRow(
    body,
    'FÖRDERTURM BAUEN',
    `${CASTLE.priceTower} GOLD · ${towers}/${CASTLE.maxTowers} vorhanden`,
    () => ctrl.buildTower(),
    towers >= CASTLE.maxTowers,
  );

  const taxRow = el('div', 'buyrow');
  const taxInfo = el('span', 'info');
  taxInfo.textContent = 'STEUERSATZ ANPASSEN';
  const slider = el('input') as HTMLInputElement;
  slider.type = 'range';
  slider.min = '0';
  slider.max = '100';
  slider.value = String(c.taxRate);
  slider.addEventListener('input', () => ctrl.setTax(parseInt(slider.value, 10)));
  const val = el('span', 'val');
  val.textContent = `${c.taxRate}%`;
  slider.addEventListener('input', () => { val.textContent = `${slider.value}%`; });
  taxRow.append(taxInfo, slider, val);
  body.appendChild(taxRow);

  const hint = el('small');
  hint.textContent =
    'Hinweis: Ein Verwaltungs-Turn ersetzt den Schuss. Hohe Steuern → Abwanderung. ' +
    'Türme erhöhen das Einkommen und sind schwer zu treffen.';
  body.appendChild(hint);
}

/* ------------------------------- Spielende ------------------------------- */

function buildGameOver(root: HTMLElement, ctrl: Controller): HTMLDivElement {
  const { ov, panel, h } = overlayPanel('Spielende');
  ov.id = 'gameover-overlay';
  const sub = el('h2');
  sub.id = 'go-sub';
  const info = el('p');
  info.id = 'go-info';
  panel.append(sub, info);

  const btnRow = el('div', 'btnrow');
  const again = el('button', 'primary');
  again.textContent = 'NOCHMAL SPIELEN';
  again.addEventListener('click', () => ctrl.rematch());
  const menu = el('button');
  menu.textContent = 'HAUPTMENÜ';
  menu.addEventListener('click', () => ctrl.backToMenu());
  btnRow.append(again, menu);
  panel.appendChild(btnRow);

  root.appendChild(ov);
  return ov;
}

export function refreshGameOver(state: GameState): void {
  const ov = document.getElementById('gameover-overlay');
  if (!ov) return;
  const human = state.config.mode !== 'hotseat';
  let title: string;
  if (state.winner === null) {
    title = 'UNENTSCHIEDEN';
  } else if (human) {
    title = state.winner === 0 ? 'SIEG!' : 'NIEDERLAGE …';
  } else {
    title = state.winner === 0 ? 'KÖNIG AZUR SIEGT' : 'KÖNIG RUBIN SIEGT';
  }
  (ov.querySelector('h1') as HTMLHeadingElement).textContent = title;
  (ov.querySelector('#go-sub') as HTMLElement).textContent = state.victoryReason;
  const winnerName = state.winner !== null ? state.castles[state.winner]!.name : '—';
  (ov.querySelector('#go-info') as HTMLElement).textContent = `Gewinner: ${winnerName} (Runde ${state.round})`;
}

/* ------------------------------- Steuerung ------------------------------- */

export function buildMenus(root: HTMLElement, ctrl: Controller): Menus {
  buildSetup(root, ctrl);
  buildManage(root, ctrl);
  buildGameOver(root, ctrl);

  return {
    refresh(state) {
      // Sichtbarkeit der Overlays je Phase
      const flag = (phase: string): boolean =>
        (phase === 'setup' && state.phase === 'setup') ||
        (phase === 'manage' && state.phase === 'manage') ||
        (phase === 'gameover' && state.phase === 'gameOver');
      for (const o of document.querySelectorAll<HTMLDivElement>('.overlay')) {
        const key = o.id.replace('-overlay', '');
        o.classList.toggle('on', flag(key));
      }
      if (state.phase === 'manage') refreshManageBody(state, ctrl);
      if (state.phase === 'gameOver') refreshGameOver(state);
    },
  };
}