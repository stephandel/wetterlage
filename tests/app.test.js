// Tests der Hülle (Playwright WebKit, 390 × 844). Ohne Netz lauffähig: fremde Server werden abgewiesen.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { webkit } = require('playwright');

const WURZEL = path.join(__dirname, '..');
const PORT = 8891;
const TYPEN = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };

function server() {
  return http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const datei = path.join(WURZEL, p);
    if (!datei.startsWith(WURZEL) || datei.includes('node_modules') || !fs.existsSync(datei) || !fs.statSync(datei).isFile()) { res.writeHead(404); res.end('nicht gefunden'); return; }
    res.writeHead(200, { 'Content-Type': TYPEN[path.extname(datei)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(datei).pipe(res);
  }).listen(PORT);
}

// Aufgezeichnete Antworten (tests/fixturen, Mannheim, 23.10.2026 04:40 Ortszeit); die Uhr steht fest auf diesem Zeitpunkt
const FIX = (n) => fs.readFileSync(path.join(__dirname, 'fixturen', n));
const PNG1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const JETZT = new Date('2026-10-23T02:40:00Z');
const CORS = { 'access-control-allow-origin': '*' };
// Kontext mit Fixture-Antworten für alle fremden Server; st.offline = true lässt jede Anfrage scheitern, st.anfragen sammelt die Adressen
async function mockKontext(browser, opt) {
  // Service Worker gesperrt (außer im Offline-Test): in WebKit umgehen Anfragen, die über den Service Worker laufen, das route() und gingen ins echte Netz
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' }, opt));
  const st = { offline: false, anfragen: [], fehler: [] };
  await ctx.route((url) => url.hostname !== 'localhost' && url.hostname !== '127.0.0.1', (r) => {
    const u = new URL(r.request().url());
    st.anfragen.push(u.href);
    if (st.offline) return r.abort('internetdisconnected');
    const json = (n) => r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: FIX(n) });
    if (u.hostname === 'api.open-meteo.com') {
      if (/minutely_15/.test(u.search)) return json('vorhersage.json');
      if (/latitude=[^&]*,/.test(u.search)) return r.abort();   // Gitter der Karten: nicht aufgezeichnet
      return json('meteogramm.json');
    }
    if (u.hostname === 'air-quality-api.open-meteo.com') return json('luft.json');
    if (u.hostname === 'api.brightsky.dev') return json('warnung.json');
    if (u.hostname === 'marine-api.open-meteo.com') return json('meer.json');
    if (u.hostname === 'api.rainviewer.com') return json('radar.json');
    if (/tile\.|tilecache\./.test(u.hostname)) return r.fulfill({ status: 200, contentType: 'image/png', headers: CORS, body: PNG1 });
    return r.abort();
  });
  await ctx.clock.setFixedTime(JETZT);
  return { ctx, st };
}
async function mockSeite(browser, opt) {
  const { ctx, st } = await mockKontext(browser, opt);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => st.fehler.push(e.message));
  await page.goto('http://localhost:' + PORT + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => /Stand \d\d:\d\d/.test(document.getElementById('kopf-stand').textContent), null, { timeout: 15000 });
  return { ctx, page, st };
}

const ergebnisse = [];
async function pruefe(name, fn) {
  try { await fn(); ergebnisse.push([name, true]); console.log('ok     ' + name); }
  catch (e) { ergebnisse.push([name, false]); console.log('FEHLER ' + name + '\n       ' + (e && e.message || e)); }
}
function gleich(ist, soll, was) { if (JSON.stringify(ist) !== JSON.stringify(soll)) throw new Error(was + ': erwartet ' + JSON.stringify(soll) + ', gefunden ' + JSON.stringify(ist)); }
function wahr(b, was) { if (!b) throw new Error(was); }

