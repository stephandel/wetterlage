/* bausteine-einbau.js – fertiger Klebecode für meteogramm.js und wpkarte.js, erzeugt vom Design-Konfigurator am 23.10.2026 aus den gewählten Einstellungen.
   Die Bausteine werden nicht nachgebaut und nicht geändert; dieser Klebecode ist die einzige Stelle, an der die App sie anspricht.
   Einbinden (Reihenfolge): base.css, tokens.css, Leaflet-CSS, meteogramm.css, wpkarte.css, app.css;
   Skripte: symbole.js, Leaflet, meteogramm.js, wpkarte.js, bausteine-einbau.js, app.js.
   ort und orte sind Objekte { id, name, lat, lon }; offset ist der Abstand des Orts zu UTC in Sekunden. Aufrufe:
     Bausteine.graphs(ort)                  – Reiter Graphs, Ziel #graphs; erst aufrufen, wenn der Reiter sichtbar ist (ein verborgenes Diagramm misst 0 Pixel)
     Bausteine.startMeteogramm(ort)         – Meteogramm-Modul der Startseite, Ziel #start-meteogramm
     Bausteine.karte(modus, ort, orte, offset) – modus 'karten' (Reiter Karten), modus 'radsat' (Reiter Rad/Sat); Ziel #karte
     Bausteine.abbauen()                    – beim Ortswechsel oder Verlassen der Reiter */
