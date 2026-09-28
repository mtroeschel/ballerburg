# Ballerburg

Rundenbasiertes Artillerie-Strategiespiel im Stil von **Ballerburg (1987, Atari ST, Eckhard Kruse)** –
als reine Browser-Neuimplementierung in **TypeScript + Vite + Canvas** (ohne Game-Framework).
Retro-Monochrom, Pixel-Font, synthetischer Sound (`Web Audio API`).

> Ursprünglich Public Domain. Diese Version ist eine Neuimplementierung von Grund auf,
> angelehnt an die Open-Source-Referenz *Ballerburg SDL* (baller.tuxfamily.org).

## Spielidee

Zwei Königreiche auf zwei Bergen, getrennt durch ein Bergmassiv. Man feuert mit
Mörser-artigen Steilfeuer-Kanonen. Zielparameter sind **Abschusswinkel** und
**Pulvermenge** (→ Mündungsgeschwindigkeit); der **ständig wechselnde Wind** macht
das Zielen zur Kunst – eine Windfahne verrät Richtung und Stärke.

**Siegen** kannst du, indem du den **Thronsaal** des Gegners zerstörst – oder der Gegner
kapituliert. (Optional: Rundenlimit mit Unentschieden.)

## Spielablauf

1. **Rundenbeginn:** Wind ändert sich, Steuereinnahmen fließen
   (Bevölkerung × Steuersatz + Fördertürme).
2. **Aktionsphase:** genau eine Aktion wählen:
   - **Feuern** – Winkel und Pulver einstellen, BALL AB!
   - **Verwalten** – Kugeln/Pulver kaufen, Mauer reparieren, Kanone ersetzen,
     Förderturm bauen (max. 5), Steuersatz anpassen – oder **aufgeben**.
3. **Rundentausch** – der Gegner ist am Zug (Hot-Seat oder KI).

### Wichtige Ziele & Treffereffekte

| Ziel | Effekt |
|---|---|
| **Thronsaal** | Hauptsiegbedingung (mehrere Treffer nötig) |
| **Kanone** | Gegner kann nicht mehr schießen, muss sie ersetzen (400 G) |
| **Windfahne** | Gegner sieht Wind nicht mehr |
| **Kugellager** | die Hälfte der gelagerten Kugeln geht verloren |
| **Schatzkammer** | 25 % des Goldes gehen verloren |
| **Pulverlager** | *gesamtes* Pulver explodiert |
| **Fördertürme** | Einkommen sinkt (schwer zu treffen) |
| **Berg/Umgebung** | Einschläge erzeugen Krater, die das Terrain dauerhaft verändern |

Achtung: Steile Treffer richten mehr Schaden an; Mauern dämpfen Aufschläge und können
rollende Kugeln stoppen. Hohe Steuern → Abwanderung der Bevölkerung.
Zusätzlich gilt: **Sprengschaden** – Einschläge nahe eines Gebäudes schädigen dieses leicht
(so lässt sich ein gut verteidigtes Schloss mit gezieltem Beschuss „einschießen“).
Der Thronsaal ist bewusst das anspruchsvollste Ziel (höchster Punkt); mit steilen
Winkeln und Vollpulver wird er mit wenigen Direkttreffern zerstört.

## Steuerung

| Aktion | Maus | Tastatur |
|---|---|---|
| Zielen (Winkel) | Maus-Bewegung | ←/→ bzw. A/D (&nbsp;Shift = fein/8°) |
| Pulvermenge | Mausrad | ↑/↓ bzw. W/S |
| Abfeuern | Button „FEUERN" | Leertaste / Enter |
| Verwaltung | Button „VERWALTEN" | M / Esc(öffnen/schließen) |
| Schnellkäufe in der Verwaltung | Klick | 1=Kugeln, 2=Pulver, 3=Mauer, 4=Turm |
| Turn beenden / weiter | Button | N |
| Aufgeben (2× bestätigen) | Button | Q |
| Trajektorien-Vorschau (optional) | Button | T |

## Modi