(async () => {
  const srv = server();
  const browser = await webkit.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  // Fremde Server nicht erreichen: Fehlerfälle werden getestet, nichts hängt am Netz
  await ctx.route((url) => url.hostname !== 'localhost' && url.hostname !== '127.0.0.1', (r) => r.abort());
  const page = await ctx.newPage();
  const seitenfehler = [];
  page.on('pageerror', (e) => seitenfehler.push(e.message));
  await page.goto('http://localhost:' + PORT + '/', { waitUntil: 'load' });
  await page.waitForTimeout(500);

  await pruefe('1 Seite lädt ohne Seitenfehler (390 × 844)', async () => {
    gleich(seitenfehler, [], 'pageerror');
    gleich(await page.title(), 'Wetterlage', 'Titel');
  });

  await pruefe('2 fünf Tabs in der Reihenfolge Wetter, Graphs, Karten, Rad/Sat, Mehr', async () => {
    const namen = await page.$$eval('[role="tab"]', (els) => els.map((e) => e.textContent.trim()));
    gleich(namen, ['Wetter', 'Graphs', 'Karten', 'Rad/Sat', 'Mehr'], 'Tabs');
    const ausgewaehlt = await page.$$eval('[role="tab"]', (els) => els.map((e) => e.getAttribute('aria-selected')));
    gleich(ausgewaehlt, ['true', 'false', 'false', 'false', 'false'], 'aria-selected');
  });

  await pruefe('3 Tab Mehr zeigt „Wetterlage“ und „0.9.0“', async () => {
    await page.click('#tab-mehr');
    const sichtbar = await page.isVisible('#reiter-mehr');
    wahr(sichtbar, 'Mehr-Reiter nicht sichtbar');
    gleich((await page.textContent('#reiter-mehr h1')).trim(), 'Wetterlage', 'Titel');
    wahr((await page.textContent('#ueber-version')).includes('0.9.0'), 'Version 0.9.0 fehlt');
  });

  await pruefe('4 kein seitliches Scrollen (Breite ≤ 390) in Wetter und Mehr', async () => {
    gleich(await page.evaluate(() => document.documentElement.scrollWidth <= 390), true, 'Mehr scrollWidth');
    await page.click('#tab-wetter');
    gleich(await page.evaluate(() => document.documentElement.scrollWidth <= 390), true, 'Wetter scrollWidth');
  });

  await pruefe('5 Orte-Blatt öffnet und schließt (Knopf und Esc)', async () => {
    await page.click('#knopf-orte');
    wahr(await page.isVisible('#orte-blatt'), 'Blatt nicht sichtbar');
    const eintraege = await page.$$eval('#orte-liste .ort-name', (els) => els.map((e) => e.querySelector('span').textContent));
    gleich(eintraege.slice().sort(), ['Corralejo', 'Mannheim', 'Mengerschied'], 'Standardorte');
    await page.click('#orte-fertig');
    wahr(!(await page.isVisible('#orte-blatt')), 'Blatt nach „Fertig“ noch sichtbar');
    await page.click('#knopf-suche');
    wahr(await page.evaluate(() => document.activeElement.id === 'orte-suche'), 'Fokus nicht im Suchfeld');
    await page.keyboard.press('Escape');
    wahr(!(await page.isVisible('#orte-blatt')), 'Blatt nach Esc noch sichtbar');
  });

  await pruefe('6 Service Worker registriert sich', async () => {
    const reg = await page.evaluate(() => Promise.race([
      navigator.serviceWorker.ready.then((r) => !!r.active),
      new Promise((_, nein) => setTimeout(() => nein(new Error('Zeitüberschreitung 10 s')), 10000))
    ]));
    gleich(reg, true, 'aktiver Service Worker');
  });

  await pruefe('7 am Ende weiterhin keine Seitenfehler', async () => { gleich(seitenfehler, [], 'pageerror'); });

  // ---------- Prüfauftrag-Korrekturen und Vollbild, Offline, Schriftgröße (mit Fixture-Antworten) ----------
  const FOTOS = path.join(WURZEL, 'pruefung');
  fs.mkdirSync(FOTOS, { recursive: true });

  await pruefe('8 Kopfzeile: Ort Title 2 fett in normaler Schreibweise, Stand-Zeile Footnote ohne Großbuchstaben, Symbol „sliders“ mit Namen „Orte“', async () => {
    const { ctx, page, st } = await mockSeite(browser);
    const k = await page.evaluate(() => {
      const wurzel = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const o = document.getElementById('kopf-ort'), s = document.getElementById('kopf-stand'), co = getComputedStyle(o), cs = getComputedStyle(s);
      return { oText: o.innerText, sText: s.innerText, oTT: co.textTransform, oLS: co.letterSpacing, oFS: parseFloat(co.fontSize) / wurzel, oFW: +co.fontWeight, sTT: cs.textTransform, sLS: cs.letterSpacing, sFS: parseFloat(cs.fontSize) / wurzel,
        label: document.getElementById('knopf-orte').getAttribute('aria-label'), d: (document.querySelector('#knopf-orte svg path') || { getAttribute: () => '' }).getAttribute('d') };
    });
    gleich(k.oText, 'Mannheim', 'Ort wie geschrieben (kein Versalsatz)');
    wahr(/^Stand \d\d:\d\d$/.test(k.sText), 'Stand-Zeile: ' + k.sText);
    gleich([k.oTT, k.oLS, k.sTT, k.sLS], ['none', 'normal', 'none', 'normal'], 'text-transform und Sperrung');
    gleich([Math.round(k.oFS * 1000) / 1000, k.oFW >= 700], [1.375, true], 'Ort Title 2 (1,375 rem) fett');
    gleich(Math.round(k.sFS * 10000) / 10000, 0.8125, 'Stand Footnote (0,8125 rem)');
    gleich(k.label, 'Orte', 'aria-label');
    wahr(k.d.startsWith('M21 4h-4'), 'Symbol ist nicht „sliders“: ' + k.d);
    await ctx.close();
  });

  await pruefe('9 Start-Meteogramm: halbe Kachelbreite, kein seitliches Scrollen, Temperaturlinie da, Modellwahl/Werteliste/Knopfleiste/Hinweis ausgeblendet, kein Seitenfehler', async () => {
    const { ctx, page, st } = await mockSeite(browser);
    await page.waitForSelector('#start-meteogramm path.mg-linie', { state: 'attached', timeout: 15000 });
    await page.waitForTimeout(800);
    const m = await page.evaluate(() => {
      const el = document.getElementById('start-meteogramm'), k = el.closest('.kachel').getBoundingClientRect(), r = el.getBoundingClientRect(), l = el.querySelector('path.mg-linie');
      return { sw: document.documentElement.scrollWidth, kw: k.width, mw: r.width, d: l ? l.getAttribute('d').length : 0,
        aus: ['.mg-top', '.mg-readout', '.mg-werte', '.mg-knoepfe', '.mg-ecke-halter', '.mg-foot'].map((q) => { const e = el.querySelector(q); return e ? getComputedStyle(e).display : 'fehlt'; }) };
    });
    wahr(m.sw <= 390, 'scrollWidth ' + m.sw);
    wahr(m.mw <= m.kw + 0.5, 'Baustein ' + m.mw + ' px breiter als die Kachel ' + m.kw + ' px');
    wahr(m.kw < 200, 'Kachel nicht halb breit: ' + m.kw);
    wahr(m.d > 20, 'keine Temperaturlinie');
    gleich(m.aus.filter((a) => a !== 'none' && a !== 'fehlt'), [], 'sichtbare Teile, die ausgeblendet sein sollen');
    gleich(st.fehler, [], 'pageerror (u. a. ResizeObserver)');
    await ctx.close();
  });

  await pruefe('10 Radar-Kachel: Grundkarte gefiltert (dunkel), Radar-Ebene ohne Filter', async () => {
    const { ctx, page } = await mockSeite(browser);
    await page.waitForSelector('.k-radar .karte .leaflet-grund-pane .leaflet-tile', { state: 'attached', timeout: 10000 });
    const f = await page.evaluate(() => ({
      grund: getComputedStyle(document.querySelector('.k-radar .karte .leaflet-grund-pane .leaflet-tile')).filter,
      radar: getComputedStyle(document.querySelector('.k-radar .karte .leaflet-tile-pane .leaflet-tile')).filter
    }));
    wahr(/invert/.test(f.grund), 'Grundkarte ohne Filter: ' + f.grund);
    gleich(f.radar, 'none', 'Radar-Filter');
    await ctx.close();
  });

  await pruefe('11 Warnungs-Kachel: Pille „Stufe N von 4“ rechts neben der Überschrift, Akzent-Tint, mindestens Footnote', async () => {
    const { ctx, page } = await mockSeite(browser);
    const p = await page.evaluate(() => {
      const e = document.querySelector('.k-warnung .pille'), h = document.querySelector('.k-warnung .kachel-kopf'), t = document.createElement('span');
      t.style.background = 'var(--akzent-tint)'; document.body.appendChild(t);
      const tint = getComputedStyle(t).backgroundColor; t.remove();
      const wurzel = parseFloat(getComputedStyle(document.documentElement).fontSize), r = e.getBoundingClientRect(), hr = h.getBoundingClientRect();
      return { text: e.textContent, bg: getComputedStyle(e).backgroundColor, tint, fs: parseFloat(getComputedStyle(e).fontSize) / wurzel, rechts: r.left >= hr.right - 1, gleicheZeile: r.top < hr.bottom && r.bottom > hr.top };
    });
    wahr(/^Stufe [1-4] von 4$/.test(p.text), 'Text: ' + p.text);
    gleich(p.bg, p.tint, 'Pillenfarbe = --akzent-tint');
    wahr(p.fs >= 0.8125 - 1e-6, 'Schrift ' + p.fs + ' rem');
    wahr(p.rechts && p.gleicheZeile, 'Pille nicht rechts neben der Überschrift');
    await ctx.close();
  });

  await pruefe('12 Aktuell-Kachel: „Aktuell hh:mm“ links über dem Symbol in --akzent-2', async () => {
    const { ctx, page } = await mockSeite(browser);
    const a = await page.evaluate(() => {
      const l = document.querySelector('.aktuell-links .aktuell-label'), sym = document.querySelector('.aktuell-links .sym-aktuell'), t = document.createElement('span');
      t.style.color = 'var(--akzent-2)'; document.body.appendChild(t); const ak2 = getComputedStyle(t).color; t.remove();
      return { text: l.textContent, farbe: getComputedStyle(l).color, ak2, oben: l.getBoundingClientRect().bottom <= sym.getBoundingClientRect().top + 1, rechtsAlt: !!document.querySelector('.aktuell-rechts .aktuell-label') };
    });
    wahr(/^Aktuell \d\d:\d\d$/.test(a.text), 'Text: ' + a.text);
    gleich(a.farbe, a.ak2, 'Farbe');
    wahr(a.oben && !a.rechtsAlt, 'Label nicht über dem Symbol oder noch rechts vorhanden');
    await ctx.close();
  });

  await pruefe('13 Offline: Hülle aus dem Service Worker, „Offline · Stand hh:mm“, jeder Reiter mit Inhalt oder Hinweis, kein Seitenfehler (pruefung/offline-iphone-hell.png)', async () => {
    const { ctx, page, st } = await mockSeite(browser, { colorScheme: 'light', serviceWorkers: 'allow' });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => caches.keys().then((k) => k.length && caches.open(k[0]).then((c) => c.keys()).then((l) => l.length >= 25)), null, { timeout: 15000 });
    st.offline = true; await ctx.setOffline(true);
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => /^Offline · Stand \d\d:\d\d$/.test(document.getElementById('kopf-stand').textContent), null, { timeout: 10000 });
    wahr(await page.isVisible('.k-aktuell'), 'letzter Stand nicht gezeigt');
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(FOTOS, 'offline-iphone-hell.png') });
    const inhalt = () => page.evaluate(() => document.querySelector('.reiter:not([hidden])').innerText.trim().length);
    const zu = async () => { const f = page.locator('.mg-vb-fertig:visible, .wk-vb-fertig:visible').first(); if (await f.count()) { await f.click(); await page.waitForTimeout(900); } };
    await page.click('#tab-graphs'); await page.waitForTimeout(1500);
    wahr((await inhalt()) > 20, 'Graphs leer'); wahr(/nicht erreichbar|Verbindung/.test(await page.textContent('#graphs')), 'Graphs ohne Hinweis');
    for (const id of ['karten', 'radsat']) {
      await zu(); await page.click('#tab-' + id); await page.waitForTimeout(1200);
      wahr(await page.isVisible('#offline-pille'), id + ': kein Offline-Hinweis über der Karte');
      wahr(/Offline/.test(await page.textContent('#offline-pille')), id + ': Hinweistext');
    }
    await zu(); await page.click('#tab-mehr');
    wahr(await page.isVisible('#reiter-mehr h1') && (await inhalt()) > 100, 'Mehr leer');
    gleich(st.fehler, [], 'pageerror');
    await ctx.close();
  });

  // Vollbild: bei 390 × 844 und 1280 × 800
  for (const [b, h, opt] of [[390, 844, {}], [1280, 800, { isMobile: false, hasTouch: false, deviceScaleFactor: 1 }]]) {
    await pruefe('14 Vollbild (immer an) bei ' + b + ' × ' + h + ': Blatt füllt den Bildschirm, „Fertig“ oben rechts; Fertig, Esc und Zurück schließen und führen zum vorherigen Reiter', async () => {
      const { ctx, page, st } = await mockSeite(browser, Object.assign({ viewport: { width: b, height: h } }, opt));
      for (const [id, blatt, fertig] of [['graphs', '#graphs.mg-vollbild', '.mg-vb-fertig'], ['karten', '#karte.wk-vollbild', '.wk-vb-fertig'], ['radsat', '#karte.wk-vollbild', '.wk-vb-fertig']]) {
        const oeffnen = async () => { await page.click('#tab-' + id); await page.waitForSelector(blatt, { timeout: 8000 }); await page.waitForTimeout(500); };
        const geschlossen = async (wie) => {
          await page.waitForSelector(blatt, { state: 'detached', timeout: 5000 }).catch(() => { throw new Error(id + ': ' + wie + ' schließt das Blatt nicht'); });
          gleich(await page.getAttribute('#tab-wetter', 'aria-selected'), 'true', id + ': ' + wie + ' führt nicht zum vorherigen Reiter');
          await page.waitForTimeout(900);
        };
        await oeffnen();
        const r = await page.evaluate((q) => { const e = document.querySelector(q).getBoundingClientRect(); return [e.left, e.top, e.width, e.height]; }, blatt);
        gleich(r.map(Math.round), [0, 0, b, h], id + ': Blatt füllt nicht den Bildschirm');
        const f = await page.locator(blatt + ' ' + fertig).boundingBox();
        wahr(f && f.x + f.width >= b - 60 && f.y < 60 && f.width >= 44 && f.height >= 44, id + ': „Fertig“ nicht oben rechts / zu klein ' + JSON.stringify(f));
        await page.click(blatt + ' ' + fertig); await geschlossen('Fertig');
        await oeffnen(); await page.keyboard.press('Escape'); await geschlossen('Esc');
        await oeffnen(); await page.goBack(); await geschlossen('Zurück');
      }
      gleich(st.fehler, [], 'pageerror');
      await ctx.close();
    });
  }

  await pruefe('15 Schalter „immer im Vollbild“ aus: Reiter zeigen Diagramm/Karte eingebettet mit ⤢-Taste; Taste öffnet das Blatt, „Fertig“ schließt und bleibt im Reiter', async () => {
    const { ctx, page, st } = await mockSeite(browser);
    await page.click('#tab-mehr');
    await page.click('#schalter-vollbild');
    gleich(await page.getAttribute('#schalter-vollbild', 'aria-checked'), 'false', 'Schalter');
    for (const [id, blatt, taste, fertig] of [['graphs', '#graphs.mg-vollbild', '#graphs .mg-btn-voll', '.mg-vb-fertig'], ['karten', '#karte.wk-vollbild', '#karte .wk-voll', '.wk-vb-fertig'], ['radsat', '#karte.wk-vollbild', '#karte .wk-voll', '.wk-vb-fertig']]) {
      await page.click('#tab-' + id); await page.waitForSelector(taste, { state: 'visible', timeout: 8000 }); await page.waitForTimeout(500);
      gleich(await page.locator(blatt).count(), 0, id + ': öffnet trotz ausgeschaltetem Schalter als Blatt');
      await page.click(taste); await page.waitForSelector(blatt, { timeout: 5000 });
      await page.click(blatt + ' ' + fertig); await page.waitForSelector(blatt, { state: 'detached', timeout: 5000 });
      gleich(await page.getAttribute('#tab-' + id, 'aria-selected'), 'true', id + ': „Fertig“ verlässt den Reiter');
      await page.waitForTimeout(900);
    }
    gleich(st.fehler, [], 'pageerror');
    await ctx.close();
  });

  await pruefe('16 Karte: nur die gewählten Ebenen sichtbar (Druck aus), Radar fordert keine Kacheln über Zoomstufe 7 an', async () => {
    const { ctx, page, st } = await mockSeite(browser);
    const sichtbar = () => page.$$eval('#karte [data-ebene]', (bs) => bs.filter((b) => getComputedStyle(b).display !== 'none').map((b) => b.getAttribute('data-ebene')).sort());
    await page.click('#tab-karten'); await page.waitForSelector('#karte [data-ebene]', { timeout: 8000 });
    gleich(await sichtbar(), ['regen', 'temp', 'wetter', 'wind', 'wolken'], 'Ebenen in Karten');
    await page.click('#karte .wk-vb-fertig'); await page.waitForTimeout(900);
    await page.click('#tab-radsat'); await page.waitForSelector('#karte [data-ebene="radar"]', { timeout: 8000 });
    gleich(await sichtbar(), ['radar', 'sat', 'satregen', 'satsw', 'wetter'], 'Ebenen in Rad/Sat');
    for (let i = 0; i < 6; i++) { if (await page.isEnabled('#karte [data-zoom="1"]')) await page.click('#karte [data-zoom="1"]'); await page.waitForTimeout(250); }   // bis zum Zoom-Ende (Taste dann gesperrt)
    await page.waitForTimeout(800);
    const zs = st.anfragen.filter((u) => /tilecache\.rainviewer\.com/.test(u)).map((u) => +(/\/256\/(\d+)\//.exec(u) || [])[1]);
    wahr(zs.length > 0, 'keine Radar-Kacheln angefordert');
    wahr(Math.max.apply(null, zs) <= 7, 'Radar-Kachel über Stufe 7 angefordert: ' + Math.max.apply(null, zs));
    wahr(/maxNativeZoom: 7/.test(fs.readFileSync(path.join(WURZEL, 'lib', 'wpkarte.js'), 'utf8')), 'maxNativeZoom 7 steht nicht im Baustein');
    await ctx.close();
  });

  for (const prozent of [130, 150]) {
    await pruefe('17 Schriftgröße ' + prozent + ' %: kein seitliches Scrollen in Wetter und Mehr, Tab-Namen lesbar' + (prozent === 150 ? ', Tagesliste zweizeilig' : ''), async () => {
      const { ctx, page, st } = await mockSeite(browser);
      gleich(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize), '16px', 'Wurzelschrift ohne Einstellung (nicht iOS) bleibt 16 px');
      await page.evaluate((p) => { document.documentElement.style.fontSize = (17 * p / 100) + 'px'; window.dispatchEvent(new Event('resize')); }, prozent);
      await page.waitForTimeout(800);
      gleich(await page.getAttribute('html', 'data-schrift'), String(prozent), 'data-schrift');
      const breite = () => page.evaluate(() => document.documentElement.scrollWidth);
      wahr((await breite()) <= 390, 'Wetter scrollWidth ' + await breite());
      const tabs = await page.$$eval('.tab-name', (els) => els.map((e) => [e.textContent.trim(), e.getBoundingClientRect().width > 4, e.closest('button').getAttribute('aria-label')]));
      gleich(tabs.map((t) => t[2]), ['Wetter', 'Graphs', 'Karten', 'Rad/Sat', 'Mehr'], 'Tab-Namen (aria-label)');
      if (prozent === 130) gleich(tabs.map((t) => t[1]), [true, true, true, true, true], 'Tab-Namen sichtbar'); else wahr(tabs[0][1], 'Name des aktiven Tabs unsichtbar');
      if (prozent === 150) {
        const z = await page.evaluate(() => { const t = document.querySelector('.tag'), a = t.querySelector('.t-tag').getBoundingClientRect(), s = t.querySelector('.t-sr').getBoundingClientRect(); return [a.bottom, s.top]; });
        wahr(z[1] >= z[0] - 1, 'Tagesliste nicht zweizeilig: ' + JSON.stringify(z));
      }
      await page.click('#tab-mehr'); await page.waitForTimeout(500);
      wahr((await breite()) <= 390, 'Mehr scrollWidth ' + await breite());
      gleich(st.fehler, [], 'pageerror');
      await ctx.close();
    });
  }

  await pruefe('18 Blätter (Graphs, Karten, Rad/Sat, Orte): kein Text unter 11 px, Tippflächen mindestens 44 × 44 px, hell und dunkel', async () => {
    for (const modus of ['light', 'dark']) {
      const { ctx, page } = await mockSeite(browser, { colorScheme: modus });
      const scan = () => page.evaluate(() => {
        const aus = { klein: [], tap: [] };
        const sichtbar = (e) => { const r = e.getBoundingClientRect(), c = getComputedStyle(e); return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none' && +c.opacity > 0; };
        document.querySelectorAll('body *').forEach((e) => {
          if (!sichtbar(e) || e.closest('[hidden]')) return;
          if ([...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 10.99) aus.klein.push((e.getAttribute('class') || e.tagName) + ' ' + parseFloat(getComputedStyle(e).fontSize).toFixed(1));
          if (e.matches('button,a,input,[role=tab],[role=switch],[role=radio]')) { const r = e.getBoundingClientRect(); if (r.width < 43.5 || r.height < 43.5) aus.tap.push((e.getAttribute('class') || e.tagName) + ' ' + Math.round(r.width) + '×' + Math.round(r.height)); }
        });
        return aus;
      });
      const zu = async () => { const f = page.locator('.mg-vb-fertig:visible, .wk-vb-fertig:visible').first(); if (await f.count()) { await f.click(); await page.waitForTimeout(900); } };
      for (const id of ['wetter', 'graphs', 'karten', 'radsat', 'mehr']) {
        await zu(); await page.click('#tab-' + id); await page.waitForTimeout(id === 'wetter' || id === 'mehr' ? 500 : 2500);
        gleich(await scan(), { klein: [], tap: [] }, modus + ' ' + id);
      }
      await zu(); await page.click('#knopf-orte'); await page.waitForTimeout(400);
      gleich(await scan(), { klein: [], tap: [] }, modus + ' Orte-Blatt');
      await ctx.close();
    }
  });

  await pruefe('19 Kamera-Studio: „Wetter von damals“ aus (kein Foto-GPS an fremde Server); Esc schließt das Studio nicht, „Fertig“ schon', async () => {
    const { ctx, st } = await mockKontext(browser);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => st.fehler.push(e.message));
    await page.addInitScript(() => {
      let ks; window.__ksFunktionen = null;
      Object.defineProperty(window, 'KSStudio', { configurable: true, get: () => ks, set: (v) => { ks = v; if (v && v.mount) { const m = v.mount; v.mount = function (w, o) { window.__ksFunktionen = o.funktionen; return m.call(this, w, o); }; } } });
    });
    await page.goto('http://localhost:' + PORT + '/', { waitUntil: 'load' });
    await page.waitForFunction(() => /Stand \d\d:\d\d/.test(document.getElementById('kopf-stand').textContent), null, { timeout: 15000 });
    await page.click('#knopf-teilen');
    await page.waitForFunction(() => window.__ksFunktionen, null, { timeout: 15000 });
    const f = await page.evaluate(() => window.__ksFunktionen);
    gleich(f.wetterZeitpunkt, false, 'wetterZeitpunkt');
    wahr(f.kamera === true && f.mediathek === true, 'übrige Funktionen aus kamera-studio.json fehlen');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    wahr(await page.isVisible('#studio-blatt'), 'Esc hat das Studio geschlossen');
    await page.click('#studio-fertig'); await page.waitForTimeout(300);
    wahr(!(await page.isVisible('#studio-blatt')), 'Fertig schließt das Studio nicht');
    gleich(st.fehler, [], 'pageerror');
    await ctx.close();
  });

  await browser.close();
  srv.close();
  const schlecht = ergebnisse.filter((e) => !e[1]).length;
  console.log('\n' + (ergebnisse.length - schlecht) + ' von ' + ergebnisse.length + ' Tests grün');
  process.exit(schlecht ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