(function (global) {
  'use strict';
  var APP = "wetterlage";   // Präfix für gemerkte Wahlen im localStorage
  var ZIEL = { graphs: '#graphs', start: '#start-meteogramm', karte: '#karte' };
  var START_ORT = { id: "mannheim", name: "Mannheim", lat: 49.4875, lon: 8.466 };   // Startort laut Einstellungen (Standard, wenn kein Ort gewählt ist)

  // Farben: die Bausteine bekommen ihre Werte aus tokens.css (kein eigenes Blau, keine festen Farben)
  var FARBEN_CSS = [
    "#graphs.mg, #start-meteogramm.mg { --mg-flaeche: var(--bg-2); --mg-flaeche2: var(--bg); --mg-rand: var(--trenner); --mg-text: var(--label); --mg-text-still: var(--label-2); --mg-akzent: var(--akzent); --mg-schatten: none; --mg-serif: var(--font); --mg-mono: var(--font); }",
    "#karte.wk { --wk-leiste: var(--bg-2); --wk-leiste-an: var(--akzent); --wk-zeit: var(--bg-2); --wk-text: var(--label); --wk-still: var(--label-2); --wk-akzent: var(--akzent); --wk-rand: var(--trenner); }",
    "#karte .wk-knopf, #karte .wk-tk { width: var(--tap); height: var(--tap); }",
    "#karte .wk-knopf.is-on { color: var(--auf-akzent); }",
    "#karte .wk-lade { background: var(--bg-2); }",
    "#karte[data-wk-modus=\"karten\"] [data-ebene=\"druck\"] { display: none; }"
  ].join('\n');
  function farbenEinfuegen() {
    if (document.getElementById('bausteine-farben')) return;
    var s = document.createElement('style'); s.id = 'bausteine-farben'; s.textContent = FARBEN_CSS; document.head.appendChild(s);
  }
  // Vollbild (A32): ⤢ legt Meteogramm und Karte als Blatt über den ganzen Bildschirm, „Fertig“, Esc und Zurück schließen.
  // „Immer im Vollbild“ wählt der Nutzer unter „Mehr“ (localStorage APP-vollbild-immer, true/false; Vorgabe aus dem Konfigurator).
  // Ist es an, öffnen Graphs, Karten, Rad/Sat gleich als Blatt; die App setzt Bausteine.beiVollbildZu = function () { … } für den Rückweg zum vorherigen Reiter.
  var VOLLBILD_KNOPF = true, VOLLBILD_IMMER = true;
  function immerVollbild() { try { var v = localStorage.getItem(APP + '-vollbild-immer'); return v === null ? VOLLBILD_IMMER : v === 'true'; } catch (e) { return VOLLBILD_IMMER; } }
  function immerVollbildSetzen(an) { try { localStorage.setItem(APP + '-vollbild-immer', String(!!an)); } catch (e) { } }
  function vollbildZu() { if (!immerVollbild()) return; if (global.Bausteine && typeof global.Bausteine.beiVollbildZu === 'function') global.Bausteine.beiVollbildZu(); }   // nur bei „immer“: von Hand geöffnet und geschlossen bleibt der Reiter

  function ortVon(o) { o = o || START_ORT; var r = { id: o.id, name: o.name, lat: o.lat, lon: o.lon }; if (o.meer) r.meer = o.meer; return r; }
  function schluessel(o) { return o.id + '|' + o.lat + '|' + o.lon; }

  // ---------- Meteogramm (meteogramm.js) ----------
  var MODELLE = [{ id: "best_match", name: "Mix", lang: "Beste Mischung" }];   // Wettermodell laut Einstellungen
  var mg = {};   // Instanzen je Ziel
  function mgBauen(art, o, zeilen, extra) {
    var el = document.querySelector(ZIEL[art]);
    if (!el) return null;
    if (!global.Meteogramm) { el.innerHTML = '<p class="hinweis">Der Diagramm-Baustein fehlt (meteogramm.js einbinden).</p>'; return null; }
    o = ortVon(o); var s = schluessel(o);
    if (mg[art] && mg[art].schluessel === s) { mg[art].instanz.auffrischen(); if (art === 'graphs' && immerVollbild()) { try { mg[art].instanz.vollbild(true); } catch (e) { } } return mg[art].instanz; }   // gleicher Ort: nur Werte auffrischen
    mgAbbauen(art); farbenEinfuegen();
    mg[art] = { schluessel: s, instanz: global.Meteogramm.einbauen(Object.assign({
      ziel: ZIEL[art], orte: [o], modelle: MODELLE, karte: false, zeilen: zeilen, zeilenStandard: zeilen,
      merkschluessel: APP + '-mg-' + art, zeitzone: 'auto',
      vollbildStart: art === 'graphs' && immerVollbild(), beiVollbildZu: art === 'graphs' ? vollbildZu : null
    }, extra || {})) };
    return mg[art].instanz;
  }
  function mgAbbauen(art) { if (mg[art]) { try { mg[art].instanz.abbauen(); } catch (e) { } } mg[art] = null; }
  // Reiter Graphs: Zeilen Sonnenschein, Temperatur, Wind, Niederschlag, Bewölkung, Rel. Luftfeuchte, UV-Index, Luftdruck; Werteliste immer mit allen Werten; Wertepaare Sonnenschein · UV-Index, Niederschlag · Bewölkung
  function graphs(ort) {
    return mgBauen('graphs', ort, ["sonne", "temp", "wind", "regen", "wolken", "feuchte", "uv", "druck"], { werteKlug: false, wertePaare: [["sonne", "uv"], ["regen", "wolken"]] });
  }
  // Meteogramm-Modul der Startseite (klein): Zeilen Temperatur
  function startMeteogramm(ort) {
    return mgBauen('start', ort, ["temp"]);
  }

  // ---------- Karten, Radar, Satellit (wpkarte.js, braucht Leaflet) ----------
  // Reiter Karten: Grundkarte ist immer OpenTopoMap; Ebenen: Temperatur, Niederschlag, Wind, Bewölkung, Wetter-Marken
  // Reiter Rad/Sat: Ebenen Radar, Satellit Farbe, Infrarot s/w, Satellit + Regen
  // Ebenen, die abgewählt sind, blendet FARBEN_CSS aus; hier steht, womit jeder Reiter startet (die letzte Wahl der Nutzer gilt danach).
  var KARTE_START = { 'wk-karten': { wetter: true, flaeche: "temp" }, 'wk-radsat': { wetter: true, flaeche: "radar" } };
  function merk(k, v) {   // gemerkte Ebene, Zoom und Ort der Karte
    try {
      if (arguments.length < 2) { var t = localStorage.getItem(APP + '-' + k); return t ? JSON.parse(t) : (KARTE_START[k] || null); }
      localStorage.setItem(APP + '-' + k, JSON.stringify(v));
    } catch (e) { }
    return null;
  }
  // Wettersymbole der Karte: WMO-Wettercode → Name im Satz aus symbole.js
  function symbolName(code, istTag) {
    var nacht = istTag === false || istTag === 0;
    if (code === 0) return nacht ? 'mond' : 'sonne';
    if (code === 1 || code === 2) return nacht ? 'mondwolke' : 'sonnewolke';
    if (code === 3) return 'bedeckt';
    if (code === 45 || code === 48) return 'nebel';
    if (code >= 51 && code <= 55) return 'niesel';
    if (code === 56 || code === 57 || code === 66 || code === 67) return 'schneeregen';
    if (code >= 61 && code <= 65) return 'regen';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'schnee';
    if (code >= 80 && code <= 82) return nacht ? 'mondschauer' : 'schauer';
    if (code === 96 || code === 99) return 'hagel';
    if (code >= 95) return 'gewitter';
    return 'wolke';
  }
  var karten = {};
  function kartenAbbauen() { Object.keys(karten).forEach(function (m) { try { karten[m].abbauen(); } catch (e) { } }); karten = {}; }
  function karte(modus, ort, orte, offset) {
    var el = document.querySelector(ZIEL.karte);
    if (!el) return null;
    if (!global.WetterKarte || !global.L) { el.innerHTML = '<p class="hinweis">Der Kartenbaustein fehlt (Leaflet und wpkarte.js einbinden).</p>'; return null; }
    kartenAbbauen(); farbenEinfuegen();
    el.setAttribute('data-wk-modus', modus);
    karten[modus] = global.WetterKarte.einbauen({
      ziel: ZIEL.karte, modus: modus, ort: ortVon(ort), orte: (orte || [ort || START_ORT]).map(ortVon), offset: offset || 0,
      symbol: function (code, istTag) { return typeof global.WetterSymbol === 'function' ? global.WetterSymbol(symbolName(code, istTag)) : ''; },
      offline: false, merk: merk,
      vollbildKnopf: VOLLBILD_KNOPF, vollbildStart: immerVollbild(), beiVollbildZu: vollbildZu
    });
    // Eine Karte misst beim Aufbau ihre Größe: im sichtbaren Reiter bauen und danach einmal neu zeichnen lassen
    if (karten[modus] && karten[modus].sichtbar) setTimeout(function () { try { karten[modus].sichtbar(); } catch (e) { } }, 60);
    return karten[modus];
  }
  // Radar-Zoom: RainViewer liefert Kacheln nur bis Zoom 7 (ab 8 steht dort „Zoom Level Not Supported“). wpkarte.js stellt das selbst ein;
  // wer eine eigene Radar-Schicht zeichnet (z. B. Radar-Kachel auf der Startseite), nimmt diese Funktion statt einer eigenen Schicht.
  var RADAR_MAX_ZOOM = 7;
  function radarSchicht(host, pfad) {
    return global.L.tileLayer(host + pfad + '/256/{z}/{x}/{y}/2/1_1.png', { opacity: 0.8, tileSize: 256, maxNativeZoom: RADAR_MAX_ZOOM });
  }

  function abbauen() {
    Object.keys(mg).forEach(mgAbbauen);
    kartenAbbauen();
  }

  global.Bausteine = { immerVollbild: immerVollbild, immerVollbildSetzen: immerVollbildSetzen, graphs: graphs, startMeteogramm: startMeteogramm, karte: karte, radarSchicht: radarSchicht, symbolName: symbolName, abbauen: abbauen };
})(window);
