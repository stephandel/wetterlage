# Werkstattbericht Wetterlage – Korrekturlauf 3, 23.10.2026

Grundlage: `FEHLERLISTE-2026-10-23.md`. Ziel: die Funde aus Testlauf 2 beheben. Die Entscheidungen hatte Stephan vorab getroffen.
Stand: Zweig `main`, App 0.9.0, **Build 5**, letzter Commit `8017d4b`. Alles liegt nur lokal: nichts hochgeladen, nichts veröffentlicht.

## Ergebnis in Kürze

- **Behoben:** 30 von 31 bearbeiteten Nummern.
- **Nicht behoben:** Nr. 17, die Windeinheit im Kamera-Studio. Das Studio schreibt fest „km/h“, das kann nur der Baustein ändern.
- **Tests:** 43 Browser-Tests grün (vorher 21), 74 Rechentests grün (vorher 47), Kontrastprüfung grün.
- **Live-Endkontrolle:** mit echten Daten in iPhone-Emulation, hell und dunkel, 124 Fotos. Ich habe jedes angesehen.
- **Zusätzlich gefunden und behoben:**
  - Zwei Zeichenfehler der Karte (Karte über dem Orte-Blatt, Karte über der Kopfleiste).
  - Vier Funde des Opus-Prüfers.

## Geändert

| Commit | Inhalt (Nummern) |
|---|---|
| `a31b1c8` | **Kopfleiste und Vollbild (Paket A + D)** |
| | Kopfleiste fest (`position: fixed`), echte Höhe gemessen (`--kopf-ist`) (5, 6) |
| | deckender Streifen in Safe-Area-Höhe, `overscroll-behavior: none` an html und body (5, 6) |
| | Kopf- und Tab-Leiste zu 85 % deckend (6, 31) |
| | Seitenverlauf beginnt erst unter dem Kopf (7) |
| | „Immer im Vollbild“ ab Werk aus; „Fertig“ führt zum vorherigen Reiter, ohne Endlosschleife (1) |
| | Graphs: `--mg-haft-unten` und `--mg-haft-oben` gesetzt (2, 3) |
| | Graphs offline: Hinweis „Offline · Diagramm braucht Netz“ (37) |
| | Studio: `appName: 'Wetterlage'` (16) |
| `7d9f50f` | **Warnung (Paket B)** |
| | Warnkachel als Einzeiler „Stufe 1 von 4 · Windböen · bis Sa. 04:00“, aufklappbar (8) |
| | „x“ blendet aus, die Warnungs-id wird mit Ablaufzeit gemerkt (8) |
| | ⚠️-Knopf in der Kopfleiste, wackelt beim Erscheinen; bei „Bewegung reduzieren“ nur Einblenden (8) |
| | Titel aus `event_de` statt Großbuchstaben (10) |
| | Tipp ohne „Das hilft: Hinweis auf:“ (11) |
| | Dunkelfarben (9) |
| | Querformat in zwei Spalten (33) |
| `8d474d2` | **Module, Teil 1 (Paket C1)** |
| | Meteogramm-Kachel volle Breite, Tipp auf die Kachel öffnet Graphs (12, 14) |
| | Regen-Satz und „Trocken bis“ aus denselben 15-Minuten-Daten, Balken 40 px (19, 20) |
| | Luft-Ampel Gut ≤ 40, Mäßig ≤ 80 (21) |
| | Luft ab Tag 6 leer, Fußnote „Luftwerte 5 Tage“ (22) |
| | Wind: Rose und Werte nebeneinander (25) |
| | Sonne: Leerstreifen weg (26) |
| | Mond: Lichtseite getönt, Auf- und Untergang nach Uhrzeit sortiert (27) |
| | Pollen: 1, 2 oder 3 Punkte (28) |
| | Gezeiten „(morgen)“ (29) |
| | Warnung dunkel: Kachelfläche plus Streifen und Dreieck in Warnfarbe (9) |
| | Test „Höhen-Budget“ |
| `b8a3d24` | **Module, Teil 2 (Paket C2)** |
| | Aktuell-Kachel 296 → 217 px, ohne doppeltes „Aktuell“, mit Böen (23) |
| | Stunden-Kachel 242 → 187 px (24) |
| | „Stand … Ortszeit“, wenn die Zeitzone des Orts von der des Geräts abweicht (30) |
| | Ortssuche: Deutschland zuerst, dann Europa (39) |
| | Zeitzone aus `forecast.timezone` (41) |
| `0a06801` | Build 4; neue Datei `KONFIGURATOR-WUENSCHE.md` |
| `a39641b` | **Eigener Fund (Live-Endkontrolle):** Im Reiter Karten lag die Karte sichtbar über dem Orte-Blatt, die Suchtreffer waren verdeckt. Lösung: Karte verbergen, solange ein Blatt offen ist. |
| `d59221b` | **Funde des Opus-Prüfers (Paket E)**, siehe unten |
| | Harte px-Werte durch Variablen ersetzt |
| | Rand-Pfeil im Meteogramm 44 px groß |
| `70b45bf` | Build 5 |
| `8017d4b` | **Eigener Fund (Live-Endkontrolle):** Im Reiter Karten malte WebKit die Karte beim Scrollen über die Kopfleiste (Ortsname verdeckt). Lösung: eigene Stapelebene für `#karte`. |

