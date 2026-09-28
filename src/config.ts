/**
 * Alle Balance-Werte des Spiels (Physik, Preise, Burg-Templates).
 * Angelehnt an Ballerburg SDL; Feintuning in M6.
 */

export const WORLD = Object.freeze({
  width: 960,
  height: 540,
});

/** Physik der Kugel (alle Strecken in Pixel, Zeit in Sekunden). */
export const PHYSICS = Object.freeze({
  /** Fallbeschleunigung nach unten (Bildschirm-y). */
  gravity: 780,
  /** Mündungsgeschwindigkeit bei Pulver=100 (px/s). */
  maxMuzzleSpeed: 880,
  /** Horizontale Beschleunigung pro Wind-Einheit (px/s^2). */
  windAccelPerUnit: 30,
  /** Simulations-Schrittweite der Ballistik. */
  simDt: 1 / 120,
  /** Max. Simulationsdauer eines Schusses in Sekunden. */
  maxFlightTime: 6,
  /** Radius der Kugel (px). */
  ballRadius: 6,
  /** Schadens-Umrechnung: dmg = speed / impactDmgFactor. */
  impactDmgFactor: 20,
  /** Mindestschaden eines Treffers. */
  minImpactDmg: 4,
  /** Sprengradius: Einschläge in der Nähe von Gebäuden schädigen diese mit. */
  splashRadius: 16,
  /** Schwächung des Einzelschadens für Splash-Treffer (0..1). */
  splashFactor: 0.45,
  /** Roll-Reibung (px/s^2 Geschwindigkeitsverlust). */
  rollFriction: 150,
  /** Max. Roll-Geschwindigkeit nach dem Aufprall (px/s). */
  maxRollSpeed: 260,
  /** Hang-Beschleunigung beim Bergab-Rollen (Anteil an g). */
  rollSlopeAccel: 0.22,
  /** Max. Rollzeit nach dem Aufschlag (s). */
  maxRollTime: 2.5,
});

/** Terrain-Erzeugung: zufällig, aber spielbar. */
export const TERRAIN = Object.freeze({
  /** Referenz-Talboden (Standardwert über die Verteilung gestreut). */
  groundY: 470,
  /** Unterste erlaubte Terrainhöhe (Kraterschutz, "Boden der Weltkarte"). */
  minHeight: 330,

  /** Talhöhe wird je Karte gleichmäßig aus diesem Bereich gewählt. */
  valleyMin: 452,
  valleyMax: 486,

  /** Höhe (y) der Berggipfel-Cluster. */
  peakMin: 205,
  peakMax: 305,

  /** Breite der Berge (in der Verteilung gestreut; "u=1" = Fußpunkt). */
  mountainWidthMin: 85,
  mountainWidthMax: 165,
  mountainWidth: 105,

  /** Form: Potenz (1.2 = spitz/zerklüftet … 3.0 = flacher Tafelgipfel). */
  mountainPowerMin: 1.2,
  mountainPowerMax: 3.0,
  mountainPower: 2.0,

  /** Basis-Steigung an den Rändern (Bildrahmen). */
  edgeLift: 14,

  /** Kleine Hügel im offenen Tal (0..n für Abwechslung, bleiben niedrig, damit
   * immer ein freies Schusskorridor über die Karte bleibt). */
  bumpMaxCount: 3,
  bumpHeightMin: 18,
  bumpHeightMax: 70,
  bumpWidthMin: 55,
  bumpWidthMax: 130,
});

/** Krater-Erzeugung (Einschläge modifizieren das Terrain). */
export const CRATER = Object.freeze({
  /** Tiefe eines Volltreffers in den Boden (px). */
  depth: 22,
  /** Krater-Radius (px). */
  radius: 30,
  /** Maximal kumulierte Tiefe an einer Stelle. */
  maxDepth: 75,
});

/** Burgen & Gebäude. */
export const CASTLE = Object.freeze({
  maxTowers: 5,
  maxBalls: 60,
  maxPowder: 100,

  /** Startbestand. */
  startBalls: 20,
  startPowder: 80,

  /** Mindest-Pulvermenge für einen tragenden Schuss (sonst fällt die Kugel nur). */
  minPowderForShot: 5,

  /** Preise in Gold. */
  priceBall: 4,
  /** Gold pro 5 Pulver-Einheiten (0.2 G/Einheit). */
  powderPerGold: 5,
  priceCannon: 400,
  priceTower: 300,
  /** Preis pro Mauer-Abschnitt. */
  priceWallRepair: 120,

  /** Einkommen pro Förderturm und Runde. */
  towerIncome: 60,

  /** Trefferpunkte der Gebäude. */
  hp: Object.freeze({
    throne: 90,
    /** Erster Treffer beschädigt, erst der zweite zerstört die Kanone. */
    cannon: 60,
    windvane: 12,
    ballstore: 40,
    powderstore: 40,
    treasury: 40,
    tower: 22,
    wall: 60,
  }),

  /** Mauern absorbieren nur 50% des Schadens. */
  wallDmgFactor: 0.5,

  /** Turm-Positionen (Anker, relativ zum Gipfel). Max. 5 je Seite. */
  towerSlots: Object.freeze([-100, -130, -160, 128, 158]),
});

/** Wirtschaft. */
export const ECONOMY = Object.freeze({
  startPopulation: 300,
  startTax: 40,

  /** Steuer-Einkommen = pop * taxRate/100. */
  growthTaxBelow: 40,
  growthRate: 1.004,
  emigrationTaxAbove: 55,
  emigrationFactor: 1 / 300,
  /** Sinkende Bevölkerung durch den Krieg (je Runde). */
  warAttrition: 0.999,

  populationMin: 5,
  populationMax: 500,
});

/** Windmodell. */
export const WIND_SIM = Object.freeze({
  maxUnits: 12,
  /** Wind ändert sich je Runde um diesen Betrag (zufällig vorzeichen). */
  stepMin: 1,
  stepMax: 2,
  /** Wahrscheinlichkeit, dass der Wind das Vorzeichen wechselt. */
  flipChance: 0.12,
  /** Wahrscheinlichkeit für völlige Windstille. */
  calmChance: 0.08,
  /** Ausgangsstärke zu Spielbeginn (kann negativ sein). */
  startRange: 4,
});

/** Schwierigkeitsgrade der KI. */
export const AI_CFG = Object.freeze({
  easy: Object.freeze({ angleStep: 8, powderStep: 15, angleErr: 9, powderErr: 20, windErr: 8 }),
  medium: Object.freeze({ angleStep: 5, powderStep: 10, angleErr: 4, powderErr: 10, windErr: 4 }),
  hard: Object.freeze({ angleStep: 2, powderStep: 4, angleErr: 1, powderErr: 3, windErr: 1 }),
  thinkTime: 1.0,
  /** KI schaut nur bis zu dieser Rundenanzahl voraus; Management-Schwelle. */
  manageReserve: 150,
  /** Wahrscheinlichkeit, dass die KI managt statt feuert, wenn alles ok ist. */
  manageChance: 0.08,
});

/** Ziele-Gewichte für die KI-Bewertung. */
export const AI_TARGET_WEIGHT = Object.freeze({
  throne: 1000,
  cannon: 550,
  powderstore: 420,
  treasury: 320,
  ballstore: 220,
  tower: 90,
  wall: 25,
  windvane: 60,
});

/** Einstellungen im Setup-Menü. */
export const SETUP = Object.freeze({
  startingGoldOptions: Object.freeze([500, 1000, 2000]),
  defaultStartingGold: 1000,
  defaultMaxRounds: 0,
});