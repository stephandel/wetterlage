// Tests für module.js (Rechenfunktionen und ein Zeichen-Test ohne Browser): node tests/module.test.js
'use strict';
const assert = require('node:assert');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const speicher = {};
const ctx = {
  console, document: { body: null },
  localStorage: { getItem: (k) => (k in speicher ? speicher[k] : null), setItem: (k, v) => { speicher[k] = String(v); }, removeItem: (k) => { delete speicher[k]; } },
  requestAnimationFrame: () => 0
};
ctx.window = ctx;
vm.createContext(ctx);
['gemeinsam.js', 'ikonen.js', 'symbole.js', 'module.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
const Module = ctx.Module, WL = ctx.WL, rechnen = Module.rechnen;

let ok = 0, fail = 0;
function test(name, fn) {
  try { fn(); ok++; console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FEHL ' + name + '\n       ' + String(e.message).split('\n').join('\n       ')); }
}
const eq = (a, b, m) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), m);

// ---------- Fixtures ----------
const OFF = 7200;                                  // Sommerzeit, 23.10.2026
const p2 = (n) => (n < 10 ? '0' : '') + n;
function stunden(tag0, tage) {                      // lokale ISO-Strings ab Mitternacht
  const out = [], d0 = Date.UTC(2026, 9, tag0);
  for (let i = 0; i < tage * 24; i++) { const d = new Date(d0 + i * 36e5); out.push(d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate()) + 'T' + p2(d.getUTCHours()) + ':00'); }
  return out;
}
const T = stunden(23, 8);
const fuell = (v) => T.map(() => v);
const lokal = (h, m, tag) => Date.UTC(2026, 9, tag || 23, h, m || 0) - OFF * 1000;   // Ortszeit → ms
function daten(opt) {
  opt = opt || {};
  const h = { time: T, temperature_2m: fuell(15), apparent_temperature: fuell(14), relative_humidity_2m: fuell(60), dew_point_2m: fuell(8), precipitation_probability: fuell(0), precipitation: fuell(0),
    weather_code: fuell(3), pressure_msl: fuell(1015), cloud_cover: fuell(80), wind_speed_10m: fuell(12), wind_direction_10m: fuell(225), wind_gusts_10m: fuell(25), uv_index: fuell(0), is_day: T.map((t) => { const s = +t.slice(11, 13); return s >= 8 && s < 18 ? 1 : 0; }), sunshine_duration: fuell(0) };
  (opt.stunde || []).forEach(([tag, std, key, wert]) => { h[key][(tag - 23) * 24 + std] = wert; });
  if (opt.wolken != null) h.cloud_cover = fuell(opt.wolken);
  const dt = T.filter((t, i) => i % 24 === 0).map((t) => t.slice(0, 10));
  const daily = { time: dt, weather_code: dt.map(() => 3), temperature_2m_max: dt.map(() => 16), temperature_2m_min: dt.map(() => 8), sunrise: dt.map((d) => d + 'T07:50'), sunset: dt.map((d) => d + 'T18:30'),
    daylight_duration: dt.map(() => 38000), sunshine_duration: dt.map(() => 18000), uv_index_max: dt.map(() => 3), precipitation_sum: dt.map(() => 1.2), precipitation_probability_max: dt.map(() => 30),
    wind_speed_10m_max: dt.map(() => 20), wind_gusts_10m_max: dt.map(() => 35), wind_direction_10m_dominant: dt.map(() => 200) };
  const mt = []; for (let i = 0; i < 12; i++) mt.push('2026-10-23T14:' + p2(i * 15 % 60)); // wird unten korrigiert
  const mini = { time: [], precipitation: [] };
  for (let i = 0; i < 12; i++) { const m = 14 * 60 + i * 15; mini.time.push('2026-10-23T' + p2(Math.floor(m / 60)) + ':' + p2(m % 60)); mini.precipitation.push(0); }
  const d = {
    ort: { id: 'x', name: 'Mannheim', lat: 49.4875, lon: 8.466, meer: opt.meer === undefined ? false : opt.meer },
    forecast: { utc_offset_seconds: OFF, current: { time: '2026-10-23T14:00', temperature_2m: 15.4, relative_humidity_2m: 60, apparent_temperature: 14, is_day: 1, precipitation: 0, weather_code: 3, cloud_cover: 80, pressure_msl: 1015, wind_speed_10m: 12, wind_direction_10m: 225, wind_gusts_10m: 25 }, hourly: h, daily: daily, minutely_15: mini },
    luft: opt.luft === undefined ? null : opt.luft, warnungen: opt.warnungen || null, radar: null, meer: opt.marine || null, stand: Date.now(), offline: false, einheiten: { temp: 'c', wind: 'kmh' },
    jetztMs: opt.jetzt == null ? lokal(14, 10) : opt.jetzt
  };
  return d;
}
function marine() {                                  // Gezeiten mit Periode 12,42 h
  const v = T.map((t, i) => 1.5 * Math.sin(2 * Math.PI * (i - 3) / 12.42));
  return { hourly: { time: T, sea_level_height_msl: v } };
}
const tippIds = (d) => rechnen.tipps(d).map((t) => t.id);