Bausteine unverändert: `git diff 5c1b0fe` über meteogramm.js/.css, bausteine-einbau.js, lib/, tokens.css, base.css, symbole.js und ikonen.js ergibt 0 Zeilen.

**Bewusste Abweichung von DESIGN.md:**
- **Regel 22:** Kopf- und Tab-Leiste sind 85 % deckend statt 61 % (Wunsch Stephan, Nr. 6/31). In app.css kommentiert.
- **Warnung:** Sie ist ein Einzeiler und lässt sich ausblenden, obwohl Regel 35 „Warnung groß, voller Text“ verlangt (Entscheidung Nr. 8).
- **Meteogramm-Kachel:** Sie ist voll breit statt „klein“.

## Geprüft

- **Tests:**
  - `npm test`: 43 von 43 grün.
  - `node tests/module.test.js`: 74 bestanden, 0 fehlgeschlagen.
  - `node tools/kontrast.js`: alle Paare erreichen den Mindestwert. Dazu gehören neu die Leistenfarbe 85 %, das ⚠️-Symbol je Stufe (≥ 3:1), der Mond-Umriss und die Pollenpunkte.
- **Vorher rot:** Jeder Helfer hat für seine neuen Tests die rote Ausgabe vor der Korrektur belegt.
- **Ausnahme Test 20 (Karte über Blatt und Kopfleiste):** Er war mit Testdaten nicht rot zu bekommen, denn der Zeichenfehler tritt nur mit Live-Daten auf. Belegt habe ich ihn per Live-Skript vorher und nachher, mit Foto. Der Test bleibt als Wächter.
- **Live-Endkontrolle:** Skript `endkontrolle.js` im Scratchpad. Es nimmt echte Daten von Open-Meteo, Bright Sky und RainViewer.
  - Emulation: WebKit, 390×844, Faktor 3, isMobile, hasTouch, iOS-Kennung, simulierte Safe Areas 47/34 px, hell und dunkel.
  - Die 124 Fotos liegen in `pruefung/lauf3/`, ich habe alle selbst angesehen. Die Messwerte stehen in `pruefung/lauf3/befunde-*.txt`.
