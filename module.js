/* module.js – die zwölf Startseiten-Module der Wetterlage (Wetterlage, 23.10.2026).
   Einbinden nach gemeinsam.js, ikonen.js, symbole.js, bausteine-einbau.js; vor app.js. Alles unter window.Module.
   Rechenfunktionen (ohne DOM) stehen zusätzlich in Module.rechnen und werden in tests/module.test.js geprüft. */
(function (global) {
  'use strict';
  var WL = global.WL;
  var R = {};            // reine Rechenfunktionen
  var RAD = Math.PI / 180;
  var OSM = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  var karten = [];       // gebaute Leaflet-Karten, beim erneuten Zeichnen abgebaut
  var gebunden = null;   // { el, fn } – Klick-Weiche des Containers

  // ---------- kleine Hilfen ----------
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function esc(s) { return WL.esc(s); }
  function zahlDe(v, d) { if (v == null || isNaN(v)) return '–'; var f = Math.pow(10, d || 0); return String(Math.round(v * f) / f).replace('.', ','); }
  function num(v) { return v != null && !isNaN(v) ? +v : null; }
  function offsetVon(daten) { return (daten && daten.forecast && daten.forecast.utc_offset_seconds) || 0; }
  function jetztMs(daten) { return daten && daten.jetztMs != null ? daten.jetztMs : Date.now(); }
  // Index der laufenden Stunde (wie WL.jetztIndex, aber mit wählbarer Uhrzeit für Tests)
  function jetztIdx(zeiten, offset, ms) {
    var j = WL.ortsZeit(offset, ms).iso.slice(0, 13) + ':00';
    for (var i = 0; i < zeiten.length; i++) if (zeiten[i] >= j) return i;
    return Math.max(0, zeiten.length - 1);
  }
  function uhr(iso) { return p2(WL.stundeVon(iso)) + ' Uhr'; }
  function ikon(name, klasse) { return typeof global.Ikon === 'function' ? global.Ikon(name, klasse) : ''; }
  function sym(name) { return typeof global.WetterSymbol === 'function' ? global.WetterSymbol(name) : ''; }
  function zeitAus(ms, offset) { return WL.ortsZeit(offset, ms).zeit; }
  function tagZeit(ms, offset) { var o = WL.ortsZeit(offset, ms); return WL.wochentag(o.datum) + ' ' + o.zeit; }
  function zahlEinheit(zahl, einheit) { return '<span class="zahl">' + esc(zahl) + '</span>' + (einheit ? ' <span class="einheit">' + esc(einheit) + '</span>' : ''); }
  function windTeile(kmh, einh) { var v = WL.windWert(kmh, einh); return v === null ? '–' : zahlEinheit(v, WL.windEinheit(einh)); }
  function tempAria(c, einh) { var v = WL.tempWert(c, einh); return v === null ? 'unbekannt' : v + ' Grad ' + (einh && einh.temp === 'f' ? 'Fahrenheit' : 'Celsius'); }

  // ---------- Rechnen: Regen der nächsten 2 Stunden ----------
  // minutely = { time, precipitation } (Viertelstunden ab der laufenden); opt = { ms, schnee }
  R.regenSatz = function (minutely, offset, opt) {
    var r = regenSatzRoh(minutely, offset, opt);
    if (r.stand && r.werte.length) r.satz = 'Stand ' + r.stand + ': ' + r.satz;
    return r;
  };
  function regenSatzRoh(minutely, offset, opt) {
    opt = opt || {};
    var zt = (minutely && minutely.time) || [], pr = (minutely && minutely.precipitation) || [];
    var jetzt = WL.ortsZeit(offset, opt.ms != null ? opt.ms : Date.now());
    var q = jetzt.iso.slice(0, 14) + p2(Math.floor(jetzt.minute / 15) * 15);
    var i0 = 0, i, werte = [], zeiten = [], stand = '';
    for (i = 0; i < zt.length; i++) if (zt[i] <= q) i0 = i;
    // veraltete Daten: ab „jetzt“ bleiben weniger als 8 Werte, dann die letzten 8 zeigen und den Stand nennen
    if (zt.length >= 8 && zt.length - i0 < 8) { i0 = zt.length - 8; stand = WL.hhmm(zt[i0]); }
    for (i = i0; i < zt.length && werte.length < 8; i++) { werte.push(num(pr[i]) || 0); zeiten.push(zt[i]); }
    var nass = werte.map(function (v) { return v >= 0.1; });
    var wort = opt.schnee ? 'Schnee' : 'Regen';
    var res = { werte: werte, zeiten: zeiten, nass: nass, schnee: !!opt.schnee, satz: '', stand: stand };
    if (!werte.length) { res.satz = 'Für die nächsten 2 Stunden liegen keine Regendaten vor'; return res; }
    var a = nass.indexOf(true);
    if (a < 0) { res.satz = 'Die nächsten 2 Stunden bleibt es trocken'; return res; }
    var e;
    if (a === 0) {
      for (e = 1; e < nass.length && nass[e]; e++);
      if (e >= nass.length) res.satz = wort + ' die nächsten 2 Stunden und länger';
      else res.satz = wort + ' bis etwa ' + WL.hhmm(zeiten[e]) + ' Uhr';
      return res;
    }
    for (e = a; e < nass.length && nass[e]; e++);
    var min = (e - a) * 15;
    res.satz = wort + ' ab ' + WL.hhmm(zeiten[a]) + ' Uhr für ' + (e >= nass.length ? 'mindestens ' : '') + (min < 60 ? min + ' Minuten' : WL.minutenAlsText(min));
    return res;
  }

  // Balkenhöhe in Prozent: ab 0,1 mm zählt als Regen (mindestens 8 %), volle Höhe bei 1,5 mm
  R.balkenHoehe = function (v) { return v >= 0.1 ? Math.max(8, Math.min(1, v / 1.5) * 100) : 0; };

  // „Trocken bis 19 Uhr“ / „Regen bis 19 Uhr“ aus den Stunden (ab 0,1 mm)
  R.trockenBis = function (hourly, offset, ms) {
    var t = hourly && hourly.time, p = hourly && hourly.precipitation;
    if (!t || !p) return '';
    var i0 = jetztIdx(t, offset, ms != null ? ms : Date.now()), heute = WL.ortsZeit(offset, ms != null ? ms : Date.now()).datum, i;
    function nass(k) { return (num(p[k]) || 0) >= 0.1; }
    if (nass(i0)) {
      for (i = i0; i + 1 < t.length && nass(i + 1); i++);
      return 'Regen bis ' + p2((WL.stundeVon(t[i]) + 1) % 24) + ' Uhr';
    }
    for (i = i0; i < t.length && !nass(i); i++);
    if (i >= t.length) return 'Trocken in den nächsten Tagen';
    return 'Trocken bis ' + (t[i].slice(0, 10) === heute ? '' : WL.wochentag(t[i]) + ' ') + uhr(t[i]);
  };

  // ---------- Rechnen: Stunden ----------
  R.stundenIndizes = function (hourly, offset, ms) {
    var zeiten = (hourly && hourly.time) || [];
    var i0 = jetztIdx(zeiten, offset, ms != null ? ms : Date.now());
    return [6, 12, 18].map(function (d) { return i0 + d; }).filter(function (i) { return i < zeiten.length; });
  };

  // ---------- Rechnen: Luft ----------
  // Tagesmaximum des europäischen Index je Datum → { '2026-10-23': 34, … }
  R.luftTage = function (luft) {
    var out = {}, h = luft && luft.hourly;
    if (!h || !h.time || !h.european_aqi) return out;
    for (var i = 0; i < h.time.length; i++) {
      var v = num(h.european_aqi[i]); if (v === null) continue;
      var d = h.time[i].slice(0, 10);
      if (out[d] === undefined || v > out[d]) out[d] = v;
    }
    return out;
  };
  // Stärkste Pollenart am morgigen Datum → { satz, art, stufe }
  R.pollenMorgen = function (luft, offset, ms) {
    var h = luft && luft.hourly;
    var morgen = WL.ortsZeit(offset, (ms != null ? ms : Date.now()) + 864e5).datum;
    if (!h || !h.time) return { satz: 'Für morgen liegen keine Pollendaten vor', art: null, stufe: null };
    var best = null, gesehen = false;
    WL.POLLEN.forEach(function (p) {
      var max = null;
      for (var i = 0; i < h.time.length; i++) {
        if (h.time[i].slice(0, 10) !== morgen) continue;
        var v = num(h[p[0]] && h[p[0]][i]); if (v !== null && (max === null || v > max)) max = v;
      }
      if (max === null) return;
      gesehen = true;
      var s = WL.pollenStufe(max, p[0].replace('_pollen', ''));
      if (!best || s.stufe > best.stufe || (s.stufe === best.stufe && max > best.max)) best = { name: p[1], stufe: s.stufe, wort: s.wort, max: max };
    });
    if (!gesehen) return { satz: 'Für morgen liegen keine Pollendaten vor', art: null, stufe: null };
    if (best.stufe < 1) return { satz: 'Morgen kaum Pollen', art: null, stufe: 0 };
    return { satz: 'Morgen ' + best.name + ' ' + best.wort, art: best.name, stufe: best.stufe };
  };

  // ---------- Rechnen: Mond (SunCalc-artige Formeln, Genauigkeit etwa ±10 min) ----------
  var E = RAD * 23.4397;
  function tage(ms) { return ms / 864e5 - 10957.5; }   // Tage seit J2000
  function rektaszension(l, b) { return Math.atan2(Math.sin(l) * Math.cos(E) - Math.tan(b) * Math.sin(E), Math.cos(l)); }
  function deklination(l, b) { return Math.asin(Math.sin(b) * Math.cos(E) + Math.cos(b) * Math.sin(E) * Math.sin(l)); }
  function sonnenKoord(d) {
    var M = RAD * (357.5291 + 0.98560028 * d);
    var C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
    var L = M + C + RAD * 102.9372 + Math.PI;
    return { dec: deklination(L, 0), ra: rektaszension(L, 0) };
  }
  function mondKoord(d) {
    var L = RAD * (218.316 + 13.176396 * d), M = RAD * (134.963 + 13.064993 * d), F = RAD * (93.272 + 13.229350 * d);
    var l = L + RAD * 6.289 * Math.sin(M), b = RAD * 5.128 * Math.sin(F);
    return { ra: rektaszension(l, b), dec: deklination(l, b), dist: 385001 - 20905 * Math.cos(M) };
  }
  function mondPhase(ms) {
    var d = tage(ms), s = sonnenKoord(d), m = mondKoord(d), sdist = 149598000;
    var phi = Math.acos(Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
    var inc = Math.atan2(sdist * Math.sin(phi), m.dist - sdist * Math.cos(phi));
    var winkel = Math.atan2(Math.cos(s.dec) * Math.sin(s.ra - m.ra), Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra));
    return { anteil: (1 + Math.cos(inc)) / 2, phase: 0.5 + 0.5 * inc * (winkel < 0 ? -1 : 1) / Math.PI };
  }
  function mondHoehe(ms, lat, lon) {
    var d = tage(ms), m = mondKoord(d), lw = RAD * -lon, phi = RAD * lat;
    var H = RAD * (280.16 + 360.9856235 * d) - lw - m.ra;
    return Math.asin(Math.sin(phi) * Math.sin(m.dec) + Math.cos(phi) * Math.cos(m.dec) * Math.cos(H)) / RAD;
  }
  var PHASEN = ['Neumond', 'Erstes Viertel', 'Vollmond', 'Letztes Viertel'];
  // Hauptphasen nach Meeus, Astronomical Algorithms, Kap. 49 (Genauigkeit wenige Minuten); j = 4 · k + Phase
  function phaseMs(j) {
    var k = j / 4, ph = ((j % 4) + 4) % 4, T = k / 1236.85, T2 = T * T, T3 = T2 * T, T4 = T3 * T;
    var jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T2 - 0.00000015 * T3 + 0.00000000073 * T4;
    var Ee = 1 - 0.002516 * T - 0.0000074 * T2;
    function w(g) { return RAD * (((g % 360) + 360) % 360); }
    var M = w(2.5534 + 29.1053567 * k - 0.0000014 * T2 - 0.00000011 * T3);
    var Mm = w(201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4);
    var F = w(160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4);
    var Om = w(124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3);
    var E2 = Ee * Ee, sin = Math.sin, cos = Math.cos, c;
    if (ph === 0 || ph === 2) {
      var neu = ph === 0;
      c = (neu ? -0.4072 : -0.40614) * sin(Mm) + (neu ? 0.17241 : 0.17302) * Ee * sin(M) + (neu ? 0.01608 : 0.01614) * sin(2 * Mm) + (neu ? 0.01039 : 0.01043) * sin(2 * F) +
        (neu ? 0.00739 : 0.00734) * Ee * sin(Mm - M) + (neu ? -0.00514 : -0.00515) * Ee * sin(Mm + M) + (neu ? 0.00208 : 0.00209) * E2 * sin(2 * M) -
        0.00111 * sin(Mm - 2 * F) - 0.00057 * sin(Mm + 2 * F) + 0.00056 * Ee * sin(2 * Mm + M) - 0.00042 * sin(3 * Mm) + 0.00042 * Ee * sin(M + 2 * F) +
        0.00038 * Ee * sin(M - 2 * F) - 0.00024 * Ee * sin(2 * Mm - M) - 0.00017 * sin(Om) - 0.00007 * sin(Mm + 2 * M) + 0.00004 * sin(2 * Mm - 2 * F) +
        0.00004 * sin(3 * M) + 0.00003 * sin(Mm + M - 2 * F) + 0.00003 * sin(2 * Mm + 2 * F) - 0.00003 * sin(Mm + M + 2 * F) + 0.00003 * sin(Mm - M + 2 * F) -
        0.00002 * sin(Mm - M - 2 * F) - 0.00002 * sin(3 * Mm + M) + 0.00002 * sin(4 * Mm);
    } else {
      c = -0.62801 * sin(Mm) + 0.17172 * Ee * sin(M) - 0.01183 * Ee * sin(Mm + M) + 0.00862 * sin(2 * Mm) + 0.00804 * sin(2 * F) + 0.00454 * Ee * sin(Mm - M) +
        0.00204 * E2 * sin(2 * M) - 0.0018 * sin(Mm - 2 * F) - 0.0007 * sin(Mm + 2 * F) - 0.0004 * sin(3 * Mm) - 0.00034 * Ee * sin(2 * Mm - M) +
        0.00032 * Ee * sin(M + 2 * F) + 0.00032 * Ee * sin(M - 2 * F) - 0.00028 * E2 * sin(Mm + 2 * M) + 0.00027 * Ee * sin(2 * Mm + M) - 0.00017 * sin(Om) -
        0.00005 * sin(Mm - M - 2 * F) + 0.00004 * sin(2 * Mm + 2 * F) - 0.00004 * sin(Mm + M + 2 * F) + 0.00004 * sin(Mm - 2 * M) + 0.00003 * sin(Mm + M - 2 * F) +
        0.00003 * sin(3 * M) + 0.00002 * sin(2 * Mm - 2 * F) + 0.00002 * sin(Mm - M + 2 * F) - 0.00002 * sin(3 * Mm + M);
      var wv = 0.00306 - 0.00038 * Ee * cos(M) + 0.00026 * cos(Mm) - 0.00002 * cos(Mm - M) + 0.00002 * cos(Mm + M) + 0.00002 * cos(2 * F);
      c += ph === 1 ? wv : -wv;
    }
    var A = [[299.77, 0.107408, -0.009173 * T2], [251.88, 0.016321], [251.83, 26.651886], [349.42, 36.412478], [84.66, 18.206239], [141.74, 53.303771], [207.14, 2.453732],
      [154.84, 7.30686], [34.52, 27.261239], [207.19, 0.121824], [291.34, 1.844379], [161.72, 24.198154], [239.56, 25.513099], [331.55, 3.592518]];
    var K = [0.000325, 0.000165, 0.000164, 0.000126, 0.00011, 0.000062, 0.00006, 0.000056, 0.000047, 0.000042, 0.00004, 0.000037, 0.000035, 0.000023];
    for (var n = 0; n < 14; n++) c += K[n] * sin(w(A[n][0] + A[n][1] * k + (A[n][2] ? A[n][2] * 1 : 0)));
    jde += c - 69 / 86400;   // Dynamische Zeit → Weltzeit (ΔT 2026 etwa 69 s)
    return (jde - 2440587.5) * 864e5;
  }
  R.hauptphasen = function (ms, anzahl) {
    var j0 = Math.floor(((ms / 864e5 + 2440587.5) - 2451550.09766) / 29.530588861 * 4) - 2, out = [];
    for (var j = j0; j < j0 + 4 + 4 * (anzahl || 2) + 2; j++) {
      var t = phaseMs(j);
      if (t > ms) { var k = ((j % 4) + 4) % 4; out.push({ name: PHASEN[k], ms: t, k: k }); }
    }
    out.sort(function (a, b) { return a.ms - b.ms; });
    return out.slice(0, anzahl || 2);
  };
  function phasenName(p, anteil) {
    if (anteil < 0.03) return 'Neumond';
    if (anteil > 0.97) return 'Vollmond';
    if (Math.abs(p - 0.25) < 0.02) return 'Erstes Viertel';
    if (Math.abs(p - 0.75) < 0.02) return 'Letztes Viertel';
    if (p < 0.25) return 'Zunehmende Sichel';
    if (p < 0.5) return 'Zunehmender Mond';
    if (p < 0.75) return 'Abnehmender Mond';
    return 'Abnehmende Sichel';
  }
  // ms = Zeitpunkt, lat/lon in Grad, offset = UTC-Abstand des Orts in Sekunden
  R.mond = function (ms, lat, lon, offset) {
    var ph = mondPhase(ms), prozent = Math.round(ph.anteil * 100), zunehmend = ph.phase < 0.5;
    var start = WL.isoZuMs(WL.ortsZeit(offset, ms).datum, offset), H0 = 0.133, auf = null, unter = null;
    var prev = mondHoehe(start, lat, lon) - H0;
    for (var t = 10; t <= 1440; t += 10) {
      var cur = mondHoehe(start + t * 60000, lat, lon) - H0;
      if (prev < 0 && cur >= 0 && auf === null) auf = start + (t - 10 + 10 * (0 - prev) / (cur - prev)) * 60000;
      if (prev >= 0 && cur < 0 && unter === null) unter = start + (t - 10 + 10 * (prev - 0) / (prev - cur)) * 60000;
      prev = cur;
    }
    return {
      phase: ph.phase, anteil: ph.anteil, prozent: prozent, zunehmend: zunehmend,
      name: phasenName(ph.phase, ph.anteil),
      text: 'Mond zu ' + prozent + ' % beleuchtet' + (prozent <= 3 || prozent >= 97 ? '' : ', ' + (zunehmend ? 'zunehmend' : 'abnehmend')),
      aufgangMs: auf, untergangMs: unter,
      aufgang: auf === null ? null : zeitAus(auf, offset), untergang: unter === null ? null : zeitAus(unter, offset),
      naechste: R.hauptphasen(ms, 2).map(function (x) { var o = WL.ortsZeit(offset, x.ms); return { name: x.name, ms: x.ms, datum: o.datum, text: WL.wochentag(o.datum) + ' ' + WL.datumKurz(o.datum) }; })
    };
  };

  // ---------- Rechnen: Was heute geht ----------
  // Ebbe und Flut: lokale Extrema der nächsten 24 h, Minuten über die Parabel durch drei Stundenwerte verfeinert
  function gezeiten(meer, offset, ms) {
    var t = meer && meer.hourly && meer.hourly.time, v = meer && meer.hourly && meer.hourly.sea_level_height_msl, ev = [];
    if (!t || !v) return ev;
    var i0 = jetztIdx(t, offset, ms);
    for (var i = Math.max(1, i0); i < Math.min(t.length - 1, i0 + 25); i++) {
      var a = num(v[i - 1]), b = num(v[i]), c = num(v[i + 1]);
      if (a === null || b === null || c === null) continue;
      var art = b > a && b >= c ? 'Flut' : (b < a && b <= c ? 'Ebbe' : null);
      if (!art) continue;
      var den = a - 2 * b + c, dx = den ? 0.5 * (a - c) / den : 0;
      dx = Math.max(-1, Math.min(1, dx));
      var em = WL.isoZuMs(t[i], offset) + dx * 36e5;
      if (em >= ms) ev.push({ art: art, ms: em });
    }
    return ev;
  }
  R.gezeiten = gezeiten;

  R.tipps = function (daten) {
    var f = daten.forecast, h = f.hourly, d = f.daily, off = f.utc_offset_seconds || 0, ms = jetztMs(daten), einh = daten.einheiten;
    var jetzt = WL.ortsZeit(off, ms), heute = jetzt.datum, nowIso = jetzt.iso, out = [], i;
    var i0 = jetztIdx(h.time, off, ms), iEnde = i0;
    while (iEnde + 1 < h.time.length && h.time[iEnde + 1].slice(0, 10) === heute) iEnde++;
    if (h.time[i0] && h.time[i0].slice(0, 10) !== heute) iEnde = i0 - 1;   // veraltete Daten: nichts für heute
    function reihe(key) { var a = []; for (var k = i0; k <= iEnde; k++) { var v = num(h[key] && h[key][k]); if (v !== null) a.push(v); } return a; }
    var di = d && d.time ? d.time.indexOf(heute) : -1;
    var sunset = di >= 0 ? d.sunset[di] : null, sunrise = di >= 0 ? d.sunrise[di] : null;

    var pop = reihe('precipitation_probability');
    if (pop.length && Math.max.apply(null, pop) >= 40) out.push({ id: 'schirm', ikon: 'rain', text: 'Schirm mitnehmen: Regenrisiko ' + Math.round(Math.max.apply(null, pop)) + ' %' });
    var tmp = reihe('temperature_2m');
    // Frost: auch die kommende Nacht, bis zum Sonnenaufgang morgen
    var bisFrost = (d && d.sunrise && di >= 0 && d.sunrise[di + 1]) || WL.ortsZeit(off, ms + 864e5).datum + 'T07:00', frostReihe = [];
    if (h.time[i0] && h.time[i0].slice(0, 10) === heute) for (i = i0; i < h.time.length && h.time[i] < bisFrost; i++) { var tf = num(h.temperature_2m && h.temperature_2m[i]); if (tf !== null) frostReihe.push(tf); }
    if (frostReihe.length && Math.min.apply(null, frostReihe) <= 0) out.push({ id: 'frost', ikon: 'fog', text: 'Frost bis ' + WL.temp(Math.min.apply(null, frostReihe), einh) + ': Scheiben kratzen, Pflanzen schützen' });
    if (tmp.length && Math.max.apply(null, tmp) >= 30) out.push({ id: 'hitze', ikon: 'sun', text: 'Heiß bis ' + WL.temp(Math.max.apply(null, tmp), einh) + ': viel trinken, Mittagssonne meiden' });
    var uvMax = null;
    for (i = i0; i <= iEnde; i++) {
      if (sunset && h.time[i] >= sunset) continue;   // nach Sonnenuntergang nie
      var uv = num(h.uv_index && h.uv_index[i]); if (uv !== null && (uvMax === null || uv > uvMax)) uvMax = uv;
    }
    if (uvMax !== null && uvMax >= 6) out.push({ id: 'uv', ikon: 'sun', text: 'UV-Index ' + Math.round(uvMax) + ': Sonnencreme und Hut' });
    if (sunset && nowIso < sunset) {
      out.push({ id: 'golden', ikon: 'sunset', text: 'Goldene Stunde ab ' + zeitAus(WL.isoZuMs(sunset, off) - 45 * 60000, off) + ' Uhr: weiches Licht für Fotos' });
    }
    if (sunset && sunrise) {
      var vorSonnenaufgang = nowIso < sunrise;
      var von = vorSonnenaufgang ? nowIso : sunset, bis = vorSonnenaufgang ? sunrise : ((d.sunrise && d.sunrise[di + 1]) || WL.ortsZeit(off, ms + 864e5).datum + 'T07:00');
      var summe = 0, n = 0;
      for (i = i0; i < h.time.length && h.time[i] < bis; i++) {
        if (h.time[i] < von.slice(0, 13) + ':00') continue;
        var cc = num(h.cloud_cover && h.cloud_cover[i]); if (cc !== null) { summe += cc; n++; }
      }
      if (n && summe / n <= 20) {
        var ab = WL.isoZuMs(sunset, off) + 60 * 60000;
        out.push({ id: 'sterne', ikon: 'moon', text: !vorSonnenaufgang && ms < ab ? 'Heute Nacht klar: Sterne ab etwa ' + zeitAus(ab, off) + ' Uhr' : 'Heute Nacht klar: gute Sicht auf die Sterne' });
      }
    }
    if (daten.ort && daten.ort.meer === true && daten.meer) {
      var ev = gezeiten(daten.meer, off, ms).sort(function (a, b) { return a.ms - b.ms; }).slice(0, 2);
      if (ev.length) out.push({ id: 'gezeiten', ikon: 'tropfen', text: ev.map(function (e) { return e.art + ' um ' + zeitAus(e.ms, off) + ' Uhr'; }).join(', ') });
    }
    out = out.slice(0, 3);
    if (!out.length) out.push({ id: 'nichts', ikon: 'cloudsun', text: 'Heute nichts Besonderes' });
    return out;
  };

  // ---------- Zeichnen: Bausteine ----------
  var SEV = { minor: [1, 'Wetterwarnung'], moderate: [2, 'Markante Warnung'], severe: [3, 'Unwetterwarnung'], extreme: [4, 'Extreme Unwetterwarnung'] };

  // kopfRechts (HTML, optional): steht rechts neben der Überschrift, z. B. die Pille „Stufe 2 von 4“
  function kachel(cls, id, titel, inner, kopfRechts) {
    var h2 = titel ? '<h2 class="kachel-kopf" id="' + id + '-t">' + esc(titel) + '</h2>' : '';
    return '<section class="kachel ' + cls + '" aria-labelledby="' + id + '-t">' + (kopfRechts ? '<div class="kopfzeile">' + h2 + kopfRechts + '</div>' : h2) + inner + '</section>';
  }
  function ruhig(satz) { return '<p class="ruhig">' + esc(satz) + '</p>'; }
  // Windrose klein (nur Pfeil) – der Pfeil zeigt, wohin der Wind weht
  function roseKlein(grad, cls) {
    if (num(grad) === null) return '';
    return '<svg class="rose ' + (cls || '') + '" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14"/><g class="pfeil" transform="rotate(' + Math.round(grad + 180) + ' 16 16)"><path d="M16 25V7M11 12l5-5 5 5"/></g></svg>';
  }
  function roseGross(grad) {
    var t = '', ns = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
    for (var i = 0; i < 8; i++) {
      var a = i * 45 * RAD, x = 60 + Math.sin(a) * 52, y = 60 - Math.cos(a) * 52;
      t += '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" class="rose-text">' + ns[i] + '</text>';
    }
    var ticks = '';
    for (var k = 0; k < 8; k++) { var b = k * 45 * RAD; ticks += '<line x1="' + (60 + Math.sin(b) * 34).toFixed(1) + '" y1="' + (60 - Math.cos(b) * 34).toFixed(1) + '" x2="' + (60 + Math.sin(b) * 40).toFixed(1) + '" y2="' + (60 - Math.cos(b) * 40).toFixed(1) + '"/>'; }
    var pfeil = num(grad) === null ? '' : '<g class="pfeil" transform="rotate(' + Math.round(grad + 180) + ' 60 60)"><path d="M60 86V34M47 47l13-13 13 13"/></g>';
    return '<svg class="rose rose-gross" viewBox="0 0 120 120" role="img" aria-label="Wind aus ' + esc(WL.windRichtungWort(grad)) + '"><circle cx="60" cy="60" r="40"/>' + ticks + t + pfeil + '</svg>';
  }
  // Luft-Ring: Indexzahl innen, Ringfarbe nach Stufe
  function ring(aqi, gross) {
    var s = WL.luftStufe(aqi), r = gross ? 30 : 11, c = gross ? 36 : 14, v = gross ? 72 : 28;
    return '<svg class="ring' + (gross ? ' ring-gross' : '') + '" viewBox="0 0 ' + v + ' ' + v + '" aria-hidden="true"><circle class="ring-bahn" cx="' + c + '" cy="' + c + '" r="' + r + '"/>' +
      (s.stufe ? '<circle class="ring-farbe" cx="' + c + '" cy="' + c + '" r="' + r + '" style="stroke:' + s.farbe + '"/>' : '') +
      '<text class="ring-zahl" x="' + c + '" y="' + c + '">' + (s.stufe ? Math.round(aqi) : '–') + '</text></svg>';
  }

  function modWarnung(daten) {
    var w = (daten.warnungen || []).slice();
    if (!w.length) return '';
    var off = offsetVon(daten);
    w.sort(function (a, b) { return (SEV[b.severity] || [1])[0] - (SEV[a.severity] || [1])[0]; });
    var erste = w[0], st = SEV[erste.severity] || SEV.minor;
    function zeitraum(x) {
      var a = Date.parse(x.onset), b = Date.parse(x.expires);
      if (isNaN(a)) return '';
      return isNaN(b) ? 'ab ' + tagZeit(a, off) + ' Uhr' : tagZeit(a, off) + ' Uhr bis ' + tagZeit(b, off) + ' Uhr';
    }
    var html = '<p class="warn-titel">' + esc(erste.headline_de || erste.event || st[1]) + '</p>' +
      '<p class="warn-meta">' + esc(daten.ort.name) + (zeitraum(erste) ? ' · ' + esc(zeitraum(erste)) : '') + '</p>' +
      (erste.description_de ? '<p class="warn-text">' + esc(erste.description_de) + '</p>' : '') +
      (erste.instruction_de ? '<p class="warn-tipp"><strong>Das hilft: </strong>' + esc(erste.instruction_de) + '</p>' : '');
    if (w.length > 1) {
      html += '<ul class="warn-weitere">' + w.slice(1, 4).map(function (x) {
        var s2 = SEV[x.severity] || SEV.minor;
        return '<li><strong>' + esc(s2[1]) + ':</strong> ' + esc(x.event || x.headline_de || '') + (zeitraum(x) ? ' · ' + esc(zeitraum(x)) : '') + '</li>';
      }).join('') + '</ul>';
    }
    html += '<p class="fuss">Quelle: DWD über Bright Sky</p>';
    return kachel('k-warnung warn-' + st[0], 'm-warnung', st[1], html, '<span class="pille">Stufe ' + st[0] + ' von 4</span>');
  }

  function modAktuell(daten) {
    var f = daten.forecast, c = f.current || {}, h = f.hourly, d = f.daily, off = offsetVon(daten), einh = daten.einheiten;
    var ms = jetztMs(daten), ih = jetztIdx(h.time, off, ms), di = Math.max(0, d.time.indexOf(WL.ortsZeit(off, ms).datum));
    var tag = c.is_day == null ? true : !!c.is_day, code = c.weather_code;
    var ansicht = WL.merk('aktuell-ansicht') === 'radar' ? 'radar' : 'werte';
    var heissAria = tempAria(c.temperature_2m, einh);
    var wind = '<dt>Wind</dt><dd>' + windTeile(c.wind_speed_10m, einh) + ' <span class="richtung">' + esc(WL.windRichtung(c.wind_direction_10m)) + '</span>' + roseKlein(c.wind_direction_10m) + '</dd>';
    var werte = '<dl class="werte">' +
      '<div><dt>Gefühlt</dt><dd>' + zahlEinheit(WL.temp(c.apparent_temperature, einh)) + '</dd></div>' +
      '<div><dt>Taupunkt</dt><dd>' + zahlEinheit(WL.temp(h.dew_point_2m && h.dew_point_2m[ih], einh)) + '</dd></div>' +
      '<div><dt>Feuchte</dt><dd>' + zahlEinheit(c.relative_humidity_2m == null ? '–' : Math.round(c.relative_humidity_2m), '%') + '</dd></div>' +
      '<div><dt>Druck</dt><dd>' + zahlEinheit(c.pressure_msl == null ? '–' : Math.round(c.pressure_msl), 'hPa') + '</dd></div>' +
      '<div>' + wind + '</div>' +
      '<div><dt>Regen heute</dt><dd>' + zahlEinheit(zahlDe(d.precipitation_sum && d.precipitation_sum[di], 1), 'mm') + '</dd></div></dl>';
    var radarHtml;
    if (daten.offline) radarHtml = ruhig('Offline: Radar nicht verfügbar');
    else if (!daten.radar || !daten.radar.frames || !daten.radar.frames.length) radarHtml = ruhig('Radar gerade nicht erreichbar');
    else {
      var fr = daten.radar.frames[daten.radar.frames.length - 1];
      radarHtml = '<div class="karte-box"><div class="karte" role="img" aria-label="Radarkarte mit Regen der letzten Aufnahme, Ort ' + esc(daten.ort.name) + '"></div>' +
        '<span class="karte-zeit">' + esc(zeitAus(fr.time * 1000, off)) + ' Uhr</span><span class="karte-art">Radar</span></div>' +
        '<p class="fuss">© OpenStreetMap-Mitwirkende · RainViewer</p>';
    }
    var html = '<div class="aktuell">' +
      '<div class="aktuell-links"><p class="aktuell-label">Aktuell <span class="aktuell-zeit">' + esc(WL.hhmm(c.time)) + '</span></p><div class="sym sym-aktuell">' + sym(WL.symbolName(code, tag)) + '</div>' +
      '<p class="hero" role="img" aria-label="' + esc(heissAria) + '">' + esc(WL.temp(c.temperature_2m, einh)) + '</p>' +
      '<span class="punkte" aria-hidden="true"><i class="' + (ansicht === 'werte' ? 'an' : '') + '"></i><i class="' + (ansicht === 'radar' ? 'an' : '') + '"></i></span>' +
      '<button type="button" class="wechsel tippbar" data-aktion="ansicht" aria-label="Ansicht wechseln"></button>' +
      '<span class="sr-only" aria-live="polite" data-ansicht-text>Ansicht: ' + (ansicht === 'radar' ? 'Radar-Karte' : 'Werte') + '</span></div>' +
      '<div class="aktuell-rechts"><div class="ansicht ansicht-werte' + (ansicht === 'werte' ? '' : ' aus') + '"><p class="wetter-text">' + esc(WL.wetterText(code, tag)) + '</p>' + werte + '</div>' +
      '<div class="ansicht ansicht-radar' + (ansicht === 'radar' ? '' : ' aus') + '">' + radarHtml + '</div></div></div>';
    return kachel('k-aktuell k-gross', 'm-aktuell', 'Aktuell in ' + daten.ort.name, html);
  }

  function modStunden(daten) {
    var f = daten.forecast, h = f.hourly, off = offsetVon(daten), einh = daten.einheiten, heute = WL.ortsZeit(off, jetztMs(daten)).datum;
    var idx = R.stundenIndizes(h, off, jetztMs(daten));
    if (!idx.length) return kachel('k-stunden k-mittel', 'm-stunden', 'Stunden', ruhig('Für die nächsten Stunden liegen keine Daten vor'));
    var sp = idx.map(function (i) {
      var t = h.time[i], tag = h.is_day ? !!h.is_day[i] : true, code = h.weather_code[i];
      var pop = num(h.precipitation_probability && h.precipitation_probability[i]);
      return '<div class="std"><p class="std-zeit">' + (t.slice(0, 10) === heute ? '' : esc(WL.wochentag(t)) + ' ') + uhr(t) + '</p>' +
        '<div class="sym sym-stunden">' + sym(WL.symbolName(code, tag)) + '</div>' +
        '<p class="std-text">' + esc(WL.wetterText(code, tag)) + '</p>' +
        '<p class="std-temp">' + esc(WL.temp(h.temperature_2m[i], einh)) + '</p>' +
        '<p class="std-regen">' + ikon('tropfen', 'ikon-klein') + '<span class="sr-only">Regenwahrscheinlichkeit </span>' + zahlEinheit(pop === null ? '–' : Math.round(pop), '%') + '</p>' +
        '<p class="std-wind"><span class="sr-only">Wind </span>' + windTeile(h.wind_speed_10m[i], einh) + ' <span class="richtung">' + esc(WL.windRichtung(h.wind_direction_10m[i])) + '</span></p></div>';
    }).join('');
    return kachel('k-stunden k-mittel', 'm-stunden', 'Stunden', '<div class="stunden">' + sp + '</div>');
  }

  function modMeteogramm() {
    return '<section class="kachel k-meteogramm k-klein" aria-labelledby="m-meteogramm-t"><h2 class="kachel-kopf" id="m-meteogramm-t"><button type="button" class="kachel-kopf-knopf tippbar" data-aktion="graphs">Meteogramm</button></h2>' +
      '<div id="start-meteogramm" class="mg"></div>' +
      '<div class="fussleiste"><button type="button" class="chip tippbar" data-aktion="graphs">Graphs öffnen' + ikon('chevron', 'ikon-klein') + '</button></div></section>';
  }

  function modTage(daten) {
    var f = daten.forecast, d = f.daily, einh = daten.einheiten, off = offsetVon(daten), heute = WL.ortsZeit(off, jetztMs(daten)).datum;
    var aqi = R.luftTage(daten.luft);
    var rows = d.time.map(function (datum, i) {
      var ist = i === 0 && datum === heute, a = aqi[datum] === undefined ? null : aqi[datum], s = WL.luftStufe(a);
      var sonne = num(d.sunshine_duration && d.sunshine_duration[i]), mm = num(d.precipitation_sum && d.precipitation_sum[i]), pop = num(d.precipitation_probability_max && d.precipitation_probability_max[i]);
      var text = WL.wetterText(d.weather_code[i], true);
      return '<div class="tag' + (ist ? ' heute' : '') + '">' +
        '<div class="t-tag"><span class="tn">' + (ist ? 'Heute' : esc(WL.wochentag(datum))) + '</span><span class="td">' + esc(WL.datumKurz(datum)) + '</span></div>' +
        '<div class="t-sym"><span class="sym sym-liste">' + sym(WL.symbolName(d.weather_code[i], true)) + '</span><span class="sr-only">' + esc(text) + '</span></div>' +
        '<div class="t-temp"><span class="tmax"><span class="sr-only">Höchstwert </span>' + esc(WL.temp(d.temperature_2m_max[i], einh)) + '</span><span class="tmin"><span class="sr-only">Tiefstwert </span>' + esc(WL.temp(d.temperature_2m_min[i], einh)) + '</span></div>' +
        '<div class="t-sr"><span class="zeile">' + ikon('sun', 'ikon-klein') + '<span class="sr-only">Sonne </span>' + zahlEinheit(zahlDe(sonne === null ? null : sonne / 3600, 1), 'h') + '</span>' +
        '<span class="zeile">' + ikon('tropfen', 'ikon-klein') + '<span class="sr-only">Regen </span>' + zahlEinheit(zahlDe(mm, 1), 'mm') + (pop === null ? '' : ' <span class="pop">· ' + Math.round(pop) + ' %</span>') + '</span></div>' +
        '<div class="t-luft">' + (s.stufe ? ring(a) + '<span class="luft-wort">' + esc(s.wort) + '</span><span class="sr-only">Luftqualität</span>' : '<span class="leer-strich" aria-label="Keine Luftdaten">–</span>') + '</div>' +
        '<div class="t-wind"><span class="sr-only">Wind bis </span><span class="nowrap">' + windTeile(d.wind_speed_10m_max[i], einh) + '</span><span class="richtung">' + esc(WL.windRichtung(d.wind_direction_10m_dominant && d.wind_direction_10m_dominant[i])) + '</span></div></div>';
    }).join('');
    return kachel('k-tage k-gross', 'm-tage', 'Vorhersage ' + d.time.length + ' Tage', '<div class="liste tage">' + rows + '</div>');
  }

  function modLuft(daten) {
    var l = daten.luft && daten.luft.current;
    if (!l) return kachel('k-luft k-mittel', 'm-luft', 'Luftqualität', ruhig('Zurzeit keine Luftdaten für diesen Ort'));
    var a = num(l.european_aqi), s = WL.luftStufe(a);
    var deut = s.stufe === 1 ? 'Gute Luft zum Lüften' : s.stufe === 2 ? 'Für empfindliche Menschen heute lieber kurz lüften' : s.stufe === 3 ? 'Heute lieber drinnen bleiben' : 'Zurzeit keine Luftdaten für diesen Ort';
    function w(titel, v) { return '<div><dt>' + titel + '</dt><dd>' + zahlEinheit(zahlDe(num(v), 0), 'µg/m³') + '</dd></div>'; }
    return kachel('k-luft k-mittel', 'm-luft', 'Luftqualität',
      '<div class="luft"><div class="luft-ring">' + ring(a, true) + '<p class="luft-wort-gross">' + esc(s.wort) + '</p></div>' +
      '<dl class="werte">' + w('Feinstaub PM10', l.pm10) + w('Feinstaub PM2,5', l.pm2_5) + w('Ozon', l.ozone) + '</dl></div>' +
      '<p class="deutung">' + esc(deut) + '</p>');
  }

  function modTipps(daten) {
    var t = R.tipps(daten);
    return kachel('k-tipps k-gross', 'm-tipps', 'Was heute geht', '<ul class="tipps">' + t.map(function (x) {
      return '<li class="tipp">' + ikon(x.ikon) + '<span>' + esc(x.text) + '</span></li>';
    }).join('') + '</ul>');
  }

  function modSonne(daten) {
    var d = daten.forecast.daily, off = offsetVon(daten), ms = jetztMs(daten), heute = WL.ortsZeit(off, ms).datum;
    var di = d.time.indexOf(heute); if (di < 0) di = 0;
    var auf = d.sunrise[di], unter = d.sunset[di];
    if (!auf || !unter) return kachel('k-sonne k-gross', 'm-sonne', 'Sonne', ruhig('Zurzeit keine Sonnenzeiten für diesen Ort'));
    var a = WL.isoZuMs(auf, off), u = WL.isoZuMs(unter, off), fa = (ms - a) / (u - a);
    var fc = Math.max(-0.12, Math.min(1.12, fa));
    var x = 120 - 100 * Math.cos(Math.PI * fc), y = 80 - 60 * Math.sin(Math.PI * fc);
    var satz;
    if (fa >= 0 && fa <= 1) satz = 'Noch ' + WL.minutenAlsText((u - ms) / 60000) + ' Tageslicht';
    else if (fa < 0) satz = 'Die Sonne geht heute um ' + WL.hhmm(auf) + ' Uhr auf';
    else satz = 'Die Sonne ist untergegangen' + (d.sunrise[di + 1] ? ', morgen geht sie um ' + WL.hhmm(d.sunrise[di + 1]) + ' Uhr auf' : '');
    var svg = '<svg class="bogen" viewBox="0 0 240 110" role="img" aria-label="' + esc(satz) + '"><line class="horizont" x1="8" y1="80" x2="232" y2="80"/>' +
      '<path class="bogen-bahn" d="M20 80A100 60 0 0 1 220 80" pathLength="100"/>' +
      (fa > 0 ? '<path class="bogen-tag" d="M20 80A100 60 0 0 1 220 80" pathLength="100" style="stroke-dasharray:' + (Math.min(fa, 1) * 100).toFixed(1) + ' 100"/>' : '') +
      '<circle class="sonne-punkt" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="8"/></svg>';
    return kachel('k-sonne k-gross', 'm-sonne', 'Sonne',
      svg + '<div class="sonne-zeiten"><p>' + ikon('sunrise') + '<span><span class="klein">Aufgang</span><b class="zahl">' + esc(WL.hhmm(auf)) + ' Uhr</b></span></p>' +
      '<p>' + ikon('sunset') + '<span><span class="klein">Untergang</span><b class="zahl">' + esc(WL.hhmm(unter)) + ' Uhr</b></span></p></div>' +
      '<dl class="werte werte-quer"><div><dt>Tageslänge</dt><dd>' + zahlEinheit(WL.minutenAlsText((d.daylight_duration[di] || 0) / 60)) + '</dd></div>' +
      '<div><dt>Sonnenstunden</dt><dd>' + zahlEinheit(WL.minutenAlsText((d.sunshine_duration[di] || 0) / 60)) + '</dd></div></dl><p class="deutung">' + esc(satz) + '</p>');
  }

  function mondSvg(anteil, phase) {
    var r = 30, k = Math.cos(2 * Math.PI * phase), rx = Math.abs(k) * r, zun = phase < 0.5;
    var aussen = zun ? 1 : 0, innen = zun ? (k > 0 ? 0 : 1) : (k > 0 ? 1 : 0);
    var pfad = anteil < 0.02 ? '' : 'M36 6A30 30 0 0 ' + aussen + ' 36 66A' + rx.toFixed(2) + ' 30 0 0 ' + innen + ' 36 6Z';
    return '<svg class="mond" viewBox="0 0 72 72" aria-hidden="true"><circle class="mond-dunkel" cx="36" cy="36" r="30"/><path class="mond-hell" d="' + pfad + '"/></svg>';
  }
  function modMond(daten) {
    var off = offsetVon(daten), o = daten.ort, m = R.mond(jetztMs(daten), o.lat, o.lon, off);
    return kachel('k-mond k-gross', 'm-mond', 'Mond',
      '<div class="mond-kopf">' + mondSvg(m.anteil, m.phase) + '<div><p class="mond-name">' + esc(m.name) + '</p><p class="deutung">' + esc(m.text) + '</p></div></div>' +
      '<dl class="werte werte-quer"><div><dt>Mondaufgang</dt><dd>' + (m.aufgang ? zahlEinheit(m.aufgang, 'Uhr') : 'heute keiner') + '</dd></div>' +
      '<div><dt>Monduntergang</dt><dd>' + (m.untergang ? zahlEinheit(m.untergang, 'Uhr') : 'heute keiner') + '</dd></div></dl>' +
      '<ul class="phasen">' + m.naechste.map(function (x) { return '<li><span>' + esc(x.name) + '</span><b class="zahl">' + esc(x.text) + '</b></li>'; }).join('') + '</ul>');
  }

  function modWind(daten) {
    var f = daten.forecast, c = f.current || {}, h = f.hourly, off = offsetVon(daten), einh = daten.einheiten, ms = jetztMs(daten);
    var bf = WL.beaufort(c.wind_speed_10m), i0 = jetztIdx(h.time, off, ms), zellen = '';
    for (var i = i0; i < Math.min(h.time.length, i0 + 18); i++) {
      zellen += '<li><span class="klein">' + p2(WL.stundeVon(h.time[i])) + ' Uhr</span>' + roseKlein(h.wind_direction_10m[i], 'rose-mini') + '<b class="zahl">' + esc(zahlDe(WL.windWert(h.wind_speed_10m[i], einh), 0)) + '</b>' +
        '<span class="sr-only">' + esc(WL.windRichtungWort(h.wind_direction_10m[i])) + '</span></li>';
    }
    return kachel('k-wind k-gross', 'm-wind', 'Wind',
      '<div class="wind-kopf">' + roseGross(c.wind_direction_10m) + '<div><p class="wind-gross">' + windTeile(c.wind_speed_10m, einh) + '</p>' +
      '<p>aus ' + esc(WL.windRichtungWort(c.wind_direction_10m)) + '</p>' +
      '<p>Böen bis ' + windTeile(c.wind_gusts_10m, einh) + '</p>' +
      '<p class="deutung">' + (bf.bft === null ? '–' : 'Windstärke ' + bf.bft + ': ' + esc(bf.wort)) + '</p></div></div>' +
      '<p class="unterkopf">Verlauf, nächste 18 Stunden (' + esc(WL.windEinheit(einh)) + ')</p><ul class="wverlauf">' + zellen + '</ul>');
  }

  function modRadar(daten) {
    var f = daten.forecast, off = offsetVon(daten), ms = jetztMs(daten), c = f.current || {};
    var schnee = (c.weather_code >= 71 && c.weather_code <= 77) || c.weather_code === 85 || c.weather_code === 86;
    var rs = R.regenSatz(f.minutely_15, off, { ms: ms, schnee: schnee });
    var balken = rs.werte.map(function (v, i) {
      var cls = rs.nass[i] ? 'regen' : 'trocken', hoehe = R.balkenHoehe(v);
      return '<span class="balken ' + cls + '" style="--hoehe:' + hoehe.toFixed(0) + '%"><i></i></span>';
    }).join('');
    var achse = rs.stand ? '<span>' + esc(rs.stand) + '</span><span>+1 h</span><span>+2 h</span>' : '<span>Jetzt</span><span>+1 h</span><span>+2 h</span>';
    var karte;
    if (daten.offline) karte = ruhig('Offline: Radar nicht verfügbar');
    else if (!daten.radar || !daten.radar.frames || !daten.radar.frames.length) karte = ruhig('Radar gerade nicht erreichbar');
    else {
      var fr = daten.radar.frames[daten.radar.frames.length - 1];
      karte = '<div class="karte-box karte-hoch"><div class="karte" role="img" aria-label="Radarkarte mit Regen der letzten Aufnahme, Ort ' + esc(daten.ort.name) + '"></div>' +
        '<span class="karte-zeit">' + esc(zeitAus(fr.time * 1000, off)) + ' Uhr</span><span class="karte-art">Radar</span>' +
        '<button type="button" class="karte-tipp tippbar" data-aktion="radsat" aria-label="Karte öffnen: Rad/Sat"></button></div>' +
        '<p class="fuss">© OpenStreetMap-Mitwirkende · RainViewer</p>';
    }
    return kachel('k-radar k-gross', 'm-radar', 'Regenradar',
      '<p class="regen-satz">' + esc(rs.satz) + '</p>' +
      '<div class="balken-feld" role="img" aria-label="' + esc(rs.satz + (rs.stand ? ' (Stand ' + rs.stand + ', Balken je 15 Minuten ab dann)' : '')) + '"><div class="balken-reihe">' + balken + '</div><div class="balken-achse" aria-hidden="true">' + achse + '</div></div>' +
      karte +
      '<ul class="legende"><li><i class="leicht"></i>leicht</li><li><i class="maessig"></i>mäßig</li><li><i class="stark"></i>stark</li></ul>' +
      '<div class="radar-fuss"><p class="trocken">' + esc(R.trockenBis(f.hourly, off, ms)) + '</p><button type="button" class="chip tippbar" data-aktion="radsat">Karte öffnen' + ikon('chevron', 'ikon-klein') + '</button></div>');
  }

  function modPollen(daten) {
    var l = daten.luft && daten.luft.current, off = offsetVon(daten);
    if (!l) return kachel('k-pollen k-gross', 'm-pollen', 'Pollen', ruhig('Zurzeit keine Pollendaten für diesen Ort'));
    var gesehen = false;
    var zeilen = WL.POLLEN.map(function (p) {
      var v = num(l[p[0]]), s = WL.pollenStufe(v, p[0].replace('_pollen', ''));
      if (v !== null) gesehen = true;
      var voll = s.stufe === 3 ? 4 : (s.stufe || 0), dots = '';
      for (var i = 0; i < 4; i++) dots += '<i class="' + (i < voll ? 'an' : '') + '"></i>';
      return '<li><span class="p-name">' + esc(p[1]) + '</span><span class="punkte-reihe" aria-hidden="true">' + dots + '</span><span class="p-wort' + (v === null ? ' still' : '') + '">' + esc(s.wort) + '</span></li>';
    }).join('');
    if (!gesehen) return kachel('k-pollen k-gross', 'm-pollen', 'Pollen', ruhig('Zurzeit keine Pollendaten für diesen Ort'));
    return kachel('k-pollen k-gross', 'm-pollen', 'Pollen', '<ul class="pollen">' + zeilen + '</ul><p class="deutung">' + esc(R.pollenMorgen(daten.luft, off, jetztMs(daten)).satz) + '</p>');
  }

  // ---------- Leaflet-Karten ----------
  function kartenAbbauen() { karten.forEach(function (m) { try { m.remove(); } catch (e) { } }); karten = []; }
  function karteBauen(el, daten) {
    var L = global.L;
    if (!el || el._wl || !L || daten.offline || !daten.radar || !daten.radar.frames || !daten.radar.frames.length) return;
    var o = daten.ort, map = L.map(el, { zoomControl: false, attributionControl: false, dragging: false, touchZoom: false, doubleClickZoom: false, scrollWheelZoom: false, boxZoom: false, keyboard: false, tap: false, zoomAnimation: false, fadeAnimation: false, inertia: false, center: [o.lat, o.lon], zoom: 7 });
    map.createPane('grund');
    L.tileLayer(OSM, { pane: 'grund', maxZoom: 7 }).addTo(map);
    var fr = daten.radar.frames[daten.radar.frames.length - 1];
    if (global.Bausteine && global.Bausteine.radarSchicht) global.Bausteine.radarSchicht(daten.radar.host, fr.path).addTo(map);
    L.circleMarker([o.lat, o.lon], { radius: 6, weight: 2, className: 'ort-punkt', interactive: false }).addTo(map);
    el._wl = map; karten.push(map);
    global.requestAnimationFrame(function () { try { map.invalidateSize(); } catch (e) { } });
  }
  function kartenStarten(container, daten) {
    global.requestAnimationFrame(function () {
      var a = container.querySelector('.ansicht-radar:not(.aus) .karte'), r = container.querySelector('.k-radar .karte');
      karteBauen(a, daten); karteBauen(r, daten);
    });
  }

  // ---------- Schnittstelle ----------
  var MODULE = [
    ['warnung', modWarnung], ['aktuell', modAktuell], ['stunden', modStunden], ['meteogramm', modMeteogramm], ['tage', modTage], ['luft', modLuft],
    ['tipps', modTipps], ['sonne', modSonne], ['mond', modMond], ['wind', modWind], ['radar', modRadar], ['pollen', modPollen]
  ];
  var MODUL_NAMEN = { aktuell: 'Aktuell', stunden: 'Stunden', meteogramm: 'Meteogramm', tage: 'Tagesliste', luft: 'Luftqualität', tipps: 'Was heute geht', sonne: 'Sonne', mond: 'Mond', wind: 'Wind', radar: 'Regenradar', pollen: 'Pollen' };
  var M = {};
  M.rechnen = { mond: R.mond, tipps: R.tipps, regenSatz: R.regenSatz, stundenIndizes: R.stundenIndizes, luftTage: R.luftTage, pollenMorgen: R.pollenMorgen, hauptphasen: R.hauptphasen, trockenBis: R.trockenBis, gezeiten: R.gezeiten, balkenHoehe: R.balkenHoehe };

  function bind(container, daten, ctx) {
    if (gebunden) gebunden.el.removeEventListener('click', gebunden.fn);
    var fn = function (ev) {
      var b = ev.target.closest && ev.target.closest('[data-aktion]'); if (!b || !container.contains(b)) return;
      var a = b.getAttribute('data-aktion');
      if (a === 'graphs') ctx.oeffneReiter('graphs');
      else if (a === 'radsat') ctx.oeffneReiter('radsat');
      else if (a === 'nochmal') ctx.nochmal();
      else if (a === 'ansicht') {
        var radar = container.querySelector('.ansicht-radar'), werte = container.querySelector('.ansicht-werte');
        var zuRadar = !radar.classList.contains('aus') ? false : true;
        radar.classList.toggle('aus', !zuRadar); werte.classList.toggle('aus', zuRadar);
        var pk = container.querySelectorAll('.punkte i'); if (pk.length > 1) { pk[0].classList.toggle('an', !zuRadar); pk[1].classList.toggle('an', zuRadar); }
        var tx = container.querySelector('[data-ansicht-text]'); if (tx) tx.textContent = 'Ansicht: ' + (zuRadar ? 'Radar-Karte' : 'Werte');
        WL.merk('aktuell-ansicht', zuRadar ? 'radar' : 'werte');
        if (zuRadar) kartenStarten(container, daten);
      }
    };
    container.addEventListener('click', fn);
    gebunden = { el: container, fn: fn };
  }

  M.rendern = function (container, daten, ctx) {
    kartenAbbauen();
    container.removeAttribute('aria-busy');
    container.innerHTML = MODULE.map(function (m) {
      try { return m[1](daten); }
      catch (e) { return m[0] === 'warnung' ? '' : kachel('k-gross', 'm-' + m[0], MODUL_NAMEN[m[0]] || m[0], ruhig('Dieses Modul lässt sich gerade nicht anzeigen.')); }
    }).join('');
    bind(container, daten, ctx || {});
    kartenStarten(container, daten);
  };

  M.skeleton = function (container) {
    kartenAbbauen();
    function z(n, cls) { var s = ''; for (var i = 0; i < n; i++) s += '<span class="skel ' + (cls || '') + '"></span>'; return s; }
    var k = function (cls, inner) { return '<section class="kachel ' + cls + ' skel-kachel" aria-hidden="true">' + inner + '</section>'; };
    container.setAttribute('aria-busy', 'true');
    container.innerHTML =
      k('k-aktuell k-gross', '<span class="skel skel-kopf"></span><div class="aktuell"><div class="aktuell-links">' + z(1, 'skel-sym') + z(1, 'skel-hero') + '</div><div class="aktuell-rechts">' + z(6, 'skel-zeile') + '</div></div>') +
      k('k-stunden k-mittel', '<span class="skel skel-kopf"></span><div class="stunden">' + z(3, 'skel-spalte') + '</div>') +
      k('k-meteogramm k-klein', '<span class="skel skel-kopf"></span>' + z(1, 'skel-block')) +
      k('k-tage k-gross', '<span class="skel skel-kopf"></span>' + z(8, 'skel-reihe')) +
      k('k-luft k-mittel', '<span class="skel skel-kopf"></span>' + z(1, 'skel-block') + z(2, 'skel-zeile')) +
      k('k-tipps k-gross', '<span class="skel skel-kopf"></span>' + z(3, 'skel-zeile')) +
      k('k-sonne k-gross', '<span class="skel skel-kopf"></span>' + z(1, 'skel-block') + z(2, 'skel-zeile')) +
      k('k-mond k-gross', '<span class="skel skel-kopf"></span>' + z(1, 'skel-block') + z(2, 'skel-zeile')) +
      k('k-wind k-gross', '<span class="skel skel-kopf"></span>' + z(1, 'skel-block') + z(2, 'skel-zeile')) +
      k('k-radar k-gross', '<span class="skel skel-kopf"></span>' + z(1, 'skel-zeile') + z(1, 'skel-balken') + z(1, 'skel-block')) +
      k('k-pollen k-gross', '<span class="skel skel-kopf"></span>' + z(6, 'skel-zeile'));
  };

  M.fehler = function (container, satz, nochmal) {
    kartenAbbauen();
    container.removeAttribute('aria-busy');
    container.innerHTML = '<section class="kachel k-fehler" role="status"><span class="fehler-ikon">' + ikon('cloud') + '</span><p>' + esc(satz) + '</p><button type="button" class="button tippbar" data-aktion="nochmal">Erneut versuchen</button></section>';
    if (gebunden) gebunden.el.removeEventListener('click', gebunden.fn);
    var fn = function (ev) { if (ev.target.closest && ev.target.closest('[data-aktion="nochmal"]') && typeof nochmal === 'function') nochmal(); };
    container.addEventListener('click', fn);
    gebunden = { el: container, fn: fn };
  };

  global.Module = M;
})(window);
