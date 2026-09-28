# Implementierungsplan: „Ballerburg" als Browser-Spiel

Stand: 2026-09-28 · Status: abgestimmt (Plan)

## 1. Überblick

Originalgetreu angelehnte Neuimplementierung des rundenbasierten Artillerie-Strategiespiels **Ballerburg (1987, Atari ST, Eckhard Kruse)** als reine Web-App, spielbar im Browser mit **Maus und Tastatur**. Das Original ist Public Domain; wir implementieren alles von Grund auf neu in TypeScript. Als Referenz für Gameplay-Werte dient die Open-Source-Neuauflage **Ballerburg SDL** (baller.tuxfamily.org).

**Kern-Gameplay:** Zwei Königreiche auf zwei Bergen, getrennt durch ein Bergmassiv. Man feuert mit Mörser-artigen Steilfeuer-Kanonen; Zielparameter sind **Abschusswinkel** und **Pulvermenge** (→ Mündungsgeschwindigkeit), ständig wechselnder **Wind** verkompliziert das Zielen. Dazu eine vollständige Wirtschaftssimulation (Steuern, Bevölkerung, Fördertürme, Nachkauf, Reparaturen).

**Abgestimmte Scope-Entscheidungen:**
- Simulation: **vollständig** (Wirtschaft inkl. Steuern/Bevölkerung/Fördertürme)
- Modi: **Einzelspieler gegen KI** + **lokaler Hot-Seat**
- Optik: **Retro monochrom** (Weiß auf Schwarz, optional Phosphor-Blau), Pixel-Font
- Technik: **TypeScript + Vite + Canvas** (ohne Game-Framework)

## 2. Umgesetzte Spielmechanik (vollständige Simulation)

**Rundenablauf** (abwechselnd, Hot-Seat oder gegen KI):
1. **Rundenbeginn:** Wind ändert sich (Richtung + Stärke, über Windfahne sichtbar), Steuereinnahmen fließen (Bevölkerung × Steuersatz).
2. **Aktionsphase** – der Spieler wählt genau eine Aktion:
   - **Feuern:** Winkel einstellen, Pulvermenge wählen, Schuss abfeuern.
   - **Verwalten:** Kugeln nachkaufen, Pulver nachkaufen, Mauer reparieren, Kanone ersetzen, Förderturm bauen (max. 5), Steuersatz anpassen, aufgeben.
3. **Rundenende:** Gegner ist am Zug.

**Wichtige Ziele & Treffereffekte:**

| Ziel | Effekt |
|---|---|
| **Thronsaal (König)** | Hauptsiegbedingung |
| **Kanonen** | Gegner verliert Feuerkraft (1 Schuss/Runde, Kanone muss ersetzt werden) |
| **Windfahne** | Gegner sieht Windrichtung/-stärke nicht mehr |
| **Kugellager** | Teil der gelagerten Kugeln zerstört |
| **Schatzkammer** | Geld verloren |
| **Pulverlager** | *gesamtes* Pulver explodiert |
| **Fördertürme** | Einkommen sinkt (schwer zu treffen) |
| **Berg/Umgebung** | Einschläge erzeugen Krater (Terrain-Modifikation) |

**Wirtschaft:** Einkommen aus Steuern (Bevölkerungszahl × Steuersatz; hohe Steuern → Abwanderung) + Fördertürme. Ausgaben: Kugeln, Pulver, Reparaturen, Kanonen-Ersatz, Turmbau. Anfangsgeld wird im Setup gewählt.

**Siegbedingungen:** Gegnerischen Thronsaal zerstören; Gegner gibt auf; (optional nach Config) Geld-/Rundenlimit.

## 3. Technologie-Stack