- **Geprüfte Zustände:**
  - **Startseite:** ganz durchgescrollt.
  - **Reiter:** jeder Reiter normal.
  - **Vollbild:** ⤢ und zurück bei Graphs, Karten und Rad/Sat. Ergebnis: ⤢ wird getroffen (elementFromPoint), „Fertig“ bleibt im Reiter.
  - **Reiterwechsel ohne Skripthilfe**, nur mit Tippen auf die Tab-Leiste, ohne „Fertig“:
    - Graphs → Rad/Sat → Karten → Graphs → Mehr klappt.
    - Der Schalter „Immer im Vollbild“ steht ab Werk aus.
  - **Warnung:** echte DWD-Warnung Windböen Stufe 1, in allen Zuständen:
    - zugeklappt und aufgeklappt
    - weggeklickt: ⚠️ erscheint in der Kopfleiste
    - nach Neuladen: Kachel weiter weg, ⚠️ weiter da
    - Tipp auf ⚠️: Kachel kommt aufgeklappt zurück, ⚠️ verschwindet
  - **Ortswechsel auf Corralejo:**
    - „Stand 14:54 Ortszeit“
    - „Ebbe um 18:02 Uhr, Flut um 00:15 Uhr (morgen)“
    - Karten zeigen Fuerteventura
  - **Ortssuche „Hamburg“:** Deutschland zuerst, dann Schweden, dann USA.
  - **Querformat** 844×390.
  - **Große Schrift:** 130 % und 150 %, jeweils kein seitliches Scrollen.
  - **Offline:**
    - Kopfzeile „Offline · Stand 15:55“
    - Graphs mit Hinweis „Offline · Diagramm braucht Netz“
    - Karten und Rad/Sat mit Hinweis
    - Mehr bedienbar
- **Verdeckungsprüfung** (elementFromPoint für alle sichtbaren Bedienelemente): in allen Reitern, im Vollbild, im Querformat, bei 130 und 150 %, hell und dunkel. Kein verdecktes Element.
- **Text-Konsistenz Regenradar (live):**
  - Mannheim: „Regen ab 16:15 Uhr für 15 Minuten“. Dazu passen die Balken (Regen bei +15 und +45 min) und keine zweite Zeile, also kein Widerspruch.
  - Corralejo: „Die nächsten 2 Stunden bleibt es trocken“.
- **Höhen-Budget (live, Mannheim, 390×844, px):**

  | Kachel | 100 % | 130 % | 150 % |
  |---|---|---|---|
  | Warnung (zu) | 54 | 68 | 76 |
  | Aktuell | 217 | 373 | 497 |
  | Stunden | 187 | 278 | 633 |
  | Meteogramm | 294 | 294 | 294 |
  | Tagesliste | **426** | 768 | **979** |
  | Luft | 179 | 230 | 380 |
  | Was heute geht | 159 | 202 | 262 |
  | Sonne | 286 | 340 | 366 |
  | Mond | 249 | 354 | 434 |
  | Wind | 342 | 575 | 814 |
  | Regenradar | 410 | 503 | 531 |
  | Pollen | 343 | 358 | 367 |

  Grenze bei 100 % ist 422 px. Live liegt die Tagesliste mit 426 px um 4 px darüber; mit den Testdaten sind es 419 px. Bei 150 % liegt sie mit 979 px über einer Bildschirmhöhe; diese Ausnahme ist im Test benannt. Alle anderen Kacheln halten das Budget.

## Zweite Meinung (Opus-Prüfer) – was widerlegt wurde und wie behoben

Der Prüfer bekam 16 Behauptungen mit Belegstelle (datei:zeile) und den Auftrag, sie zu widerlegen. 12 hielten. Widerlegt oder mit echtem Fund:

1. **Zeitumstellung (Nr. 41) – teilweise widerlegt.**
   - Fehler: Open-Meteo rechnet die ganze Antwort mit einem festen Abstand zu UTC. Die Änderung aus Paket C2 setzte nach der Umstellung 3600 s ein. Bei Daten von vor der Umstellung (vor allem offline) wären „jetzt“, Stunden und Regen-Satz dadurch um 1 h verrutscht.
   - Behoben (d59221b): Zeitangaben der Antwort deuten wieder mit dem festen Abstand der Antwort. Echte Zeitpunkte nehmen den Abstand der Zeitzone zum Zeitpunkt des Ereignisses: Stand, Warnzeiten, Mond, Gezeiten, Radarbild.
   - Dabei behoben: Ein Warnungsende nach der Umstellung erschien eine Stunde zu spät. Die Gezeiten haben einen eigenen Abstand zur Ortszeit.