// ---------- regenSatz ----------
console.log('regenSatz');
function mini(werte, start) { const m0 = start == null ? 14 * 60 : start, o = { time: [], precipitation: [] }; werte.forEach((v, i) => { const m = m0 + i * 15; o.time.push('2026-10-23T' + p2(Math.floor(m / 60)) + ':' + p2(m % 60)); o.precipitation.push(v); }); return o; }
const J = lokal(14, 10);
test('trocken', () => assert.strictEqual(rechnen.regenSatz(mini([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), OFF, { ms: J }).satz, 'Die nächsten 2 Stunden bleibt es trocken'));
test('unter der Schwelle (0,09 mm) zählt nicht', () => assert.strictEqual(rechnen.regenSatz(mini([0.09, 0.09, 0, 0, 0, 0, 0, 0]), OFF, { ms: J }).satz, 'Die nächsten 2 Stunden bleibt es trocken'));
test('genau 0,1 mm zählt als Regen', () => assert.strictEqual(rechnen.regenSatz(mini([0, 0.1, 0, 0, 0, 0, 0, 0]), OFF, { ms: J }).satz, 'Regen ab 14:15 Uhr für 15 Minuten'));
test('Regen ab 14:30 für 45 Minuten', () => assert.strictEqual(rechnen.regenSatz(mini([0, 0, 0.3, 0.5, 0.2, 0, 0, 0, 0, 0, 0, 0]), OFF, { ms: J }).satz, 'Regen ab 14:30 Uhr für 45 Minuten'));
test('regnet schon: bis etwa', () => assert.strictEqual(rechnen.regenSatz(mini([0.4, 0.5, 0.2, 0, 0, 0, 0, 0, 0, 0, 0, 0]), OFF, { ms: J }).satz, 'Regen bis etwa 14:45 Uhr'));
test('Schnee', () => assert.strictEqual(rechnen.regenSatz(mini([0, 0.3, 0.3, 0, 0, 0, 0, 0]), OFF, { ms: J, schnee: true }).satz, 'Schnee ab 14:15 Uhr für 30 Minuten'));
test('nimmt 8 Werte ab der laufenden Viertelstunde', () => {
  const r = rechnen.regenSatz(mini([0, 0, 0.5, 0, 0, 0, 0, 0, 0, 0, 0, 0], 13 * 60 + 45), OFF, { ms: J });   // Start 13:45, jetzt 14:10 -> Index 1 (14:00)
  assert.strictEqual(r.werte.length, 8); assert.strictEqual(r.zeiten[0], '2026-10-23T14:00'); assert.strictEqual(r.satz, 'Regen ab 14:15 Uhr für 15 Minuten');
});
test('veraltete Daten (Stand 04:30, jetzt 12:00): 8 Balken, Satz mit „Stand“', () => {
  const r = rechnen.regenSatz(mini([0, 0, 0, 0, 0, 0, 0, 0], 4 * 60 + 30), OFF, { ms: lokal(12, 0) });
  assert.strictEqual(r.werte.length, 8); assert.strictEqual(r.stand, '04:30');
  assert.strictEqual(r.satz, 'Stand 04:30: Die nächsten 2 Stunden bleibt es trocken');
  const r12 = rechnen.regenSatz(mini(new Array(12).fill(0), 4 * 60 + 30), OFF, { ms: lokal(12, 0) });
  assert.strictEqual(r12.werte.length, 8); assert.strictEqual(r12.stand, '05:30');
});
test('veraltete Daten: Regen im Fenster, Satz beginnt mit „Stand“', () => {
  const r = rechnen.regenSatz(mini([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.4, 0.4], 4 * 60 + 30), OFF, { ms: lokal(12, 0) });
  assert.ok(r.satz.startsWith('Stand ' + r.stand + ': Regen'), r.satz); assert.strictEqual(r.werte.length, 8);
});
test('frische Daten: kein „Stand“', () => {
  const r = rechnen.regenSatz(mini([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), OFF, { ms: J });
  assert.strictEqual(r.stand, ''); assert.ok(!/Stand/.test(r.satz), r.satz);
});
test('Balkenhöhe: 100 % bei 1,5 und 3,0 mm, 50 % bei 0,75 mm, trocken 0', () => {
  assert.strictEqual(rechnen.balkenHoehe(1.5), 100); assert.strictEqual(rechnen.balkenHoehe(3), 100);
  assert.strictEqual(rechnen.balkenHoehe(0.75), 50); assert.strictEqual(rechnen.balkenHoehe(0.05), 0);
  assert.strictEqual(rechnen.balkenHoehe(0.1), 8);
});
test('Regen reicht über das Fenster hinaus: mindestens', () => assert.strictEqual(rechnen.regenSatz(mini([0, 0, 0, 0, 0, 0.3, 0.3, 0.3, 0, 0, 0, 0]), OFF, { ms: J }).satz, 'Regen ab 15:15 Uhr für mindestens 45 Minuten'));

// ---------- stundenIndizes ----------
console.log('stundenIndizes');
test('+6, +12, +18 Stunden ab der laufenden Stunde', () => eq(rechnen.stundenIndizes({ time: T }, OFF, J), [20, 26, 32]));
test('Zeiten sind volle Stunden und 6 h auseinander', () => { const i = rechnen.stundenIndizes({ time: T }, OFF, J); eq(i.map((x) => T[x]), ['2026-10-23T20:00', '2026-10-24T02:00', '2026-10-24T08:00']); });
test('am Ende der Daten werden Indizes abgeschnitten', () => eq(rechnen.stundenIndizes({ time: T.slice(0, 30) }, OFF, J), [20, 26]));

// ---------- tipps ----------
console.log('tipps');
test('Schirm greift ab 40 %, nicht bei 39 %', () => {
  assert.ok(!tippIds(daten({ stunde: [[23, 20, 'precipitation_probability', 39]] })).includes('schirm'));
  assert.ok(tippIds(daten({ stunde: [[23, 20, 'precipitation_probability', 40]] })).includes('schirm'), 'genau 40 % zählt');
  const t = rechnen.tipps(daten({ stunde: [[23, 20, 'precipitation_probability', 70]] }));
  assert.strictEqual(t[0].id, 'schirm'); assert.strictEqual(t[0].text, 'Schirm mitnehmen: Regenrisiko 70 %');
});
test('Schirm wertet nur Stunden ab jetzt bis Mitternacht', () => {
  assert.ok(!tippIds(daten({ stunde: [[23, 10, 'precipitation_probability', 90], [24, 3, 'precipitation_probability', 90]] })).includes('schirm'));
});
test('Frost', () => {
  const t = rechnen.tipps(daten({ stunde: [[23, 22, 'temperature_2m', -2]] })).find((x) => x.id === 'frost');
  assert.strictEqual(t.text, 'Frost bis -2°: Scheiben kratzen, Pflanzen schützen');
  assert.ok(!tippIds(daten({ stunde: [[23, 22, 'temperature_2m', 0.4]] })).includes('frost'));
  assert.ok(tippIds(daten({ stunde: [[23, 22, 'temperature_2m', 0]] })).includes('frost'));
});
test('Frost: auch die kommende Nacht (−3 °C um 05 Uhr morgen, jetzt 20:00)', () => {
  const d = daten({ jetzt: lokal(20, 0), stunde: [[24, 5, 'temperature_2m', -3]] });
  const t = rechnen.tipps(d).find((x) => x.id === 'frost');
  assert.ok(t && t.text.startsWith('Frost bis -3°'), JSON.stringify(rechnen.tipps(d)));
  assert.ok(!tippIds(daten({ jetzt: lokal(20, 0), stunde: [[24, 9, 'temperature_2m', -3]] })).includes('frost'), 'nach Sonnenaufgang morgen zählt nicht');
});
test('Frost in Fahrenheit: Anzeige folgt den Einheiten, Regel rechnet in °C', () => {
  const d = daten({ stunde: [[23, 22, 'temperature_2m', -2]] }); d.einheiten = { temp: 'f', wind: 'kmh' };
  assert.ok(rechnen.tipps(d).find((x) => x.id === 'frost').text.startsWith('Frost bis 28°'));
});
test('Hitze', () => {
  assert.strictEqual(rechnen.tipps(daten({ stunde: [[23, 15, 'temperature_2m', 31]] })).find((x) => x.id === 'hitze').text, 'Heiß bis 31°: viel trinken, Mittagssonne meiden');
  assert.ok(!tippIds(daten({ stunde: [[23, 15, 'temperature_2m', 29.4]] })).includes('hitze'));
  assert.ok(!tippIds(daten({ stunde: [[23, 11, 'temperature_2m', 33]] })).includes('hitze'), 'vergangene Stunde zählt nicht');
});
test('UV nur vor Sonnenuntergang', () => {
  assert.strictEqual(rechnen.tipps(daten({ stunde: [[23, 15, 'uv_index', 6.4]] })).find((x) => x.id === 'uv').text, 'UV-Index 6: Sonnencreme und Hut');
  assert.ok(!tippIds(daten({ stunde: [[23, 19, 'uv_index', 7]] })).includes('uv'), 'nach 18:30 nie');
  assert.ok(!tippIds(daten({ stunde: [[23, 15, 'uv_index', 5.9]] })).includes('uv'));
});
test('Goldene Stunde: 45 min vor Sonnenuntergang, nur solange die Sonne noch oben ist', () => {
  assert.strictEqual(rechnen.tipps(daten()).find((x) => x.id === 'golden').text, 'Goldene Stunde ab 17:45 Uhr: weiches Licht für Fotos');
  assert.ok(!tippIds(daten({ jetzt: lokal(18, 40) })).includes('golden'));
  assert.ok(!tippIds(daten({ jetzt: lokal(19, 30) })).includes('golden'));
});
test('Sterne: klare Nacht, Zeit = Sonnenuntergang + 60 min', () => {
  assert.strictEqual(rechnen.tipps(daten({ wolken: 10 })).find((x) => x.id === 'sterne').text, 'Heute Nacht klar: Sterne ab etwa 19:30 Uhr');
  assert.ok(!tippIds(daten({ wolken: 60 })).includes('sterne'));
  assert.ok(!tippIds(daten({ wolken: 21 })).includes('sterne'));
});
test('Küsten-Tipp nur mit meer:true', () => {
  const t = rechnen.tipps(daten({ meer: true, marine: marine() })).find((x) => x.id === 'gezeiten');
  assert.ok(t && /^(Flut|Ebbe) um \d\d:\d\d Uhr, (Flut|Ebbe) um \d\d:\d\d Uhr$/.test(t.text), 'Text: ' + (t && t.text));
  assert.ok(!tippIds(daten({ meer: false, marine: marine() })).includes('gezeiten'));
  assert.ok(!tippIds(daten({ meer: null, marine: marine() })).includes('gezeiten'));
  assert.ok(!tippIds(daten({ meer: true, marine: null })).includes('gezeiten'));
});
test('Gezeiten: abwechselnd Flut und Ebbe, Flut zum Wellenberg', () => {
  const ev = rechnen.gezeiten(marine(), OFF, J).sort((a, b) => a.ms - b.ms);
  assert.ok(ev.length >= 3 && ev[0].art !== ev[1].art);
  // Flut-Maximum bei i-3 = 12,42/4 = 3,105 -> i = 6,105 h nach 00:00 UTC-Lokal; nächste: + 12,42 h
  const flut = ev.filter((e) => e.art === 'Flut')[0], soll = lokal(0, 0) + (3 + 12.42 / 4 + 12.42) * 36e5;
  assert.ok(Math.abs(flut.ms - soll) < 20 * 60000, 'Flut ' + new Date(flut.ms).toISOString() + ' soll ' + new Date(soll).toISOString());
});
test('Vorrang: Schirm, Frost, Hitze vor UV, Goldene Stunde, Sterne; höchstens 3', () => {
  const d = daten({ wolken: 5, stunde: [[23, 20, 'precipitation_probability', 80], [23, 22, 'temperature_2m', -1], [23, 15, 'temperature_2m', 31], [23, 15, 'uv_index', 8]] });
  eq(tippIds(d), ['schirm', 'frost', 'hitze']);
  eq(tippIds(daten({ wolken: 5, stunde: [[23, 15, 'uv_index', 8]] })), ['uv', 'golden', 'sterne']);
  eq(tippIds(daten({ wolken: 5, stunde: [[23, 20, 'precipitation_probability', 80], [23, 15, 'uv_index', 8]] })), ['schirm', 'uv', 'golden']);
});
test('nichts trifft zu: Heute nichts Besonderes', () => {
  const t = rechnen.tipps(daten({ jetzt: lokal(19, 10) }));
  assert.strictEqual(t.length, 1); assert.strictEqual(t[0].text, 'Heute nichts Besonderes');
});
test('Binnenland: nie Strand-, Bade- oder Kite-Tipp', () => {
  const alle = rechnen.tipps(daten({ meer: false, marine: marine(), stunde: [[23, 15, 'temperature_2m', 33], [23, 15, 'uv_index', 9]] })).map((t) => t.text).join(' ');
  assert.ok(!/Strand|Bade|Kite|Flut|Ebbe/i.test(alle), alle);
});

// ---------- mond ----------
console.log('mond');
const SYN = 29.530588853 * 864e5, REF = Date.UTC(2000, 0, 6, 18, 14);
const mittel = (n, p) => REF + (n + p) * SYN;   // mittlere Hauptphase (Soll aus dem synodischen Monat)
const MIN30 = 30 * 60e3;
const phasen = rechnen.hauptphasen(lokal(12, 0), 6);
const phase = (name) => phasen.find((x) => x.name === name);
test('Vollmond 26.10.2026 04:12 UTC (±30 min), Phase dort ~100 %', () => {
  const ph = phase('Vollmond');
  assert.ok(Math.abs(ph.ms - Date.UTC(2026, 9, 26, 4, 12)) <= MIN30, 'Vollmond ' + new Date(ph.ms).toISOString());
  assert.ok(rechnen.mond(ph.ms, 49.4875, 8.466, 3600).prozent >= 99);
  const nm = Math.round((ph.ms - REF) / SYN - 0.5);
  assert.ok(Math.abs(ph.ms - mittel(nm, 0.5)) < 16 * 36e5, 'weicht vom mittleren Monat zu stark ab');
});
test('Letztes Viertel 01.11.2026 20:28 UTC (±30 min)', () => {
  const ph = phase('Letztes Viertel');
  assert.ok(Math.abs(ph.ms - Date.UTC(2026, 10, 1, 20, 28)) <= MIN30, new Date(ph.ms).toISOString());
});
test('Neumond 09.11.2026 07:02 UTC (±30 min), Phase dort ~0 %', () => {
  const ph = phase('Neumond');
  assert.ok(Math.abs(ph.ms - Date.UTC(2026, 10, 9, 7, 2)) <= MIN30, 'Neumond ' + new Date(ph.ms).toISOString());
  assert.ok(rechnen.mond(ph.ms, 49.4875, 8.466, 3600).prozent <= 1);
});
test('Erstes Viertel 17.11.2026 11:48 UTC (±30 min), liegt nahe der mittleren Phase (±2 h bis ±16 h)', () => {
  const ph = phase('Erstes Viertel');
  assert.ok(Math.abs(ph.ms - Date.UTC(2026, 10, 17, 11, 48)) <= MIN30, new Date(ph.ms).toISOString());
  const nm = Math.round((ph.ms - REF) / SYN - 0.25);
  assert.ok(Math.abs(ph.ms - mittel(nm, 0.25)) < 16 * 36e5);
});
test('Datum in Ortszeit: Letztes Viertel Sonntag 1. Nov. (nicht Montag 2.)', () => {
  const m = rechnen.mond(lokal(12, 0), 49.4875, 8.466, 3600);
  const lv = m.naechste.find((x) => x.name === 'Letztes Viertel');
  assert.strictEqual(lv.datum, '2026-11-01'); assert.ok(/^So\./.test(lv.text), lv.text);
});
test('nächste zwei Hauptphasen, aufsteigend, mit Datum', () => {
  const m = rechnen.mond(lokal(12, 0), 49.4875, 8.466, OFF);
  assert.strictEqual(m.naechste.length, 2); assert.ok(m.naechste[0].ms < m.naechste[1].ms && m.naechste[0].ms > lokal(12, 0));
  assert.ok(/^\w+\. \d+\. \w+\.?$/.test(m.naechste[0].text) || m.naechste[0].text.length > 5, m.naechste[0].text);
  eq(m.naechste.map((x) => x.name), ['Vollmond', 'Letztes Viertel']);
});
test('Text und zunehmend/abnehmend', () => {
  const vor = rechnen.mond(Date.UTC(2026, 9, 20, 12), 49.4875, 8.466, OFF), nach = rechnen.mond(Date.UTC(2026, 9, 31, 12), 49.4875, 8.466, OFF);
  assert.ok(vor.zunehmend && /^Mond zu \d+ % beleuchtet, zunehmend$/.test(vor.text), vor.text);
  assert.ok(!nach.zunehmend && /^Mond zu \d+ % beleuchtet, abnehmend$/.test(nach.text), nach.text);
  assert.ok(vor.prozent > 60 && vor.prozent < 90, String(vor.prozent));
});
test('Aufgang und Untergang liegen im Ortstag; Vollmond geht etwa bei Sonnenuntergang auf', () => {
  const m = rechnen.mond(Date.UTC(2026, 9, 26, 12), 49.4875, 8.466, 3600);
  const tag0 = Date.UTC(2026, 9, 26, 0) - 3600e3;
  assert.ok(m.aufgangMs >= tag0 && m.aufgangMs < tag0 + 864e5);
  const h = +m.aufgang.slice(0, 2) + (+m.aufgang.slice(3)) / 60;
  assert.ok(h > 16 && h < 20, 'Aufgang ' + m.aufgang);
});

// ---------- luftTage ----------
console.log('luftTage');
test('Tagesmaximum je Datum, null wird übergangen', () => {
  const luft = { hourly: { time: ['2026-10-23T10:00', '2026-10-23T11:00', '2026-10-23T12:00', '2026-10-24T00:00', '2026-10-24T01:00', '2026-10-25T00:00'], european_aqi: [20, 45, null, 12, 12, null] } };
  eq(rechnen.luftTage(luft), { '2026-10-23': 45, '2026-10-24': 12 });
  eq(rechnen.luftTage(null), {});
});
test('Pollen morgen: stärkste Art', () => {
  const t = ['2026-10-23T12:00', '2026-10-24T08:00', '2026-10-24T12:00'];
  const mk = (g) => ({ hourly: { time: t, alder_pollen: [null, null, null], birch_pollen: [0, 1, 0], grass_pollen: [0, 30, 50], mugwort_pollen: [0, 0, 0], olive_pollen: [null, null, null], ragweed_pollen: [0, 0, 0] } });
  assert.strictEqual(rechnen.pollenMorgen(mk(), OFF, J).satz, 'Morgen Gräser mäßig');
  const leer = { hourly: { time: t, alder_pollen: [0, 0, 0], birch_pollen: [0, 0, 0], grass_pollen: [0, 0, 0], mugwort_pollen: [0, 0, 0], olive_pollen: [0, 0, 0], ragweed_pollen: [0, 0, 0] } };
  assert.strictEqual(rechnen.pollenMorgen(leer, OFF, J).satz, 'Morgen kaum Pollen');
});
test('Trocken bis / Regen bis', () => {
  assert.strictEqual(rechnen.trockenBis(daten({ stunde: [[23, 19, 'precipitation', 0.6]] }).forecast.hourly, OFF, J), 'Trocken bis 19 Uhr');
  assert.strictEqual(rechnen.trockenBis(daten({ stunde: [[23, 14, 'precipitation', 0.6], [23, 15, 'precipitation', 0.3]] }).forecast.hourly, OFF, J), 'Regen bis 16 Uhr');
});

// ---------- Zeichnen (Smoke-Test ohne Browser) ----------
console.log('rendern');
function containerStub() { return { innerHTML: '', setAttribute() { }, removeAttribute() { }, addEventListener() { }, removeEventListener() { }, querySelector() { return null; }, querySelectorAll() { return []; }, contains() { return true; } }; }
function volleDaten() {
  const d = daten({ meer: true, marine: marine(), wolken: 10, stunde: [[23, 20, 'precipitation_probability', 70]],
    warnungen: [{ event: 'WIND GUSTS', headline_de: 'Amtliche WARNUNG vor <b>STURMBÖEN</b>', description_de: 'Es treten Sturmböen auf.', instruction_de: 'Lose Gegenstände sichern.', severity: 'moderate', onset: '2026-10-23T12:00:00+00:00', expires: '2026-10-23T18:00:00+00:00' }],
    luft: { current: { european_aqi: 34, pm10: 12, pm2_5: 6, ozone: 70, alder_pollen: null, birch_pollen: null, grass_pollen: 25, mugwort_pollen: null, olive_pollen: null, ragweed_pollen: null }, hourly: { time: T.slice(0, 120), european_aqi: T.slice(0, 120).map(() => 34), alder_pollen: T.slice(0, 120).map(() => null), birch_pollen: T.slice(0, 120).map(() => null), grass_pollen: T.slice(0, 120).map(() => 25), mugwort_pollen: T.slice(0, 120).map(() => null), olive_pollen: T.slice(0, 120).map(() => null), ragweed_pollen: T.slice(0, 120).map(() => null) } } });
  d.radar = { host: 'https://tilecache.rainviewer.com', frames: [{ time: 1790000000, path: '/v2/radar/1790000000' }] };
  return d;
}
test('alle zwölf Module, mit Warnung, ohne Fehlerplatzhalter', () => {
  const c = containerStub(); Module.rendern(c, volleDaten(), { oeffneReiter() { }, nochmal() { } });
  const h = c.innerHTML;
  assert.ok(!h.includes('lässt sich gerade nicht anzeigen'), 'ein Modul wirft einen Fehler');
  ['k-warnung', 'k-aktuell', 'k-stunden', 'k-meteogramm', 'k-tage', 'k-luft', 'k-tipps', 'k-sonne', 'k-mond', 'k-wind', 'k-radar', 'k-pollen'].forEach((k) => assert.ok(h.includes('class="kachel ' + k), 'fehlt ' + k));
  assert.ok(h.includes('id="start-meteogramm"'));
  assert.ok(h.includes('Markante Warnung') && h.includes('DWD über Bright Sky'));
  assert.ok(!h.includes('<b>STURM'), 'API-Text wurde nicht maskiert');
  assert.strictEqual((h.match(/class="tag[ "]/g) || []).length, 8);
});
test('Warnung: Pille „Stufe 2 von 4“ neben der Überschrift; Aktuell: Uhrzeit des Stands links über dem Symbol', () => {
  const c = containerStub(); Module.rendern(c, volleDaten(), { oeffneReiter() { }, nochmal() { } });
  const h = c.innerHTML;
  assert.ok(/<div class="kopfzeile"><h2 class="kachel-kopf" id="m-warnung-t">Markante Warnung<\/h2><span class="pille">Stufe 2 von 4<\/span><\/div>/.test(h), 'Pille fehlt oder steht nicht neben der Überschrift');
  assert.ok(/<div class="aktuell-links"><p class="aktuell-label">Aktuell <span class="aktuell-zeit">14:00<\/span><\/p><div class="sym sym-aktuell">/.test(h), 'Aktuell mit Uhrzeit fehlt links');
  assert.ok(!/class="kopf"/.test(h), 'class="kopf" gehört der Kopfzeile der Hülle (Namensgleichheit)');
});
test('Reihenfolge der Module', () => {
  const c = containerStub(); Module.rendern(c, volleDaten(), { oeffneReiter() { }, nochmal() { } });
  const pos = ['k-warnung', 'k-aktuell', 'k-stunden', 'k-meteogramm', 'k-tage', 'k-luft', 'k-tipps', 'k-sonne', 'k-mond', 'k-wind', 'k-radar', 'k-pollen'].map((k) => c.innerHTML.indexOf('class="kachel ' + k));
  assert.deepStrictEqual(pos.slice().sort((a, b) => a - b), pos);
});
test('ohne Warnung, Luft, Radar und offline: ruhige Sätze', () => {
  const d = daten(); d.offline = true;
  const c = containerStub(); Module.rendern(c, d, { oeffneReiter() { }, nochmal() { } });
  const h = c.innerHTML;
  assert.ok(!h.includes('k-warnung') && !h.includes('lässt sich gerade nicht anzeigen'));
  assert.ok(h.includes('Offline: Radar nicht verfügbar') && h.includes('Zurzeit keine Luftdaten') && h.includes('Zurzeit keine Pollendaten für diesen Ort'));
});
test('Pollen alle null: ruhiger Hinweis', () => {
  const d = volleDaten(); Object.keys(d.luft.current).forEach((k) => { if (/pollen/.test(k)) d.luft.current[k] = null; });
  const c = containerStub(); Module.rendern(c, d, {});
  assert.ok(c.innerHTML.includes('Zurzeit keine Pollendaten für diesen Ort'));
});
test('Ersatzkachel eines fehlgeschlagenen Moduls hat Überschrift und aria-labelledby', () => {
  const d = daten(); d.forecast.daily = null;   // lässt Module mit Tagesdaten scheitern
  const c = containerStub(); Module.rendern(c, d, {});
  const ersatz = c.innerHTML.split('<section').filter((x) => x.includes('lässt sich gerade nicht anzeigen'));
  assert.ok(ersatz.length > 0, 'kein Ersatz gezeichnet');
  ersatz.forEach((x) => assert.ok(/aria-labelledby="m-[a-z]+-t"/.test(x) && /<h2 class="kachel-kopf" id="m-[a-z]+-t">[^<]+<\/h2>/.test(x), x.slice(0, 200)));
});
test('Skeleton und Fehlerzustand', () => {
  const c = containerStub(); Module.skeleton(c); assert.ok(c.innerHTML.includes('skel') && !/spinner|kreisel/i.test(c.innerHTML));
  Module.fehler(c, 'Keine Verbindung.', () => { }); assert.ok(c.innerHTML.includes('Erneut versuchen') && c.innerHTML.includes('Keine Verbindung.'));
});

console.log('\n' + ok + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