| Bereich | Wahl | Begründung |
|---|---|---|
| Sprache | **TypeScript (strict)** | Typ-Sicherheit für Ballistik-, Wirtschafts- und KI-Logik |
| Build/Dev | **Vite** | Schneller Dev-Server, schnelle HMR, einfaches `build` fürs Deployment |
| Rendering | **HTML5 Canvas 2D** (kein Framework) | Volle Kontrolle über den Game-Loop; kein Framework-Ballast für ein rundenbasiertes Spiel |
| Spiellogik | Reine TS-Module (framework-frei, deterministisch) | Testbarkeit |
| Tests | **Vitest** | Unit-Tests für Ballistik, Wirtschaft, Rundenlogik, KI |
| UI/HUD | **DOM-Overlay** + Canvas-Welt | Menüs/Buttons im DOM (zugänglich, Tastaturbedienung), Spielwelt im Canvas |
| Audio | **Web Audio API** (synthetisch) | Kanonen-Donner, Pfeifen der Kugel, Einschlag – ohne Asset-Dateien |
| Optik | Monochrom (Weiß auf Schwarz, optional „Phosphor"-Blau), Pixel-Font (gebündelt, offline-tauglich) | Atari-ST-Hochauflösungs-Look |

## 4. Projektstruktur

```
ballerburg/
├─ index.html
├─ package.json / tsconfig.json / vite.config.ts
├─ src/
│  ├─ main.ts                # Einstieg, Game-Loop (fixed timestep), Bootstrapping
│  ├─ config.ts              # Alle Balance-Werte (Physik, Preise, Burg-Templates)
│  ├─ types.ts
│  ├─ core/                  # Reine, testbare Logik (kein DOM/Canvas)
│  │  ├─ ballistics.ts       # Trajektorie: Gravitation + Wind + Terrain-Kollision
│  │  ├─ terrain.ts          # Heightmap, Krater-Erzeugung, Erosion
│  │  ├─ castle.ts           # Burgmodell: Mauern, Kanonen, Gebäude, Lager, Bevölkerung
│  │  ├─ economy.ts          # Steuern, Einkommen, Preise, Käufe
│  │  ├─ wind.ts             # Windmodell (Richtung/Stärke, Wechsel)
│  │  ├─ turn.ts             # Phasen-Zustandsmaschine
│  │  ├─ game.ts             # Orchestrierung, Runden, Sieg/Niederlage
│  │  └─ ai.ts               # KI: Schusssuche + Management-Entscheidungen
│  ├─ render/
│  │  ├─ canvas.ts           # Canvas-Setup, DPI-Skalierung
│  │  ├─ world.ts            # Berge, Terrain, Krater, Himmel
│  │  ├─ castle.ts           # Verfahrens-generierte Pixel-Sprites
│  │  ├─ projectile.ts       # Kugel, Explosion, Partikel
│  │  └─ camera.ts           # optional: Zoom/Pan
│  ├─ ui/
│  │  ├─ input.ts            # Maus + Tastatur → Spielfunktionen
│  │  ├─ hud.ts              # Geld, Lager, Wind, Rundeninfo
│  │  └─ menu.ts             # Setup-, Kauf- und Aktionsmenüs (deutsch)
│  └─ assets/                # Retro-Font, Sound-Presets
└─ tests/                    # Vitest-Tests (core/)
```

Wichtiges Prinzip: `core/` ist **vollständig testbar und deterministisch** (Simulation mit festem Seed) — Rendering und UI konsumieren nur Events/State.

## 5. Eingaben (Maus + Tastatur)

| Aktion | Maus | Tastatur |
|---|---|---|
| Zielen (Winkel) | Maus-Bewegung über dem Bildschirm | Pfeiltasten ←/→ bzw. A/D |
| Pulvermenge | Mausrad / Slider ziehen | ↑/↓ bzw. W/S |
| Abfeuern | Klick auf „Feuern"-Button | Leertaste / Enter |
| Menü öffnen/schließen | Klick | Esc / M |
| Kaufaktionen | Klick | Zahlen 1–4 |
| Nächster Zug / Aufgeben | Klick | N / Q |
| Trajektorien-Vorschau (optional) | — | T (Toggle) |

## 6. Implementierungsphasen

| Phase | Inhalt | Ergebnis / „Definition of Done" |
|---|---|---|
| **M0 – Gerüst** | Vite+TS-Projekt, Canvas-Loop (fixed timestep), DPI-Handling, Monochrom-Styling | Leeres „Retro-Fenster" läuft, Struktur + Tests aufgesetzt |
| **M1 – Ballistik & Terrain** | Heightmap, Gravitation+Wind-Simulation, Schuss, Einschläge → Krater, Kugel-Roll-/Einschlag-Verhalten; Vitest-Abdeckung | Schussbarer Prototyp ohne Wirtschaft |
| **M2 – Burgen & Ziele** | Burg-Templates (2–4 vordefinierte Layouts), Mauern/Kanonen/Thronsaal/Windfahne/Lager/Schatzkammer/Pulverkammer, Schadensmodell, HUD-Anzeige Zustände | Burgen stehen auf Bergen, Treffer zeigen sichtbare Schäden |
| **M3 – Runden & Wirtschaft** | Turn-Phasen, Steuern/Bevölkerung/Fördertürme, Kaufmenü, Windwechsel, Sieg/Niederlage | **Kompletter Hot-Seat-Durchlauf spielbar** |
| **M4 – UI & Steuerung** | Maus-Zielen, Mausrad-Pulver, Tastatur-Kurzbefehle, HUD, Menüs, deutsche Texte, Retro-Font | Auslieferbares Spiel mit komfortabler Steuerung |
| **M5 – KI-Gegner** | Simulationsbasierte Schuss-Suche (Kandidaten [Winkel,Pulver] durchspielen, besten Treffer bewerten), Management-KI (Prioritäten), 3 Schwierigkeitsgrade | Einzelspieler-Modus komplett |
| **M6 – Feinschliff & Release** | Web-Audio-Sounds, Partikeleffekte, optional Trajektorien-Vorschau, Balance-Tuning gegen Original-Referenzwerte, `vite build`, README, optional Deployment (GitHub Pages/Netlify) | Fertige, spielbare Version |

**KI-Ansatz (M5):** Die KI simuliert Kandidatenschüsse mit der *echten* Ballistik (Schnittstelle in `core/ballistics` wiederverwendet) und bewertet erwarteten Schaden (Thronsaal > Kanone > Lager > …). Schwierigkeitsgrade steuern Suchabstand/Kandidatenzahl, Zufallsfehler beim Zielen und Management-Aggressivität.

## 7. Teststrategie

- **Ballistik:** Trajektorien-Endpunkte, Windeinfluss, Terrain-Kollision (Pyramiden-/Heightmap-Testfälle), Determinismus.
- **Wirtschaft:** Steuerformeln, Bevölkerungswanderung, Preis-/Kauf-Logik, Rundengrenzen.
- **Rundenlogik:** Zustandsübergänge, Sieg-/Niederlage-Szenarien.
- **KI:** Schusstreffer unter Standardbedingungen, Budget-Disziplin.

## 8. Risiken & Gegenmaßnahmen

- **Exakte Originalwerte (Preise, Physik) sind nicht vollständig dokumentiert** → Ballistik/Wirtschaft als zentrale, konfigurierbare Konstanten in `config.ts`; Abgleich mit Ballerburg SDL als Referenz + manuelles Balance-Feintuning in M6.
- **Kugel-Roll-/Kraterphysik ist komplex** → eigenes, isoliert testbares Modul; Fallback: einfacheres Aufschlagmodell, falls zu aufwendig.
- **KI-Balance** → simulationsbasiert mit parametrierbaren Schwierigkeitsgraden, empirisches Tuning.
- **Umfang** → klare Meilensteine mit spielbaren Zwischenergebnissen, damit nach M3 bereits ein kompletter Partie-Durchlauf existiert.

## 9. Offene Punkte (Entscheidung beim Implementieren)

1. **Anfangsgeld / Preise / Rundenlimit** – Defaults analog zum Original, Feintuning in M6.
2. **Trajektorien-Vorschau** – im Original nicht vorhanden; Vorschlag: **optionaler, standardmäßig ausgeschalteter** Komfort-Toggle (sehr hilfreich, da Windeinfluss schwer abschätzbar ist).