- **Einzelspieler gegen Computer** – KI mit 3 Schwierigkeitsgraden
  (Leicht/Mittel/Schwer): beeinflussen Suchraster, Ziel-Fehler (Winkel/Pulver/Wind)
  und Management-Aggressivität.
- **Hot-Seat** – zwei Spieler im Wechsel am selben Rechner.

## Technik

```
src/
├─ main.ts            # Einstieg, Game-Loop (fixed timestep), Bootstrapping
├─ config.ts          # Balance-Werte (Physik, Preise, Terrain, KI)
├─ types.ts
├─ core/              # reine, testbare Logik (kein DOM/Canvas)
│  ├─ ballistics.ts   # Trajektorie: Gravitation + Wind + Terrain-/Gebäudekollision + Rollen
│  ├─ terrain.ts      # Heightmap, Berge, Krater
│  ├─ castle.ts       # Burgmodell (Gebäude, HP, Zielrechtecke)
│  ├─ economy.ts      # Steuern, Bevölkerung, Preise
│  ├─ wind.ts         # Windmodell (Richtung/Stärke, Wechsel)
│  ├─ turn.ts         # Phasenbezeichnungen
│  ├─ game.ts         # Runden, Feuern, Schadensauflösung, Sieg/Niederlage, Verwaltung
│  ├─ rng.ts          # deterministischer Zufallsgenerator (mulberry32)
│  └─ ai.ts           # KI: simulationsbasierte Schusssuche + Management
├─ render/            # Canvas: Welt, Burgen-Sprites, Kugel/Explosionen, Pixel-Font, Palette
├─ ui/                # HUD (DOM), Menüs (Setup/Verwaltung/Sieger), Eingabe
└─ audio/             # synthetische Sounds (Web Audio)
tests/                # Vitest-Unit-Tests für core/
```

**Prinzip:** `core/` ist deterministisch und vollständig testbar (fester Seed).
Rendering/UI konsumieren nur Events und Zustand; die Flug-Ballistik wird beim Feuern
einmal berechnet und die Animation danach starr abgespielt (frame-unabhängig).

**Terrain-Generierung:** Jedes Spiel erzeugt eine neue, zufällige Karte (über den
Seed): Höhe, Breite und Form (spitz bis Tafelgipfel) der beiden Burg-Berge sowie die
Talhöhe variieren, dazu kommen 0–3 niedrige Hügel im offenen Tal. Die Generierung ist
durch Constraints abgesichert (garantiert spielbar): genau zwei hohe Gipfel an den
Kartenrändern, ein niedriger Talkessel dazwischen – ein Schusskorridor existiert auf
jeder Karte (durch Tests verifiziert).

## Entwicklung

```bash
npm install          # Abhängigkeiten
npm run dev          # Dev-Server (Vite, HMR) → http://localhost:5173
npm test             # Vitest (Ballistik, Terrain, Wirtschaft, Runden, KI)
npm run build        # Typprüfung + Produktions-Build nach dist/
npm run preview      # gebauten Stand lokal ansehen
```

## Balance & Referenz

Die Originalwerte (Preise/Physik) sind nicht vollständig dokumentiert – deshalb sind
alle Balance-Werte zentral in `src/config.ts` konfigurierbar. Ausgangswerte:

- Startgeld 500/1000/2000 G (im Setup), Start: 20 Kugeln, 80 Pulver, ~300 Einwohner
- Kugel 4 G, Pulver 5 Einheiten/Gold, Kanone 400 G, Förderturm 300 G, Mauerreparatur 120 G/Abschnitt
- Einkommen: Bevölkerung × Steuersatz (%); Türme +60 G/Runde
- Schusspulververbrauch: Pulvermenge/5 (min. 1)

Feintuning erfolgte empirisch; bei Bedarf einfach in `config.ts` anpassen.

## Offene Punkte / Ideen

- Trajektorien-Vorschau standardmäßig aus (Fixture `T`), wie im Original geplant.
- Optional: Förderturm-Flugbahnen genauer an Originalwerten ausrichten (M6-Feintuning).
- Deployment (GitHub Pages/Netlify) über `npm run build` + `dist/`.