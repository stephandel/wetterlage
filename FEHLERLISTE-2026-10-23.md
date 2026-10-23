# Fehlerliste Wetterlage – Testlauf 2, 23.10.2026

Stand: App 0.9.0, Build 3, Zweig `main`. Die Online-Fassung und der lokale Stand sind byte-gleich (geprüft per md5). Getestet wurde live auf https://stephandel.github.io/wetterlage/ zwischen 13:20 und 13:40 Uhr mit echten Daten und zusätzlich lokal mit aufgezeichneten Daten.
Gerät: Playwright 1.64 mit WebKit, iPhone 390 × 844 bei Faktor 3, Touch und iOS-Kennung, jeweils hell und dunkel. Dazu Querformat 844 × 390, Schrift 130 % und 150 %, Offline, Gerätezeitzonen Berlin, Kanaren und New York.
Geprüft haben vier Helfer (Sonnet) und die Testleitung (Opus). Die wichtigsten Fotos hat die Testleitung selbst angesehen und dabei Stephans zwei iPhone-Fotos gegengeprüft.
**An der App wurde nichts geändert.** Fotos: `pruefung/test2/` (kurz **T2/**). Achtung: `pruefung/` steht in `.gitignore`. Die Fotos liegen also nur auf diesem Rechner.

Schwere: **blockierend** (Funktion geht nicht oder man sitzt fest) · **störend** (fällt sofort auf, wirkt falsch) · **Schönheit**.
Die Prüfumgebung kann einiges nicht nachstellen: echte Statusleiste, Safe Areas, iOS-Glas-Unschärfe, Gummiband-Scrollen, installierte PWA. Solche Punkte sind mit **(iPhone)** markiert und nur auf dem echten Gerät endgültig prüfbar.

---

## A. Stephans vier Beobachtungen – Analyse

### A1. Kopfleiste „nicht fest“, Ortsname verwaschen
- **Ist:** In der Emulation ist „Mannheim“ gestochen scharf (T2/kopf-dark-safe47.png). Auf Stephans Foto ist nur ein Streifen von etwa 47 bis 78 pt verwaschen (pt = Bildpunkte auf dem iPhone-Bildschirm). Der Streifen beginnt direkt unter der Statusleiste und trifft genau den Ortsnamen (55–72 pt). „Stand 12:47“ darunter (79–91 pt) ist scharf. Am Seitenanfang und gescrollt sieht der Streifen gleich aus. Er hängt also nicht vom Inhalt dahinter ab.
- **Wahrscheinlichste Ursache (iPhone):** iOS legt bei `viewport-fit=cover` und `apple-mobile-web-app-status-bar-style: black-translucent` (index.html:5, :14) einen eigenen weichen Verlauf unter die Statusleiste, den „Scroll-Edge-Effekt“. Dieser Verlauf reicht in die erste Zeile der Kopfleiste hinein. Der Glas-Filter der Kopfleiste kommt als Ursache nicht in Frage, denn er macht nur den Hintergrund unscharf, nie den eigenen Text. Auch Schrift-Rendering scheidet aus, denn „Stand“ hat dieselbe Schrift und ist scharf. Die Ursache ist erschlossen, nicht bewiesen.
- **„Nicht fest“:** Die Leiste ist `position: sticky` (app.css:47) und hängt damit am normalen Seiten-Scrollen. `overscroll-behavior` steht nur am `body` (base.css:81), am `html` steht es auf `auto`. Beim Gummiband-Ziehen über den Anfang hinaus wandert die Leiste deshalb mit (iPhone). Dazu kommt: Die Glasfläche deckt nur 61 % (tokens.css `--glas-bg`). Beim Scrollen scheinen die Kacheln durch, z. B. die gelbe Warnfläche hinter „Mannheim“ (T2/start-live-hell-aktuell-vor.png).
- **Farbverlauf:** Oben im Kopf liegt der feste Seitenverlauf `--akzent-tint → --bg` (app.css:36-39). Dunkel geht er von oliv-braun nach blau. Hinter dem Glas wirkt das wie ein schmutziger Verlauf. Die Vorschau hat dort eine ruhige, fast deckende Fläche.
- **Lösung ohne Tricks:**
  1. Unter der Statusleiste einen deckenden Streifen in Höhe der Safe Area anlegen (`--bg-2`), erst darunter Glas.
  2. Die Namenszeile 12–16 px tiefer setzen.
  3. Die Kopfleiste auf `position: fixed` umstellen, den Inhalt mit `padding-top` versehen und `overscroll-behavior: none` auch an `html` setzen.
  4. Die Kopfleiste deckender machen (z. B. 85–90 %). Das weicht von Regel 22 ab (61 %).

  Danach auf dem iPhone prüfen.

### A2. Warnkachel zu groß
- **Ist:** Die Kachel zeigt immer Titel, den ganzen DWD-Text und den Verhaltenstipp, alles ausgeklappt (module.js:336-359). Die gemessene Höhe:

  | Schrift | Höhe | Anteil am Bildschirm |
  |---|---|---|
  | 100 % | 405 px | 48 % |
  | 130 % | 698 px | 83 % |
  | 150 % | 872 px | 103 % |

  Bei 150 % ist die Kachel höher als der Bildschirm. Im Querformat füllt sie fast alles (T2/quer-light-1.png). Die Vorschau zeigt eine kompakte Kachel mit Symbol, Titel und Stufe in einer Zeile und drei Zeilen Text.
- **Was für Stephans Lösung nötig ist:**
  1. **Einzeiler** mit Stufe als Wort und Art, z. B. „Wetterwarnung Stufe 1 · Windböen bis Sa. 4 Uhr“, dazu ein Pfeil. Er klappt per Tipp auf (`aria-expanded`) und ist mindestens 44 px hoch.
  2. **Aufgeklappt** zeigt er Text, Tipp und Quelle sowie einen Knopf „x“ (44 × 44 px, `aria-label` „Warnung ausblenden“).
  3. **Nach „x“** merkt sich die App die Warnungs-ID aus Bright Sky (`id`/`alert_id`) in localStorage. Die Kachel verschwindet, und in der Kopfleiste erscheint ein ⚠️-Knopf zwischen Menü und Ortsname. Ein Tipp auf den Knopf öffnet die Warnung wieder. Eine neue ID zeigt die Kachel wieder an. Abgelaufene IDs (`expires`) räumt die App auf.
  4. **Wackeln** nur beim ersten Erscheinen, 1–2 Pendelbewegungen mit `transform: rotate()` (Regel 20: nur transform/opacity). Bei `prefers-reduced-motion` nur Einblenden mit opacity, höchstens 200 ms. Das Erscheinen wird über `aria-live="polite"` angesagt.
  5. **Farbe des Symbols je Stufe** mit mindestens 3:1 Kontrast. Die Stufe steht zusätzlich als Wort im `aria-label`, nie nur als Farbe.
  6. **Platz:** Die Kopfleiste hat heute die Spalten 44 | 230 | 44 | 44 px. Mit dem ⚠️-Knopf bleiben für den Ortsnamen 182 px. „Mengerschied“ wird dann schon ab 130 % gekürzt (203 px > 182), ohne Knopf erst ab 150 %. „Mannheim“ und „Corralejo“ passen immer. Die Kürzung mit „…“ ist nach DESIGN.md erlaubt.
- **Konflikte mit DESIGN.md (Stephan entscheidet):**
  - Regel 35 und die Modultabelle: „Warnung groß, volle Breite, Warntext mit Verhaltenstipp“.
  - Die Kopfleiste nach Regel 35 kennt kein Warnsymbol.
  - **Sicherheitsfrage:** Sollen Stufe 3 und 4 (Unwetter, extremes Unwetter) wegklickbar sein? Empfehlung: nein, oder bei höherer Stufe neu einblenden.
  - Ab wann kommt eine weggeklickte Warnung zurück: bei neuer Warnung, bei höherer Stufe oder nach 24 h?

### A3. Meteogramm-Kachel halb breit, unbrauchbar, „Do 22.10.“
- **Breite:** Die App folgt wörtlich DESIGN.md: Regel 32, Modultabelle Nr. 4 „klein = 1 von 2 Spalten, eine kleine Kachel ohne Partner bleibt halb breit“ (module.js:413, module.css:45). Die Konfigurator-Einstellung hat ebenfalls `"meteogramm","groesse":"klein"` (Link in PRUEFAUFTRAG.md). **Die Vorschau zeigt die Kachel dagegen in voller Breite** (pruefung/vorschau-wetter-iphone-*.png). Der erste Bau hat diesen Widerspruch bemerkt, nach DESIGN.md entschieden und im Bericht nur als „Entscheiden:“ vermerkt (BERICHT-2026-10-23.md, Widerspruch 3).
- **Folgen bei halber Breite:**
  - Das Diagramm ist 152 px breit und zeigt bei 18 px pro Stunde knapp 8 Stunden statt „48 Stunden mit Spanne“. Rechts daneben bleibt eine leere Fläche.
  - Der Knopf (⊙ ›) liegt über der Linie, die Achsenzahl „10/12“ steckt hinter dem Wertekasten „14“, der „Jetzt“-Strich läuft durch „Temperatur in °C“, und die Zeitachse ist abgeschnitten („:00“, „1“).

  Belege: Stephans Foto, T2/start-live-hell-m-meteogramm.png. Auch bei voller Breite (≈ 358 px) wären es nur etwa 19 Stunden. Die 48 Stunden schafft der Baustein nur, wenn er einen kleineren Stundenabstand bekommt (meteogramm.js:619 `pxH`), und das geht nur über den Konfigurator.
- **„Do 22.10.“ am Fr 23.10.:** Die Daten sind richtig. Falsch ist nur die Beschriftung links oben.
  - Der Baustein lädt einen Tag Vergangenheit (meteogramm.js:230 `TAGE_VORHER=1`).
  - Die Beschriftung zeigt den Tag **am linken Rand des sichtbaren Ausschnitts** (meteogramm.js:923-931). Bei Scrollstand 0 heißt sie „Do 22.10.“, beim richtigen Stand um „Jetzt“ „Heute“. Nachgestellt in T2/start-live-dunkel-m-meteogramm-links.png.
  - In Stephans Foto ist der Inhalt richtig um „Jetzt“ zentriert (12:00 steht links neben dem Strich, ↑16° rechts). Das Etikett ist also **veraltet**: Es wurde berechnet, als der Ausschnitt noch bei 0 stand, und danach nicht nachgeführt.
  - In vier Läufen in der Emulation stand immer korrekt „Heute“. Ursache (iPhone, Vermutung): Das Zentrieren läuft dort ohne nachfolgendes `scroll`-Ereignis. Mögliche Auslöser sind das Rückkehren in die App oder das Zentrieren, während die Kachel gemessen wird.
  - Der Fehler kann auch außerhalb des iPhones auftreten. Im Querformat-Vollbild von Graphs stand ebenfalls „Do 22.10.“ (T2/vollbild-s6-quer-graphs.png).
  - Behebung im Baustein: das Etikett am „Jetzt“-Strich ausrichten oder nach dem Zentrieren neu berechnen. Das geht über den Konfigurator, nicht in app.js.
- **Antippen:** DESIGN.md sagt „Antippen öffnet den Reiter Graphs“. Ein Tipp aufs Diagramm tut nichts, nur der Chip „Graphs öffnen“ wirkt.

### A4. „Immer im Vollbild“ funktioniert so nicht
**Was Stephan erlebt.** Der Schalter steht ab Werk auf AN (bausteine-einbau.js:32 `VOLLBILD_IMMER = true`). Belegt in der Emulation, Fotos T2/vollbild-s1-*.png und vollbild-live-*.png:
1. Tipp auf „Graphs“: Sofort legt sich ein Blatt über den **ganzen** Bildschirm. Kopfleiste und Tab-Leiste sind verdeckt und gesperrt (`inert`). Ein Tipp auf die Mitte der Tab-Leiste trifft das Blatt. Oben steht „Quer drehen zeigt mehr Stunden“ bzw. „Meteogramm“, **kein Ortsname**, rechts „Fertig“.
2. Es gibt keinen direkten Weg zu Karten, Rad/Sat, Mehr oder zum Orte-Knopf. Nur „Fertig“ führt heraus, und zwar **immer auf die Startseite**, auch wenn man von Karten kam (app.js:530-532 zwingt bei Baustein-Reitern `ziel = 'wetter'`).
3. Ein Wechsel Graphs → Rad/Sat kostet „Fertig“, dann Startseite, dann Tab. Der Ortswechsel geht nur über „Fertig“, dann Orte, dann wieder Tab.
4. Mechanisch läuft alles: Fertig, Esc und Zurück schließen das Blatt, ein zweiter Tipp öffnet es wieder. Es gibt kein Doppel-Blatt, die Karte hat nicht 0 px, und das Scrollen wird wieder freigegeben. Querformat ist in Ordnung.

**Was nicht stimmt:**
- Das Blatt der Bausteine ist ein Modal, also ein Fenster, das die ganze App überdeckt (meteogramm.css:100, wpkarte.css:87 `position: fixed; inset: 0; z-index: 90` über der Tab-Leiste mit z-index 30; meteogramm.js:1812-1827 und wpkarte.js:671-707 sperren alle Geschwister). Als Dauerzustand eines Reiters fühlt sich das an wie „Tab-Leiste weg, ich sitze fest“.
- Im Blatt fehlt der Ortsname. Die Option `vollbildTitel` gibt es (meteogramm.js:186, wpkarte.js:226), bausteine-einbau.js reicht sie aber nicht durch.
- **Schaltet man den Schalter aus**, ist die Normalansicht von Graphs kaputt:
  - Die Knopfleiste des Diagramms (Auffrischen, Kontrast, ‹ Jetzt ›, ⤢, Menü) klebt unten **unter** der Tab-Leiste. Beide liegen übereinander, und ein Tipp auf ⤢ trifft den Tab „Rad/Sat“ (T2/normal-graphs-hell.png, von der Testleitung angesehen; meteogramm.css:92 `--mg-haft-unten: 0`).
  - Beim Scrollen schiebt sich die haftende Fahne „23.10. · 13:30 jetzt“ über die Kopfleiste (T2/normal-graphs-hell-scroll.png; meteogramm.css:62 `--mg-haft-oben: 0`).
- **Empfehlung:**
  1. Vorgabe „immer im Vollbild“ auf AUS stellen. Das geht über den Konfigurator, weil bausteine-einbau.js nicht von Hand geändert werden soll.
  2. In app.css `#graphs { --mg-haft-unten: calc(var(--leiste-hoehe) + var(--tabbar-unten)); --mg-haft-oben: calc(var(--kopf-hoehe) + var(--safe-top)); }` setzen. Das ist aus dem Code abgeleitet und noch nicht getestet.
  3. Den Ortsnamen im Blatt-Titel beim Konfigurator bestellen.

  Wer Vollbild als Dauerzustand will, braucht ein Blatt, das die Tab-Leiste frei lässt. Das wäre eine Änderung am Baustein.

---

## B. Fehlerliste

| Nr | Bereich | Fund | Schwere | Beleg | Ursache | Vorschlag | Aufwand | Entscheidung Stephan? |
|---|---|---|---|---|---|---|---|---|
| 1 | Vollbild (Graphs, Karten, Rad/Sat) | Mit „immer im Vollbild“ (Werkseinstellung) verschwinden Tab-Leiste und Kopfleiste. Man kommt nur über „Fertig“ heraus und landet immer auf der Startseite. | blockierend (Bedienung) | T2/vollbild-s1-01-graphs-blatt.png, -02-nach-fertig.png, vollbild-s2-graphs-zu-radsat.png; bausteine-einbau.js:32; app.js:530-532 | Blatt-Modal des Bausteins als Dauerzustand | Vorgabe AUS (Konfigurator); „Fertig“ zum zuletzt benutzten Reiter statt Startseite (app.js) | klein | ja: Vollbild-Dauer ja/nein |
| 2 | Graphs normal | Die Knopfleiste des Diagramms liegt unter der Tab-Leiste. ⤢ und „Jetzt“ sind nicht tippbar, der Tipp trifft „Rad/Sat“. | blockierend | T2/normal-graphs-hell.png, -dunkel.png; meteogramm.css:25, :92 | `--mg-haft-unten` bleibt 0, die Tab-Leiste schwebt darüber | app.css: `#graphs { --mg-haft-unten: … }` (siehe A4) | klein | nein |
| 3 | Graphs normal | Beim Scrollen schiebt sich die Datumsfahne des Diagramms über „Mannheim / Stand“. | störend | T2/normal-graphs-hell-scroll.png, -dunkel-scroll.png; meteogramm.css:22, :62 | `--mg-haft-oben` kennt die App-Kopfleiste nicht | app.css: `--mg-haft-oben` setzen | klein | nein |
| 4 | Vollbild-Blatt | Im Blatt steht nirgends der Ort, nur „Meteogramm“ oder „Quer drehen zeigt mehr Stunden“. | störend | T2/vollbild-live-graphs-01-blatt.png, vollbild-s4-graphs-mengerschied.png; bausteine-einbau.js:50-54, :103-108 | `vollbildTitel` wird nicht übergeben | Wunsch an den Konfigurator: Titel „Graphs · Mannheim“ | klein | nein |
| 5 | Kopfleiste | Der Ortsname ist auf dem iPhone verwaschen. Nur der Streifen direkt unter der Statusleiste ist betroffen. | störend | Stephans Fotos; T2/kopf-dark-safe47.png (Emulation scharf); index.html:5, :14 | vermutlich iOS-Verlauf unter der Statusleiste (iPhone) | deckender Streifen in Safe-Area-Höhe, Namenszeile tiefer (A1) | klein | nein |
| 6 | Kopfleiste | Die Leiste wirkt „nicht fest“: Sie wandert beim Überziehen mit, und der Inhalt scheint durch. | störend | app.css:47 (sticky); base.css:81; tokens.css `--glas-bg` 61 %; T2/start-live-hell-aktuell-vor.png | sticky im Seiten-Scroll, Glas nur 61 % deckend (iPhone) | `position: fixed`, `overscroll-behavior: none` an html, Kopf deckender | klein–mittel | ja: weniger Glas als Regel 22 |
| 7 | Kopfleiste | Der Seitenverlauf (dunkel oliv → blau) liegt hinter dem Glas der Kopfleiste und wirkt schmutzig. Die Vorschau zeigt eine ruhige Fläche. | Schönheit | Stephans Foto 1; app.css:36-39 | `--akzent-tint` oben im Verlauf | Kopf mit deckender `--bg-2`-Fläche | klein | nein |
| 8 | Warnung | Die Kachel nimmt 48 % (100 %), 83 % (130 %) und 103 % (150 %) des Bildschirms ein. „Aktuell“ rutscht aus dem Blick. | störend | T2/warnung-live-dark-100/130/150.png, quer-light-1.png; module.js:336-359 | ganzer DWD-Text immer ausgeklappt | Einzeiler zum Aufklappen, ⚠️ in der Kopfleiste (A2) | mittel | ja: Abweichung von DESIGN.md, Wegklicken bei Stufe 3/4 |
| 9 | Warnung | Im Dunkelmodus ist Stufe 1 olivgrün und Stufe 2 braungrau. Das sieht nicht nach Warnung aus. | störend | T2/start-fix-warnung-minor-dark.png, -moderate-dark.png; module.css:26-35 | nur 30 % Warnfarbe auf der Kachel | mehr Farbanteil oder farbiger Rand/Streifen, Kontrast neu prüfen | klein | nein |
| 10 | Warnung | Der Titel steht in Großbuchstaben („Amtliche WARNUNG vor WINDBÖEN“). DESIGN.md verbietet das. | Schönheit | module.js:347 | `headline_de` ungefiltert | Titel aus `event_de` bauen: „Warnung vor Windböen“ | klein | nein |
| 11 | Warnung | „Das hilft: Hinweis auf: … Handlungsempfehlungen: …“ klingt doppelt. Titel, Zeitraum und Text kleben ohne Abstand aneinander. | Schönheit | module.js:350; T2/start-fix-warnung-moderate-dark.png | Präfix vor einem Quelltext, der schon gegliedert ist | Präfix weg oder Quelltext zerlegen, Abstände `--s1`/`--s2` | klein | nein |
| 12 | Meteogramm-Kachel | Die Kachel ist halb breit, zeigt nur etwa 8 Stunden statt 48, Knopf und Achsen überlappen sich, rechts bleibt Leere. | störend | Stephans Foto 2; T2/start-live-hell-m-meteogramm.png; module.js:413; module.css:45 | DESIGN.md „klein“ wörtlich umgesetzt; die Vorschau zeigt volle Breite | volle Breite (`grid-column: 1 / -1`), DESIGN/Konfigurator auf „mittel“ | klein | ja: volle Breite (Empfehlung: ja) |
| 13 | Meteogramm (Kachel und Graphs) | Links oben steht „Do 22.10.“ statt „Heute“, obwohl der Ausschnitt den Freitag zeigt. | störend | Stephans Foto 2; T2/vollbild-s6-quer-graphs.png, start-live-dunkel-m-meteogramm-links.png; meteogramm.js:923-931 | Etikett aus dem linken Rand berechnet und nach dem Zentrieren nicht nachgeführt (iPhone, Vermutung) | Baustein: Etikett am Jetzt-Strich oder nach dem Zentrieren neu berechnen (Konfigurator) | mittel | nein |
| 14 | Meteogramm-Kachel | Ein Tipp aufs Diagramm öffnet nicht den Reiter Graphs (DESIGN.md verlangt das), nur der Chip wirkt. | Schönheit | T2/start-live-hell-doppeltipp-meteogramm.png | keine Tippfläche über dem Diagramm | Tippfläche wie bei der Radarkarte | klein | nein |
| 15 | Einheiten | Mit °F und mph zeigen Graphs und die Meteogramm-Kachel weiter °C und km/h. Nur die Startseite stellt um. | störend | T2/mehr-einheiten-graphs-ms.png; meteogramm.js:45-55 (Einheiten fest); bausteine-einbau.js ohne Einheiten-Option | Baustein kennt keine Einheitenwahl | Wunsch an den Konfigurator; bis dahin Hinweis unter „Mehr“ | mittel | ja: Konfigurator oder so lassen |
| 16 | Kamera-Studio | Der Wetter-Sticker auf geteilten Fotos trägt das Logo „WETTERPRO“ statt „Wetterlage“. | störend | T2/studio-dark-3-beispiel.png (angesehen); lib/ks-studio.js:190 (Standard „WetterPro“); app.js:431 übergibt kein `appName` | Option `appName` fehlt beim Einbau | `appName: 'Wetterlage'` an `KSStudio.mount` | klein | nein |
| 17 | Kamera-Studio | Der Sticker zeigt Wind in km/h, auch wenn mph gewählt ist (mit mph nicht geprüft). | Schönheit | app.js:400 (`studioWetter`) | Rohwert ohne Einheit | Einheit übergeben, prüfen | klein | nein |
| 18 | Kamera-Studio | Eigene Optik (schwarz, iOS-Blau) statt Gelb/Marineblau der App, also zwei Akzentfarben. | Schönheit | T2/studio-dark-1.png | Studio-Thema | Akzent ans Studio übergeben, falls möglich | klein | ja: Studio-Optik |
| 19 | Regenradar | Oben steht „Regen ab 14:30 Uhr für mindestens 45 Minuten“, darunter „Trocken bis 15 Uhr“. In Mengerschied steht „Regen die nächsten 2 Stunden“ und darunter „Trocken bis 14 Uhr“. | störend | T2/start-live-dunkel-4.png, -5.png, inhalt-Berlin-Mannheim-04/05.png; module.js:37-69 vs. :75-87 | Satz aus 15-Minuten-Werten, Zeile aus Stundenwerten; der Stundenwert gilt rückwirkend | „Trocken bis“ aus denselben 15-Minuten-Werten oder weglassen | klein | nein |
| 20 | Regenradar | Zwischen Satz und Balken liegt eine große leere Fläche. Bei trockenem Wetter wirkt das wie ein Fehler. | Schönheit | T2/start-live-dunkel-4.png; module.css:16 (`--balken-hoehe: 64px`) | feste Balkenhöhe | niedriger (≈ 40 px) | klein | nein |
| 21 | Luftqualität | Fast immer „Mäßig“ (orange), auch bei sehr guter Luft (Index 21–30). Alle Tage der Liste zeigen „Mäßig“. | störend | gemeinsam.js:121-126 (Gut nur ≤ 20); T2/inhalt-Berlin-Mannheim-02.png | eigene, strenge Grenze; der europäische Index nennt 20–40 „annehmbar“ | Gut ≤ 40, Mäßig ≤ 80, Lüften-Rat erst darüber | klein | ja: wie streng die Ampel ist |
| 22 | Tagesliste | Die Spalte Luft zeigt ab Tag 6 nur „–“ (Luftdaten reichen 5 Tage). | Schönheit | T2/start-live-hell-m-tage.png | Datenquelle `forecast_days=5` | Spalte bei fehlenden Daten leer lassen, Fußnote | klein | nein |
| 23 | Aktuell | Weicht von der Vorschau ab: Überschrift „AKTUELL IN MANNHEIM“ plus „Aktuell 12:45“ doppelt, Böen fehlen, rechts unten leer, Kachel 296 statt ≈ 215 px. | störend | Stephans Foto 1; T2/start-live-dunkel-0.png; module.js:384-392; Vorschau | eigene Auslegung von Regel 35 | Doppelung weg, Böen ergänzen, an die Vorschau angleichen | mittel | ja: Vorschau oder heutiger Stand |
| 24 | Stunden | Die Kachel ist doppelt so hoch wie in der Vorschau (zusätzlich Wettertext, Regenrisiko, Wind). Inhalt korrekt im 6-h-Takt. | Schönheit | T2/start-live-dunkel-2.png; Vorschau | „Symbol immer mit Text“ ausgelegt | so lassen oder an die Vorschau angleichen | klein | ja (Geschmack) |
| 25 | Wind | Die Kachel ist 556 px hoch, rechts neben der Windrose ist alles leer. | Schönheit | T2/start-live-dunkel-3.png, -4.png | Rose und Text untereinander | nebeneinander, spart ≈ 150 px | klein | nein |
| 26 | Sonne | Zwischen Bogen und Zeiten liegt ein leerer Streifen von ≈ 50 px. | Schönheit | T2/start-live-dunkel-3.png | Abstände | verdichten | klein | nein |
| 27 | Mond | Im Hellmodus ist die Mondscheibe fast weiß auf fast weißer Kachel, die Phase ist kaum erkennbar. Auf- und Untergang stehen in verwirrender Reihenfolge (16:57 auf, 04:33 unter). | Schönheit | T2/start-live-hell-m-mond.png, inhalt-Berlin-Corralejo-03.png; module.js:216-223 | Farbe; Reihenfolge nicht nach Uhrzeit | Lichtseite getönt plus Umriss; nach Zeit sortieren oder „früh“ dazuschreiben | klein | nein |
| 28 | Pollen | Die Punkte springen von 2 auf 4 (keine 3-Punkte-Stufe). Die Punkte sind dunkel kaum sichtbar. | Schönheit | module.js:543; T2/start-live-dunkel-5.png | `stufe === 3 ? 4 : stufe` | 1/2/3 Punkte für gering/mäßig/stark | klein | nein |
| 29 | Was heute geht (Küste) | Corralejo zeigt „Flut um 00:15 Uhr“, das ist schon morgen, ohne Hinweis. | Schönheit | T2/inhalt-Berlin-Corralejo-02.png; module.js:236-251 | wertet 24 h statt bis Mitternacht | nach Mitternacht weglassen oder „morgen“ dazuschreiben | klein | nein |
| 30 | Corralejo | Alle Zeiten stimmen in Ortszeit (1 h hinter Mannheim), aber nirgends steht „Ortszeit“. Das führt leicht zu Verwechslungen. | störend | T2/inhalt-Berlin-Corralejo-00.png; app.js:118-121 | Hinweis fehlt | bei anderer Zeitzone „Stand 12:29 Ortszeit“ | klein | ja |
| 31 | Tab-Leiste | Text dahinter scheint durch, die Tab-Namen sind schwer lesbar (hell stärker). | störend | T2/schrift-130-1.png, mehr-light-1.png, offline-lokal-wetter.png | Glas 61 % deckend (Regel 22) | deckender (≈ 80 %) | klein | ja: Abweichung von Regel 22 |
| 32 | Tab-Leiste 150 % | Nur der aktive Tab-Name bleibt sichtbar, „Wetter“ berührt sein Symbol. | Schönheit | T2/schrift-150-1.png | erlaubt laut DESIGN.md (Dynamic Type) | Abstand Symbol/Name prüfen | klein | nein |
| 33 | Querformat | Links unter „Aktuell“ bleibt eine leere Spalte, rechts läuft eine lange Spalte. Die Warnung füllt den Bildschirm. | störend | T2/quer-light-1.png, -2.png | Aufteilung „links nur Aktuell“ | linke Spalte mit Stunden/Meteogramm füllen; Einzeiler-Warnung (Nr. 8) | mittel | nein |
| 34 | Rad/Sat | Das Radarbild ist etwa 50 Minuten alt („Beobachtung 12:40“ um 13:37), RainViewer hätte 13:30. | störend | T2/vollbild-dunkel-radsat-blatt.png; lib/wpkarte.js:33 `VERZUG = 50` | fester Verzug (für den Satelliten gedacht) auch beim Radar | Baustein: Verzug getrennt für Radar (Konfigurator) | klein | ja: Konfigurator-Wunsch |
| 35 | Karten, Rad/Sat | Die Vorschau zeigt Text-Chips (Temperatur, Niederschlag …), die App eine Symbolspalte ohne Beschriftung. Das Diagramm in Graphs sieht anders aus als die Vorschau. | Schönheit | pruefung/vorschau-karten-iphone-hell.png vs. T2/normal-karten-hell.png | Layout des Bausteins | Vorschau anpassen oder Baustein ändern | mittel | ja: was gilt |
| 36 | Graphs (Diagramm) | Die Werte-Marken links („14“, „79“, „60“) verdecken die Achsenzahlen („12“, „100“, „50“). | Schönheit | T2/vollbild-live-graphs-01-blatt.png (angesehen) | Baustein | Konfigurator-Wunsch | klein | nein |
| 37 | Offline | Graphs offline zeigt „Wetterdaten gerade nicht erreichbar“, die Startseite dagegen den letzten Stand. Das wirkt widersprüchlich. | Schönheit | T2/offline-lokal-graphs.png | Baustein speichert keine Daten | Hinweis „Diagramm braucht Verbindung“ wie die Karten-Pille | klein | nein |
| 38 | Offline (live) | Ein Lauf zeigte nur „Offline“ ohne Stand und eine Fehlerkachel, ein zweiter war in Ordnung. | unklar | T2/offline-live-wetter.png | nicht geklärt (Vermutung: Datenabruf vorher gedrosselt oder Service Worker noch nicht bereit) | auf dem iPhone beobachten | – | nein |
| 39 | Orte-Suche | „Hamburg“ liefert auch „Grafton, Wisconsin“ und „Buhler, Kansas“. | Schönheit | T2/orte-suche-hamburg.png | Trefferliste der Geokodierung | Treffer aus Deutschland/Europa zuerst | klein | nein |
| 40 | Konsole | Selten erscheint `t._leaflet_pos`, wenn man direkt nach „Fertig“ die Karte wechselt (bekannt, Baustein). | Schönheit | lib/wpkarte.js:411-418 | Zeitgeber läuft nach dem Abbau weiter | Konfigurator-Wunsch `clearTimeout` | klein | nein |
| 41 | Zeitumstellung | So 25.10. wechselt die Winterzeit. Der feste UTC-Abstand je Abruf kann die „Stand“-Zeit bis zum nächsten Auffrischen um 1 h verschieben. | Risiko, nicht prüfbar | gemeinsam.js:11-24 | Abstand pro Abruf fest | Sonntag früh kurz nachsehen | klein | nein |
| 42 | Abnahme-Fotos | Die Karten-Fotos des ersten Laufs (pruefung/karten-iphone-*.png) zeigen eine leere blaue Fläche. Die Abnahme „Karten wie Vorschau = ja“ war damit nicht belegt. | Prozess | pruefung/karten-iphone-hell.png | Lauf mit aufgezeichneten Daten ohne Kartenkacheln | Abnahme nur mit Live-Fotos | klein | nein |

**Geprüft und in Ordnung** (damit klar ist, was stimmt):
- **Zeitzonen:** Für alle drei Orte ist die Anzeige unabhängig von der Gerätezeitzone (Berlin, Kanaren, New York).
- **Stunden-Takt:** +6/+12/+18 h ab der laufenden Stunde. Die 18/00/06 Uhr auf Stephans Foto stammen vom Datenstand 12:47.
- **Tagesliste:** 8 Tage, Höchst- und Tiefstwerte gleich den Werten von Open-Meteo.
- **Sonne:** Zeiten, Tageslänge und Sonnenstunden gleich Open-Meteo.
- **Mond:** Gegen eine eigene Rechnung geprüft: 91 %, Vollmond 26.10., Auf- und Untergang ±4 min.
- **Was heute geht:** Die Tipps-Schwellen und die Goldene Stunde stimmen. Die Küstenprüfung über die Marine-API wird einmal je Ort gemerkt.
- **Regenbalken:** Schwelle 0,1 mm, volle Höhe bei 1,5 mm, 8 Balken.
- **Wind:** Wort, Beaufort und 18-h-Verlauf stimmen.
- **Warnung:** Zeitraum in Ortszeit, für Corralejo keine Abfrage.
- **Einheiten:** Die Umrechnung auf der Startseite stimmt.
- **Orte:** Orte-Blatt, Stern und Ortswechsel funktionieren.
- **Vollbild-Mechanik:** Fertig, Esc und Zurück schließen das Blatt, kein Doppel-Blatt, Karte nicht 0 px.
- **Darstellung:** Kein seitliches Scrollen, kein Text unter 11 px, Tippflächen ≥ 44 px.
- **Safe Areas:** `env(safe-area-inset-*)` sitzt in Kopf, Inhalt, Tab-Leiste, Orte- und Studio-Blatt, beiden Vollbild-Blättern und im Querformat. Geprüft nur im Code und mit simulierten 47 px, nicht auf dem Gerät.
- **Fehler:** Keine Seitenfehler in rund 30 Läufen, außer Nr. 40.

---

## C. Warum die erste Prüfung das nicht fand

1. **Fotos zur falschen Uhrzeit und mit Ersatzdaten.** Die Abnahmefotos entstanden mit aufgezeichneten Daten und fester Uhr 04:40 nachts. Dadurch gab es:
   - Karten ohne Kacheln, also eine leere blaue Fläche, die als „ja“ abgehakt wurde.
   - keine Regen-Widersprüche und kein Tageslicht-Zustand.
   - die Auflösung Faktor 2 statt 3.

   Der Satz „live sah es gleich aus“ wurde nicht mit Fotos belegt.
2. **Das Fotoskript hat das Vollbild-Problem selbst umgangen.** `tools/fotos.js` drückt vor jedem Reiterwechsel automatisch „Fertig“ (`blattZu`). Der Test hat also nie erlebt, dass man ohne „Fertig“ nicht weiterkommt. Die Tests 14/15 prüften nur „Blatt geht auf und zu“, nicht „kann ich von Graphs zu Rad/Sat wechseln“.
3. **Die Normalansicht von Graphs wurde nie fotografiert**, weil der Schalter ab Werk an ist. Die von der Tab-Leiste verdeckten Knöpfe (Nr. 2) und die Fahne über der Kopfleiste (Nr. 3) blieben unsichtbar.
4. **Geprüft wurden Regeln, nicht Benutzung.** Der ux-check misst Tippflächen, Schriftgröße, Kontrast und Manifest. Er prüft nicht, ob ein Element **verdeckt** ist, ob zwei Texte sich **widersprechen** oder ob eine Kachel **zu viel Platz** nimmt.
5. **Widersprüche zwischen DESIGN.md und Vorschau wurden selbst entschieden** und nur im Bericht vermerkt (Meteogramm halb breit), statt sie vor dem Bau Stephan vorzulegen.
6. **Die Emulation ist kein iPhone.** Es gibt keine Statusleiste, keinen iOS-Verlauf unter der Statusleiste, keine Glas-Unschärfe, keine Safe Areas, kein Gummiband und keine installierte PWA. Diese Grenzen standen unter „Offen“. Es gab aber keinen Ersatz dafür, z. B. simulierte Safe Areas oder einen Durchgang auf dem Gerät vor der Fertigmeldung.
7. **Einheiten nur auf der Startseite geprüft**, nicht in den Bausteinen. Das **Studio** wurde auf „lässt sich öffnen/schließen“ geprüft, nicht darauf, was auf dem Bild steht („WETTERPRO“).

**Prüfschritte, die künftig fehlen** (Vorschlag für PRUEFAUFTRAG.md bzw. den ux-check):
- **Aufgaben-Durchläufe statt Einzelprüfungen**, ohne Hilfsfunktionen im Skript. Beispiele:
  - „Von Graphs zu Rad/Sat wechseln“
  - „Ort wechseln, während Karten offen sind“
  - „Einheit auf °F stellen und jeden Reiter ansehen“
  - „Foto teilen und lesen, was auf dem Bild steht“
- **Verdeckungs-Prüfung:** Für jedes sichtbare Bedienelement mit `elementFromPoint` prüfen, ob ein Tipp wirklich dort ankommt.
- **Live-Fotos zu zwei Tageszeiten** (Tag und Abend), mit Faktor 3 und simulierten Safe Areas (47/34 px), dazu ein Lauf mit echter Warnung.
- **Text-Konsistenz-Prüfung:** Alle Sätze einer Kachel nebeneinander lesen (Regen-Satz gegen „Trocken bis“, Datum gegen Jetzt-Strich).
- **Höhen-Budget:** Keine Kachel über 50 % der Bildschirmhöhe bei 100 % Schrift, keine über 100 % bei 150 %.
- **Abweichung Vorschau ↔ DESIGN.md** als Rückfrage an Stephan *vor* dem Bau, nicht als Fußnote danach.
- **Pflicht-Durchgang auf dem iPhone** (installierte App, hell und dunkel, eine Minute scrollen und tippen), bevor „fertig“ gemeldet wird.

---

## D. Offene Entscheidungen für Stephan (Kurzfassung)

1. **Vollbild:** Dauer-Vollbild abschaffen (Vorgabe AUS)? Empfehlung: ja.
2. **Meteogramm-Kachel:** volle Breite statt „klein“? Empfehlung: ja, und Wunsch an den Konfigurator: mehr Stunden in der Kachel.
3. **Warnung:** Einzeiler plus ⚠️ in der Kopfleiste wie gewünscht? Dürfen Stufe 3/4 wegklickbar sein? Empfehlung: nein. Wann kommt eine weggeklickte Warnung zurück?
4. **Glas:** Kopf- und Tab-Leiste deckender als Regel 22 (61 %)? Empfehlung: ja, ≈ 85 %.
5. **Luft-Ampel:** Grenzen lockern (Gut bis 40)? Empfehlung: ja.
6. **Aktuell- und Stunden-Kachel:** näher an die Vorschau?
7. **Konfigurator-Wünsche sammeln:**
   - Einheiten in den Bausteinen
   - Ortsname im Vollbild-Titel
   - Datums-Etikett im Meteogramm
   - Radar-Verzug
   - Karten-Chips
   - Achsenmarken
   - `clearTimeout`
8. **Corralejo:** Hinweis „Ortszeit“ einblenden? Empfehlung: ja.