2. **Meteogramm-Kachel – teilweise widerlegt (neuer Fehler aus Paket C1).**
   - Fehler: Jeder Klick in der Kachel öffnete Graphs, auch die Knöpfe des Bausteins (Rand-Pfeil, auch per Enter).
   - Behoben: Bedienelemente werden nicht mehr abgefangen. Der Rand-Pfeil hat jetzt 44 px Tippfläche (vorher 36).
3. **Warntitel falsch gebeugt.**
   - Fehler: „Warnung vor Starkes gewitter“, „Orkanartige böen“.
   - Behoben: eine Tabelle mit 35 DWD-Ereignisnamen in Nominativ und Dativ, z. B. „Warnung vor starkem Gewitter“. Unbekannte Namen erscheinen als „Wetterwarnung: …“.
4. **Kleinere Funde, behoben:**
   - Ohne Regendaten stand „bleibt trocken“; jetzt „Für die nächsten 2 Stunden liegen keine Regendaten vor“.
   - Daten älter als 24 h zeigen den Wochentag beim „Stand“.
   - Abgelaufene ausgeblendete Warnungen werden schon beim Laden aufgeräumt.
   - Harte px-Werte in module.css und app.css sind durch Variablen ersetzt.

Fehlalarm verworfen: Eine „zweite Blatt-Ebene“ bei „immer im Vollbild“ lässt sich nur per Skript erzeugen, weil die Tab-Leiste dann gesperrt ist.

## Abnahmeliste (bearbeitete Nummern der Fehlerliste)

| Nr. | Punkt | ja / nein / nicht geprüft |
|---|---|---|
| 1 | Vollbild ab Werk aus, Reiterwechsel ohne „Fertig“, „Fertig“ → vorheriger Reiter | ja (live; „immer an“ per Test 14) |
| 2 | Graphs: ⤢ und Knopfleiste tippbar | ja (live, elementFromPoint) |
| 3 | Graphs: Datumsfahne nicht über der Kopfleiste | ja (live, Foto gescrollt) |
| 5 | Ortsname auf dem iPhone nicht verwaschen | nicht geprüft (nur auf dem iPhone sichtbar; Streifen gebaut, Namenszeile nicht tiefergesetzt, weil nicht beauftragt) |
| 6 | Kopfleiste fest, Inhalt scheint kaum durch | ja in der Emulation; Gummiband-Ziehen nur auf dem iPhone prüfbar |
| 7 | Kein Verlauf hinter der Kopfleiste | ja |
| 8 | Warnung als Einzeiler, ausblendbar, ⚠️ in der Kopfleiste | ja (live, alle Zustände); Wackeln nur per Test (Keyframes), nicht gesehen |
| 9 | Warnfarben dunkel klar als Warnung | ja (Streifen und Dreieck in Warnfarbe, Kontrast geprüft); Stufe 2–4 nur per Kontrastpaar, kein Foto |
| 10 | Titel ohne Großbuchstaben, richtig gebeugt | ja |
| 11 | Tipp ohne doppeltes Präfix, Abstände | ja |
| 12 | Meteogramm-Kachel volle Breite | ja; 48 h passen weiter nicht hinein (Baustein, Konfigurator-Wunsch) |
| 14 | Tipp auf die Kachel öffnet Graphs | ja (Test; Wischen per Maus geprüft, mit echtem Finger nicht geprüft) |
| 16 | Studio-Logo „Wetterlage“ | ja per Test und Codeweg; das fertige Bild habe ich nicht angesehen |
| 17 | Studio-Wind in gewählter Einheit | **nein** (Studio schreibt fest km/h; Wunsch an den Konfigurator) |
| 19 | Regen-Satz und Zeile widerspruchsfrei | ja (Test und live) |
| 20 | Keine Leerfläche im Regenradar | ja |
| 21 | Luft-Ampel Gut ≤ 40 | ja (live „26 Gut“) |
| 22 | Luft ab Tag 6 leer mit Fußnote | ja |
| 23 | Aktuell wie Vorschau | ja, mit Abweichungen: Symbol kleiner, ohne „mm/h“ neben der Zahl, zusätzlich „Regen heute“ |
| 24 | Stunden kompakter | ja (187 px) |
| 25 | Wind kompakter | ja (556 → 342 px) |
| 26 | Sonne ohne Leerstreifen | ja |
| 27 | Mond hell sichtbar, Zeiten sortiert | ja |
| 28 | Pollen 1/2/3 Punkte, dunkel sichtbar | ja (leere Punkte im Foto; gefüllte nur per Test, live heute keine Pollen) |
| 29 | Gezeiten „(morgen)“ | ja (live Corralejo) |
| 30 | „Ortszeit“ bei anderer Zeitzone | ja (live Corralejo) |
| 31 | Tab-Leiste lesbar | ja in der Emulation; Glas-Wirkung nur auf dem iPhone prüfbar |
| 33 | Querformat zweispaltig, linke Spalte gefüllt | ja |
| 37 | Graphs offline mit Hinweis statt Fehlermeldung | ja (live) |
| 39 | Ortssuche Deutschland/Europa zuerst | ja (live „Hamburg“) |
| 41 | Zeitumstellung 25.10. | ja per Rechentests; die echte Umstellung kommt erst am Sonntag – **nicht live geprüft** |
| – | Höhen-Budget 100 % ≤ 50 % Bildschirm | **nein, knapp**: Tagesliste live 426 px statt ≤ 422 |
| – | Höhen-Budget 150 % ≤ 100 % Bildschirm | nein für die Tagesliste (979 px, benannte Ausnahme), sonst ja |
| – | Verdeckungsprüfung aller Reiter | ja |
| – | Bausteine unverändert | ja |

