/* gemeinsam.js – Hilfen, die app.js und module.js gemeinsam nutzen (Wetterlage, 23.10.2026).
   Ortszeiten werden aus den ISO-Strings der Open-Meteo-Antwort und einem UTC-Abstand gerechnet (nie über Date-Zeitzonen); den Abstand liefert WL.ortsOffset aus der IANA-Zeitzone der Antwort (Zeitumstellung), ersatzweise utc_offset_seconds.
   Einbinden nach ikonen.js, vor module.js und app.js. Alles unter window.WL. */
(function (global) {
  'use strict';
  var WL = {};

  // ---------- Zeit ----------
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  // Ortszeit zu einem Zeitpunkt (ms seit Epoche) für einen Ort mit UTC-Abstand in Sekunden
  WL.ortsZeit = function (offsetSek, ms) {
    var d = new Date((ms == null ? Date.now() : ms) + (offsetSek || 0) * 1000);
    var datum = d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate());
    var zeit = p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes());
    return { datum: datum, zeit: zeit, iso: datum + 'T' + zeit, stunde: d.getUTCHours(), minute: d.getUTCMinutes(), wochentag: d.getUTCDay(), ms: d.getTime() - (offsetSek || 0) * 1000 };
  };
  // UTC-Abstand (Sekunden) einer IANA-Zeitzone zu einem Zeitpunkt (Sommer-/Winterzeit inklusive); ohne gültige Zeitzone gilt ersatz
  var offsetFormat = {};
  WL.offsetFuer = function (zone, ms, ersatz) {
    try {
      if (!zone || ms == null || isNaN(ms)) return ersatz || 0;
      var f = offsetFormat[zone] || (offsetFormat[zone] = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }));
      var t = {}; f.formatToParts(new Date(ms)).forEach(function (p) { t[p.type] = +p.value; });
      var sek = Math.round((Date.UTC(t.year, t.month - 1, t.day, t.hour % 24, t.minute, t.second) - Math.floor(ms / 1000) * 1000) / 1000);
      return isFinite(sek) ? sek : (ersatz || 0);
    } catch (e) { return ersatz || 0; }
  };
  // Offset des Orts zum Zeitpunkt ms: aus der Zeitzone der Antwort, sonst utc_offset_seconds
  WL.ortsOffset = function (forecast, ms) {
    var f = forecast || {};
    return WL.offsetFuer(f.timezone, ms == null ? Date.now() : ms, f.utc_offset_seconds || 0);
  };
  // Ortssuche: Deutschland zuerst, dann übriges Europa, dann der Rest; innerhalb der Gruppen bleibt die Reihenfolge der API
  var EUROPA = ['AT', 'CH', 'FR', 'IT', 'ES', 'PT', 'NL', 'BE', 'LU', 'DK', 'SE', 'NO', 'FI', 'IS', 'IE', 'GB', 'PL', 'CZ', 'SK', 'HU', 'SI', 'HR', 'RO', 'BG', 'GR', 'EE', 'LV', 'LT', 'MT', 'CY', 'LI', 'MC', 'AD', 'SM', 'VA', 'AL', 'BA', 'ME', 'MK', 'RS', 'XK', 'UA', 'MD', 'BY'];
  WL.trefferSortieren = function (liste, max) {
    var gruppen = [[], [], []];
    (Array.isArray(liste) ? liste : []).forEach(function (r) {
      var cc = String(r && r.country_code || '').toUpperCase();
      gruppen[cc === 'DE' ? 0 : EUROPA.indexOf(cc) >= 0 ? 1 : 2].push(r);
    });
    return gruppen[0].concat(gruppen[1], gruppen[2]).slice(0, max || 8);
  };
  // Lokaler ISO-String der API ('2026-10-23T14:00' oder '2026-10-23') → ms seit Epoche
  WL.isoZuMs = function (iso, offsetSek) {
    if (!iso) return NaN;
    var t = iso.length > 10 ? iso : iso + 'T00:00';
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(t);
    if (!m) return NaN;
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - (offsetSek || 0) * 1000;
  };
  WL.hhmm = function (iso) { return iso && iso.length >= 16 ? iso.slice(11, 16) : (iso || '–'); };
  WL.stundeVon = function (iso) { return iso && iso.length >= 13 ? parseInt(iso.slice(11, 13), 10) : NaN; };
  WL.datumVon = function (iso) { return iso ? iso.slice(0, 10) : ''; };
  // Index der aktuellen Stunde in hourly.time (erste Stunde, die nicht vor der laufenden Stunde liegt)
  WL.jetztIndex = function (zeiten, offsetSek) {
    var j = WL.ortsZeit(offsetSek).iso.slice(0, 13) + ':00';
    for (var i = 0; i < zeiten.length; i++) if (zeiten[i] >= j) return i;
    return Math.max(0, zeiten.length - 1);
  };
  var WT_KURZ = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'];
  var WT_LANG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  var MONATE = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'];
  WL.wochentag = function (datum, lang) { var d = new Date(datum.slice(0, 10) + 'T12:00:00Z'); return (lang ? WT_LANG : WT_KURZ)[d.getUTCDay()]; };
  WL.datumKurz = function (datum) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(datum); return m ? (+m[3]) + '. ' + MONATE[+m[2] - 1] : datum; };
  WL.minutenAlsText = function (min) { min = Math.round(min); var h = Math.floor(min / 60), m = min % 60; return (h ? h + ' h' : '') + (m ? (h ? ' ' : '') + m + ' min' : (h ? '' : '0 min')); };

  // ---------- Einheiten ----------
  // einheiten = { temp: 'c'|'f', wind: 'kmh'|'ms'|'mph' }; Regeln rechnen immer in °C und km/h
  WL.einheitenLesen = function () { try { return Object.assign({ temp: 'c', wind: 'kmh' }, JSON.parse(localStorage.getItem('wetterlage-einheiten') || '{}')); } catch (e) { return { temp: 'c', wind: 'kmh' }; } };
  WL.einheitenSchreiben = function (e) { try { localStorage.setItem('wetterlage-einheiten', JSON.stringify(e)); } catch (x) { } };
  WL.tempWert = function (c, einheiten) { if (c == null || isNaN(c)) return null; return einheiten && einheiten.temp === 'f' ? Math.round(c * 9 / 5 + 32) : Math.round(c); };
  WL.temp = function (c, einheiten, mitEinheit) { var v = WL.tempWert(c, einheiten); if (v === null) return '–'; return v + '°' + (mitEinheit ? (einheiten && einheiten.temp === 'f' ? 'F' : 'C') : ''); };
  WL.windWert = function (kmh, einheiten) { if (kmh == null || isNaN(kmh)) return null; var e = einheiten && einheiten.wind; return Math.round(e === 'ms' ? kmh / 3.6 : e === 'mph' ? kmh / 1.609344 : kmh); };
  WL.windEinheit = function (einheiten) { var e = einheiten && einheiten.wind; return e === 'ms' ? 'm/s' : e === 'mph' ? 'mph' : 'km/h'; };
  WL.wind = function (kmh, einheiten) { var v = WL.windWert(kmh, einheiten); return v === null ? '–' : v + ' ' + WL.windEinheit(einheiten); };
  WL.mm = function (v) { if (v == null || isNaN(v)) return '–'; return (Math.round(v * 10) / 10).toLocaleString('de-DE') + ' mm'; };

  // ---------- Wind ----------
  var RICHTUNGEN = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
  var RICHTUNGEN_WORT = ['Nord', 'Nordost', 'Ost', 'Südost', 'Süd', 'Südwest', 'West', 'Nordwest'];
  WL.windRichtung = function (grad) { if (grad == null || isNaN(grad)) return '–'; return RICHTUNGEN[Math.round(grad / 45) % 8]; };
  WL.windRichtungWort = function (grad) { if (grad == null || isNaN(grad)) return '–'; return RICHTUNGEN_WORT[Math.round(grad / 45) % 8]; };
  var BFT = [[1, 'Windstille'], [5, 'leiser Zug'], [11, 'leichte Brise'], [19, 'schwache Brise'], [28, 'mäßige Brise'], [38, 'frische Brise'], [49, 'starker Wind'], [61, 'steifer Wind'], [74, 'stürmischer Wind'], [88, 'Sturm'], [102, 'schwerer Sturm'], [117, 'orkanartiger Sturm'], [1e9, 'Orkan']];
  WL.beaufort = function (kmh) { if (kmh == null || isNaN(kmh)) return { bft: null, wort: '–' }; for (var i = 0; i < BFT.length; i++) if (kmh < BFT[i][0]) return { bft: i, wort: BFT[i][1] }; return { bft: 12, wort: 'Orkan' }; };

  // ---------- Wetterlage (WMO-Code) ----------
  // Symbolname im Satz aus symbole.js; dieselbe Zuordnung wie in bausteine-einbau.js
  WL.symbolName = function (code, istTag) {
    if (global.Bausteine && typeof global.Bausteine.symbolName === 'function') return global.Bausteine.symbolName(code, istTag);
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
  };
  WL.wetterText = function (code, istTag) {
    var nacht = istTag === false || istTag === 0;
    if (code === 0) return nacht ? 'Klare Nacht' : 'Sonnig';
    if (code === 1) return nacht ? 'Meist klar' : 'Meist sonnig';
    if (code === 2) return 'Teils bewölkt';
    if (code === 3) return 'Bedeckt';
    if (code === 45) return 'Nebel';
    if (code === 48) return 'Reifnebel';
    if (code === 51) return 'Leichter Nieselregen';
    if (code === 53) return 'Nieselregen';
    if (code === 55) return 'Starker Nieselregen';
    if (code === 56 || code === 57) return 'Gefrierender Nieselregen';
    if (code === 61) return 'Leichter Regen';
    if (code === 63) return 'Regen';
    if (code === 65) return 'Starker Regen';
    if (code === 66 || code === 67) return 'Gefrierender Regen';
    if (code === 71) return 'Leichter Schneefall';
    if (code === 73) return 'Schneefall';
    if (code === 75) return 'Starker Schneefall';
    if (code === 77) return 'Schneegriesel';
    if (code === 80) return 'Leichte Schauer';
    if (code === 81) return 'Schauer';
    if (code === 82) return 'Heftige Schauer';
    if (code === 85) return 'Leichte Schneeschauer';
    if (code === 86) return 'Schneeschauer';
    if (code === 95) return 'Gewitter';
    if (code === 96) return 'Gewitter mit Hagel';
    if (code === 99) return 'Schweres Gewitter mit Hagel';
    return 'Wolkig';
  };
  // Hintergrund-Verlauf nach Wetterlage (Variablen --himmel-* aus tokens.css)
  WL.himmelKlasse = function (code, istTag) {
    var nacht = istTag === false || istTag === 0;
    if (nacht) return 'himmel-nacht';
    if (code === 0 || code === 1) return 'himmel-klar';
    if (code === 45 || code === 48) return 'himmel-nebel';
    if (code >= 95) return 'himmel-gewitter';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'himmel-schnee';
    if (code >= 51) return 'himmel-regen';
    return 'himmel-bewoelkt';
  };

  // ---------- Luftqualität (Europäischer Index: Gut ≤ 40, Mäßig ≤ 80, darüber Schlecht) ----------
  WL.luftStufe = function (aqi) {
    if (aqi == null || isNaN(aqi)) return { wort: '–', farbe: 'var(--label-3)', stufe: 0 };
    if (aqi <= 40) return { wort: 'Gut', farbe: 'var(--gruen)', stufe: 1 };
    if (aqi <= 80) return { wort: 'Mäßig', farbe: 'var(--orange)', stufe: 2 };
    return { wort: 'Schlecht', farbe: 'var(--rot)', stufe: 3 };
  };
  // Pollen (Körner je m³) → Stufe 0–3 mit Wort; null = keine Daten (außerhalb Saison oder Region)
  WL.pollenStufe = function (wert, art) {
    if (wert == null || isNaN(wert)) return { stufe: null, wort: 'keine Daten' };
    var g = art === 'birch' || art === 'alder' ? [1, 50, 200] : art === 'grass' ? [1, 20, 80] : [1, 20, 100];
    if (wert < g[0]) return { stufe: 0, wort: 'keine' };
    if (wert < g[1]) return { stufe: 1, wort: 'gering' };
    if (wert < g[2]) return { stufe: 2, wort: 'mäßig' };
    return { stufe: 3, wort: 'stark' };
  };
  WL.POLLEN = [['alder_pollen', 'Erle'], ['birch_pollen', 'Birke'], ['grass_pollen', 'Gräser'], ['mugwort_pollen', 'Beifuß'], ['olive_pollen', 'Olive'], ['ragweed_pollen', 'Ambrosia']];

  // ---------- Speicher ----------
  WL.merk = function (k, v) {
    try {
      if (arguments.length < 2) { var t = localStorage.getItem('wetterlage-' + k); return t === null ? null : JSON.parse(t); }
      if (v === null || v === undefined) localStorage.removeItem('wetterlage-' + k); else localStorage.setItem('wetterlage-' + k, JSON.stringify(v));
    } catch (e) { }
    return null;
  };

  // ---------- HTML ----------
  WL.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  global.WL = WL;
})(window);