## Offen

- **Nur auf dem iPhone prüfbar:**
  - Ist der Ortsname unter der Statusleiste jetzt scharf (Nr. 5)?
  - Gummiband-Ziehen.
  - Glas-Unschärfe der Leisten (in WebKit-Fotos nicht sichtbar).
  - Echte Safe Areas.
  - Dynamic Type über die iPhone-Einstellung.
  - Wackeln des ⚠️-Knopfs und VoiceOver-Ansage.
  - Wischen und Tippen in der Meteogramm-Kachel mit dem Finger.
  - Das fertige Studio-Bild mit „Wetterlage“-Logo.
- **Sonntag, 25.10. (Zeitumstellung):** einmal früh die App öffnen und „Stand“ mit der Uhr vergleichen.
- **Bekannte Lücken:**
  - Die Tagesliste ist live 4 px über dem Höhen-Budget bei 100 % und bei 150 % zu hoch.
  - Offline zeigt die Meteogramm-Kachel der Startseite nur eine leere Fläche ohne Hinweis.
  - Im Querformat steht im Diagramm noch „Do 22.10.“ (Nr. 13, Baustein).
  - Studio-Einheiten (Nr. 17).
- **Wünsche an den Konfigurator:** in `KONFIGURATOR-WUENSCHE.md` (Nr. 4, 13, 15, 17, 34, 35, 36, 40, Vollbild-Vorgabe aus, Modulgröße Meteogramm „mittel“, Stundenabstand der kleinen Kachel).
- **Warnung Stufe 3/4:** Die Fehlerliste empfahl, sie nicht ausblendbar zu machen. Der Auftrag nannte keine Ausnahme, darum sind alle Stufen ausblendbar. Eine neue Warnung (andere id) erscheint wieder. Bitte bei Bedarf entscheiden.
- `FEHLERLISTE-2026-10-23.md` ist noch nicht im Git (nicht von mir angelegt, nicht hinzugefügt).
- **Hochladen:** nur mit Stephans Okay. Danach den Service Worker auf GitHub Pages prüfen (Build 5).
