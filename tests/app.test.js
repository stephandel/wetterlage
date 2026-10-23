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
    if (u.hostname === 'geocoding-api.open-meteo.com') return json('geocoding.json');
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
async function mockSeite(browser, opt, init) {
  const { ctx, st } = await mockKontext(browser, opt);
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => st.fehler.push(e.message));
  await page.goto('http://localhost:' + PORT + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => /Stand \d\d:\d\d/.test(document.getElementById('kopf-stand').textContent), null, { timeout: 15000 });
  return { ctx, page, st };
}

const VB_AN = () => { try { localStorage.setItem('wetterlage-vollbild-immer', 'true'); } catch (e) { } };
const VB_AUS = () => { try { localStorage.setItem('wetterlage-vollbild-immer', 'false'); } catch (e) { } };
const SAFE = ':root{--safe-top:47px;--safe-bottom:34px}';
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

  await pruefe('9 Start-Meteogramm: volle Kachelbreite, kein seitliches Scrollen, Temperaturlinie da, Modellwahl/Werteliste/Knopfleiste/Hinweis ausgeblendet, kein Seitenfehler', async () => {
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
    wahr(m.kw > 330, 'Kachel nicht in voller Breite: ' + m.kw);
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

  const SCHRIFT = async (page, prozent) => { await page.evaluate((p) => { document.documentElement.style.fontSize = (17 * p / 100) + 'px'; window.dispatchEvent(new Event('resize')); }, prozent); await page.waitForTimeout(700); };
  const WEG_FIX = JSON.stringify([{ id: '3041830', expires: '2026-10-24T02:00:00+00:00' }]);

  await pruefe('11 Warnungs-Kachel zugeklappt: ein Knopf über die Kachelbreite, ≥ 44 px hoch, Text „Stufe 1 von 4 · Windböen · bis Sa. 04:00“, Chevron, keine Pille', async () => {
    const { ctx, page } = await mockSeite(browser);
    const p = await page.evaluate(() => {
      const k = document.querySelector('.k-warnung'), z = k && k.querySelector('button.warn-zeile');
      if (!z) return null;
      const r = z.getBoundingClientRect(), kr = k.getBoundingClientRect(), wurzel = parseFloat(getComputedStyle(document.documentElement).fontSize);
      return { text: z.textContent.replace(/\s+/g, ' ').trim(), ex: z.getAttribute('aria-expanded'), ctrl: z.getAttribute('aria-controls'), ziel: !!document.getElementById(z.getAttribute('aria-controls')), h: r.height, breit: r.width >= kr.width - 2 * 20, fs: parseFloat(getComputedStyle(z).fontSize) / wurzel, svgs: z.querySelectorAll('svg[aria-hidden="true"]').length, pille: !!k.querySelector('.pille') };
    });
    wahr(p, 'kein Knopf .warn-zeile in der Warnkachel');
    gleich(p.text, 'Stufe 1 von 4 · Windböen · bis Sa. 04:00', 'Einzeiler-Text');
    gleich([p.ex, p.ziel, p.svgs, p.pille], ['false', true, 2, false], 'aria-expanded, aria-controls-Ziel, Symbole (Warndreieck + Chevron), Pille');
    wahr(p.h >= 43.5 && p.breit && p.fs >= 0.9375 - 1e-6, 'Maße: ' + JSON.stringify(p));
    await ctx.close();
  });

  for (const [prozent, anteil] of [[100, 0.15], [150, 0.5]]) {
    await pruefe('11b Warnkachel zugeklappt belegt bei ' + prozent + ' % höchstens ' + (anteil * 100) + ' % von 844 px', async () => {
      const { ctx, page } = await mockSeite(browser);
      if (prozent !== 100) await SCHRIFT(page, prozent);
      const h = await page.evaluate(() => document.querySelector('.k-warnung').getBoundingClientRect().height);
      wahr(h <= 844 * anteil, 'Höhe ' + Math.round(h) + ' px > ' + Math.round(844 * anteil));
      await ctx.close();
    });
  }

  await pruefe('11c Aufklappen: aria-expanded schaltet, Titel „Warnung vor Windböen“ ohne Großbuchstaben, Tipp ohne Präfixe, Quelle, Chevron dreht, nur ein Umschalten (kein Neuzeichnen)', async () => {
    const { ctx, page } = await mockSeite(browser);
    await page.evaluate(() => { document.querySelector('.k-warnung').__marke = 1; });
    await page.click('.warn-zeile'); await page.waitForTimeout(450);
    const a = await page.evaluate(() => {
      const k = document.querySelector('.k-warnung'), z = k.querySelector('.warn-zeile'), i = document.getElementById(z.getAttribute('aria-controls')), ch = z.querySelector('.warn-chev');
      return { ex: z.getAttribute('aria-expanded'), sichtbar: i.getBoundingClientRect().height > 0, text: i.innerText, marke: k.__marke, dreh: getComputedStyle(ch).transform, trans: getComputedStyle(ch).transitionProperty };
    });
    gleich(a.ex, 'true', 'aria-expanded');
    wahr(a.sichtbar, 'Bereich nicht sichtbar');
    gleich(a.marke, 1, 'Kachel wurde neu gezeichnet');
    wahr(/Warnung vor Windböen/.test(a.text) && !/WINDBÖEN|Amtliche/.test(a.text), 'Titel: ' + a.text);
    wahr(/Achte auf: umherfliegende leichte Gegenstände\./.test(a.text) && /Lose Gegenstände sichern/.test(a.text), 'Tipp: ' + a.text);
    wahr(!/Das hilft|Hinweis auf|Handlungsempfehlungen/.test(a.text), 'Präfix im Text: ' + a.text);
    wahr(/Mannheim/.test(a.text) && /Es treten Windböen/.test(a.text) && /Quelle: DWD über Bright Sky/.test(a.text), 'Ort, Warntext oder Quelle fehlen: ' + a.text);
    gleich(a.trans, 'transform', 'Chevron animiert nur transform');
    wahr(/^matrix\(-1,/.test(a.dreh), 'Chevron nicht um 180° gedreht: ' + a.dreh);
    await page.click('.warn-zeile');
    gleich(await page.getAttribute('.warn-zeile', 'aria-expanded'), 'false', 'aria-expanded nach zweitem Tipp');
    wahr(!(await page.isVisible('.warn-inhalt')), 'Bereich nach Zuklappen sichtbar');
    await ctx.close();
  });

  await pruefe('11d „x“ blendet aus: Kachel weg, ⚠️-Knopf links in der Kopfleiste (44 × 44, Stufe im aria-label, nicht verdeckt), Ortsname überlappt nicht, bleibt nach Neuladen; Tipp darauf bringt die Kachel aufgeklappt zurück', async () => {
    const { ctx, page } = await mockSeite(browser);
    await page.addStyleTag({ content: SAFE });
    wahr(!(await page.isVisible('#knopf-warnung')), '⚠️-Knopf schon vor dem Wegklicken sichtbar');
    await page.click('.warn-zeile');
    const x = await page.evaluate(() => { const b = document.querySelector('.warn-x'), r = b.getBoundingClientRect(); return { l: b.getAttribute('aria-label'), w: r.width, h: r.height, svg: !!b.querySelector('svg') }; });
    gleich([x.l, x.svg], ['Warnung ausblenden', true], 'x-Knopf');
    wahr(x.w >= 43.5 && x.h >= 43.5, 'x-Knopf ' + x.w + '×' + x.h);
    await page.click('.warn-x'); await page.waitForTimeout(300);
    gleich(await page.locator('.k-warnung').count(), 0, 'Kachel nach „x“');
    const pruefeKnopf = async (was) => {
      const k = await page.evaluate(() => {
        const b = document.getElementById('knopf-warnung'), r = b.getBoundingClientRect(), o = document.getElementById('knopf-orte').getBoundingClientRect(), n = document.getElementById('kopf-ort').getBoundingClientRect();
        const treffer = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { sichtbar: r.width > 0, w: r.width, h: r.height, label: b.getAttribute('aria-label'), treffer: !!treffer && (treffer === b || b.contains(treffer)), nachMenue: r.left >= o.right - 0.5, vorOrt: r.right <= n.left + 0.5, svg: !!b.querySelector('svg[aria-hidden="true"]'), text: b.textContent.trim() };
      });
      wahr(k.sichtbar, was + ': ⚠️-Knopf nicht sichtbar');
      wahr(k.w >= 43.5 && k.h >= 43.5, was + ': Größe ' + k.w + '×' + k.h);
      gleich(k.label, 'Wetterwarnung Stufe 1: Windböen, bis Sa. 04:00 – antippen zum Anzeigen', was + ': aria-label');
      wahr(k.treffer, was + ': ⚠️-Knopf ist am Mittelpunkt verdeckt');
      wahr(k.nachMenue && k.vorOrt && k.svg && k.text === '', was + ': Lage/Inhalt ' + JSON.stringify(k));
    };
    await pruefeKnopf('nach „x“');
    wahr(/Warnung ausgeblendet/.test(await page.textContent('#warn-ansage')), 'Ansage fehlt: ' + await page.textContent('#warn-ansage'));
    gleich(await page.getAttribute('#warn-ansage', 'aria-live'), 'polite', 'aria-live');
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => /Stand \d\d:\d\d/.test(document.getElementById('kopf-stand').textContent), null, { timeout: 15000 });
    await page.addStyleTag({ content: SAFE });
    gleich(await page.locator('.k-warnung').count(), 0, 'Kachel nach Neuladen');
    await pruefeKnopf('nach Neuladen');
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.click('#knopf-warnung'); await page.waitForTimeout(400);
    const d = await page.evaluate(() => ({ ex: document.querySelector('.warn-zeile') && document.querySelector('.warn-zeile').getAttribute('aria-expanded'), sy: window.scrollY, fokus: document.activeElement.classList.contains('warn-zeile'), knopf: document.getElementById('knopf-warnung').getBoundingClientRect().width, erste: document.querySelector('#module > *').classList.contains('k-warnung') }));
    gleich([d.ex, d.sy, d.fokus, d.knopf, d.erste], ['true', 0, true, 0, true], 'nach Tipp auf ⚠️ (aufgeklappt, oben, Fokus, Knopf weg, Kachel zuerst)');
    gleich(await page.evaluate(() => JSON.parse(localStorage.getItem('wetterlage-warnung-weg') || '[]').length), 0, 'Weg-Liste nach Tipp auf ⚠️');
    await ctx.close();
  });

  await pruefe('11e Kopfleiste mit ⚠️-Knopf: „Mengerschied“ bei 150 % gekürzt, nichts überlappt, kein seitliches Scrollen', async () => {
    const { ctx, page } = await mockSeite(browser, {}, `try { localStorage.setItem('wetterlage-ort-aktiv', '"mengerschied"'); localStorage.setItem('wetterlage-warnung-weg', ${JSON.stringify(WEG_FIX)}); } catch (e) { }`);
    await SCHRIFT(page, 150);
    const k = await page.evaluate(() => {
      const r = (id) => document.getElementById(id).getBoundingClientRect(), o = document.getElementById('kopf-ort'), b = r('knopf-warnung');
      return { ort: o.textContent, gekuerzt: o.scrollWidth > o.clientWidth, sichtbar: b.width > 0, vorOrt: b.right <= r('kopf-ort').left + 0.5, ortVorSuche: r('kopf-ort').right <= r('knopf-suche').left + 0.5, sw: document.documentElement.scrollWidth, tap: [b.width, b.height] };
    });
    gleich(k.ort, 'Mengerschied', 'Ortsname');
    wahr(k.sichtbar && k.gekuerzt && k.vorOrt && k.ortVorSuche && k.sw <= 390 && k.tap[0] >= 43.5, JSON.stringify(k));
    await ctx.close();
  });

  await pruefe('11f ⚠️-Wackeln: Keyframes nur transform rotate(±8°), ≤ 600 ms, einmal; bei reduzierter Bewegung nur Einblenden mit opacity ≤ 200 ms', async () => {
    for (const reduziert of [false, true]) {
      const { ctx, page } = await mockSeite(browser, reduziert ? { reducedMotion: 'reduce' } : {});
      await page.click('.warn-zeile'); await page.click('.warn-x'); await page.waitForTimeout(100);
      const a = await page.evaluate(() => {
        const cs = getComputedStyle(document.getElementById('knopf-warnung')), name = cs.animationName;
        let kf = null;
        for (const sh of document.styleSheets) { let regeln; try { regeln = sh.cssRules; } catch (e) { continue; } for (const r of regeln) { const rr = r.type === 7 ? r : (r.cssRules ? [...r.cssRules].find((x) => x.type === 7 && x.name === name) : null); if (rr && rr.name === name) kf = rr; } }
        const eig = kf ? [...kf.cssRules].map((s) => [...s.style].join(',') + '|' + s.style.cssText) : [];
        return { name, dauer: parseFloat(cs.animationDuration) * (/ms$/.test(cs.animationDuration) ? 1 : 1000), anzahl: cs.animationIterationCount, eig };
      });
      wahr(a.name && a.name !== 'none', (reduziert ? 'reduziert' : 'normal') + ': keine Animation am Knopf');
      wahr(a.eig.length > 0, 'Keyframes ' + a.name + ' nicht gefunden');
      if (reduziert) { wahr(a.eig.every((e) => /^opacity\|/.test(e)), 'reduziert: nicht nur opacity: ' + JSON.stringify(a.eig)); wahr(a.dauer <= 200, 'reduziert: Dauer ' + a.dauer); }
      else {
        wahr(a.eig.every((e) => /^transform\|/.test(e)), 'nicht nur transform: ' + JSON.stringify(a.eig));
        wahr(a.eig.every((e) => /rotate\((0|0deg|-?8deg)\)/.test(e)), 'Winkel nicht ±8°: ' + JSON.stringify(a.eig));
        wahr(a.dauer <= 600 && a.anzahl === '1', 'Dauer ' + a.dauer + ' ms, Wiederholungen ' + a.anzahl);
      }
      await ctx.close();
    }
  });

  await pruefe('11g Querformat 844 × 390: Warnung als Einzeiler über die volle Breite, linke Spalte unter „Aktuell“ gefüllt, Spalten gleich lang, kein seitliches Scrollen', async () => {
    const { ctx, page } = await mockSeite(browser, { viewport: { width: 844, height: 390 } });
    const q = await page.evaluate(() => {
      const t = [...document.querySelectorAll('#module > .kachel')].map((e) => { const r = e.getBoundingClientRect(); return { k: e.className.split(' ')[1], l: r.left, r: r.right, o: r.top + scrollY, u: r.bottom + scrollY, b: r.width }; });
      return { t, sw: document.documentElement.scrollWidth };
    });
    const warn = q.t.find((x) => x.k === 'k-warnung'), akt = q.t.find((x) => x.k === 'k-aktuell');
    wahr(warn && warn.b > 700 && warn.u - warn.o <= 80, 'Warnung nicht Einzeiler in voller Breite: ' + JSON.stringify(warn));
    wahr(akt.b < 460 && akt.l < 100, 'Aktuell nicht links in halber Breite: ' + JSON.stringify(akt));
    const links = q.t.filter((x) => x.b < 600 && x.l < 100 && x.o >= akt.u - 1), rechts = q.t.filter((x) => x.b < 600 && x.l > 300);
    wahr(links.length >= 3, 'unter „Aktuell“ nur ' + links.length + ' Kachel(n) links: ' + JSON.stringify(q.t.map((x) => [x.k, Math.round(x.l), Math.round(x.o)])));
    const ul = Math.max.apply(null, q.t.filter((x) => x.b < 600 && x.l < 100).map((x) => x.u)), ur = Math.max.apply(null, rechts.map((x) => x.u));
    wahr(Math.abs(ul - ur) <= 40, 'Unterkante links ' + Math.round(ul) + ' ≠ rechts ' + Math.round(ur));
    wahr(q.sw <= 844, 'scrollWidth ' + q.sw);
    await ctx.close();
  });

  await pruefe('9b Start-Meteogramm: Tipp auf die Diagrammfläche öffnet den Reiter Graphs; nach einer Wischbewegung nicht; kein Overlay über dem Diagramm; Knopf „Graphs öffnen“ bleibt', async () => {
    const { ctx, page } = await mockSeite(browser);
    await page.waitForSelector('#start-meteogramm path.mg-linie', { state: 'attached', timeout: 15000 });
    await page.waitForTimeout(800);
    await page.locator('.k-meteogramm').scrollIntoViewIfNeeded();
    const b = await page.locator('#start-meteogramm').boundingBox(), mx = b.x + b.width / 2, my = b.y + b.height / 2;
    const treffer = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return !!e && !!e.closest('#start-meteogramm') && !e.closest('button'); }, [mx, my]);
    wahr(treffer, 'über dem Diagramm liegt ein fremdes Element (Overlay oder Knopf)');
    wahr(await page.locator('.k-meteogramm button[data-aktion="graphs"]').count() >= 1, 'Knopf „Graphs öffnen“ fehlt');
    await page.mouse.move(mx - 60, my); await page.mouse.down(); await page.mouse.move(mx + 60, my, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(300);
    gleich(await page.getAttribute('#tab-graphs', 'aria-selected'), 'false', 'Reiter nach einer Wischbewegung');
    await page.mouse.click(mx, my); await page.waitForTimeout(400);
    gleich(await page.getAttribute('#tab-graphs', 'aria-selected'), 'true', 'Reiter nach Tipp auf die Diagrammfläche');
    await ctx.close();
  });

  await pruefe('9b2 Start-Meteogramm: Knöpfe des Bausteins (Rand-Pfeil, auch per Enter) öffnen Graphs nicht; Rand-Pfeil mindestens 44 × 44 px; Tipp auf die Fläche öffnet weiterhin', async () => {
    const { ctx, page } = await mockSeite(browser);
    await page.waitForSelector('#start-meteogramm path.mg-linie', { state: 'attached', timeout: 15000 });
    await page.waitForTimeout(800);
    await page.locator('.k-meteogramm').scrollIntoViewIfNeeded();
    // Rand-Pfeil erscheint nur, wenn „jetzt“ aus dem Bild gescrollt ist: hier erzwungen
    await page.evaluate(() => document.querySelector('#start-meteogramm .mg-randpfeil-r').classList.add('is-da'));
    const m = await page.evaluate(() => { const r = document.querySelector('#start-meteogramm .mg-randpfeil-r').getBoundingClientRect(); return { b: r.width, h: r.height, x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    wahr(m.b >= 43.5 && m.h >= 43.5, 'Rand-Pfeil ' + Math.round(m.b) + ' × ' + Math.round(m.h) + ' px');
    wahr(await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return !!e && !!e.closest('.mg-randpfeil-r'); }, [m.x, m.y]), 'Rand-Pfeil verdeckt');
    await page.mouse.click(m.x, m.y); await page.waitForTimeout(300);
    gleich(await page.getAttribute('#tab-graphs', 'aria-selected'), 'false', 'Reiter nach Klick auf den Rand-Pfeil');
    await page.evaluate(() => document.querySelector('#start-meteogramm .mg-randpfeil-r').classList.add('is-da'));
    await page.focus('#start-meteogramm .mg-randpfeil-r'); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
    gleich(await page.getAttribute('#tab-graphs', 'aria-selected'), 'false', 'Reiter nach Enter auf dem Rand-Pfeil');
    gleich(await page.getAttribute('#tab-wetter', 'aria-selected'), 'true', 'Reiter bleibt Wetter');
    const b = await page.locator('#start-meteogramm').boundingBox();
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(400);
    gleich(await page.getAttribute('#tab-graphs', 'aria-selected'), 'true', 'Reiter nach Tipp auf die Diagrammfläche');
    await ctx.close();
  });

  for (const [prozent, grenze] of [[100, 0.5], [150, 1]]) {
    await pruefe('9c Höhen-Budget bei ' + prozent + ' % Schrift: keine Kachel in #module höher als ' + (grenze * 100) + ' % von 844 px (Warnung aufgeklappt ausgenommen; Tagesliste bei 150 % nur unter 1,2 Bildschirmen, Stunden bei 150 % unter 700 px)', async () => {
      const { ctx, page } = await mockSeite(browser);
      if (prozent !== 100) await SCHRIFT(page, prozent);
      await page.waitForTimeout(1200);
      const h = await page.evaluate(() => [...document.querySelectorAll('#module > .kachel')].map((e) => [e.className.split(' ')[1], Math.round(e.getBoundingClientRect().height)]));
      console.log('       Höhen ' + prozent + ' %: ' + h.map((x) => x[0].replace('k-', '') + ' ' + x[1]).join(', '));
      // Ausnahme: die Tagesliste bei 150 % (acht Tage, je zwei Zeilen; Sonne und Regen brechen um, ohne Datenverlust nicht unter 844 px zu bringen), dort gilt nur: unter 1,2 Bildschirmen
      const zu = h.filter((x) => (prozent === 150 && x[0] === 'k-tage') ? x[1] > 844 * 1.2 : (prozent === 150 && x[0] === 'k-stunden') ? x[1] > 700 : x[1] > 844 * grenze);
      gleich(zu, [], 'Kacheln über ' + Math.round(844 * grenze) + ' px');
      await ctx.close();
    });
  }

  await pruefe('9d Warnkachel dunkel: Fläche wie eine normale Kachel (--bg-2), Randstreifen in voller Warnfarbe, Warndreieck in der Warnfarbe; hell bleibt getönt', async () => {
    for (const modus of ['dark', 'light']) {
      const { ctx, page } = await mockSeite(browser, { colorScheme: modus });
      const w = await page.evaluate(() => {
        const farbe = (v, prop) => { const t = document.createElement('span'); t.style[prop || 'color'] = v; document.body.appendChild(t); const c = getComputedStyle(t)[prop || 'color']; t.remove(); return c; };
        const k = document.querySelector('.k-warnung'), n = document.querySelector('.k-aktuell'), sym = k.querySelector('.warn-sym');
        return { bg: getComputedStyle(k).backgroundColor, bgNormal: getComputedStyle(n).backgroundColor, schatten: getComputedStyle(k).boxShadow, gelb: farbe('var(--gelb)'), sym: getComputedStyle(sym).color, label: farbe('var(--label)') };
      });
      if (modus === 'dark') {
        gleich(w.bg, w.bgNormal, 'Fläche dunkel');
        wahr(w.schatten.includes(w.gelb), 'Randstreifen nicht in voller Warnfarbe: ' + w.schatten + ' / ' + w.gelb);
        gleich(w.sym, w.gelb, 'Warndreieck dunkel in der Warnfarbe');
      } else {
        wahr(w.bg !== w.bgNormal, 'hell: Fläche nicht mehr getönt');
        gleich(w.sym, w.label, 'Warndreieck hell in Textfarbe');
      }
      await ctx.close();
    }
  });

  await pruefe('9e Mond hell: Lichtseite getönt (nicht Kachelfarbe) mit Umriss in --label-2; Pollen-Punkte dunkel mit Umriss in --label-2', async () => {
    const { ctx, page } = await mockSeite(browser, { colorScheme: 'light' });
    const m = await page.evaluate(() => {
      const hell = document.querySelector('.mond-hell'), dunkel = document.querySelector('.mond-dunkel'), n = document.querySelector('.k-mond');
      return { hell: getComputedStyle(hell).fill, kachel: getComputedStyle(n).backgroundColor, rand: getComputedStyle(dunkel).stroke, randB: parseFloat(getComputedStyle(dunkel).strokeWidth), umrissHell: getComputedStyle(hell).stroke };
    });
    wahr(m.hell !== m.kachel && m.hell !== 'rgb(255, 255, 255)', 'Lichtseite hell wie die Kachel: ' + m.hell + ' / ' + m.kachel);
    wahr(m.randB >= 1.5, 'Umriss zu dünn: ' + m.randB);
    await ctx.close();
    const d = await mockSeite(browser, { colorScheme: 'dark' });
    const p = await d.page.evaluate(() => {
      const leer = document.querySelector('.punkte-reihe i:not(.an)'), cs = (e) => getComputedStyle(e);
      const t = document.createElement('span'); t.style.color = 'var(--label-2)'; document.body.appendChild(t); const l2 = getComputedStyle(t).color; t.remove();
      return { leerRand: cs(leer).borderTopColor, leerB: parseFloat(cs(leer).borderTopWidth), l2 };
    });
    gleich(p.leerRand, p.l2, 'Rand leerer Punkte dunkel (--label-2)');
    wahr(p.leerB >= 1, 'Rand zu dünn');
    await d.ctx.close();
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

  await pruefe('12b Aktuell-Kachel wie die Vorschau: Höhe ≤ 240 px, kein sichtbares „Aktuell in …“, Böen-Wert, Wechsel Werte/Radar geht und das Radar wird nicht abgeschnitten', async () => {
    const { ctx, page } = await mockSeite(browser);
    await page.addStyleTag({ content: SAFE });
    await page.waitForTimeout(800);
    const a = await page.evaluate(() => {
      const k = document.querySelector('.k-aktuell'), kopf = k.querySelector('.kachel-kopf'), r = kopf.getBoundingClientRect();
      return { h: Math.round(k.getBoundingClientRect().height), kopfSichtbar: r.width > 2 && r.height > 2, boeen: ((k.querySelector('.boeen') || {}).textContent || '').replace(/\s+/g, ' ').replace('Böen', 'Böen '), sichtbarText: /Aktuell in/.test(k.innerText) };
    });
    wahr(a.h <= 240, 'Höhe ' + a.h + ' px');
    wahr(!a.kopfSichtbar && !a.sichtbarText, 'Überschrift „Aktuell in …“ noch sichtbar');
    gleich(a.boeen.replace(/\s+/g, ' '), 'Böen 22 km/h', 'Böen');
    await page.click('.k-aktuell .wechsel'); await page.waitForTimeout(500);
    const b = await page.evaluate(() => {
      const k = document.querySelector('.k-aktuell'), box = k.querySelector('.ansicht-radar .karte-box').getBoundingClientRect(), kb = k.getBoundingClientRect();
      return { sichtbar: getComputedStyle(k.querySelector('.ansicht-radar')).visibility, h: Math.round(box.height), innen: box.top >= kb.top && box.bottom <= kb.bottom + 0.5, hk: Math.round(kb.height) };
    });
    gleich(b.sichtbar, 'visible', 'Radar-Ansicht');
    wahr(b.h >= 150 && b.innen, 'Radar abgeschnitten: ' + JSON.stringify(b));
    wahr(b.hk <= 260, 'Höhe in der Radar-Ansicht ' + b.hk);
    await page.click('.k-aktuell .wechsel'); await page.waitForTimeout(300);
    gleich(await page.evaluate(() => getComputedStyle(document.querySelector('.k-aktuell .ansicht-werte')).visibility), 'visible', 'zurück zu Werten');
    await ctx.close();
  });

  await pruefe('12c Stunden-Kachel kompakt: Höhe ≤ 190 px; je Spalte Uhrzeit, Symbol, Text, Regen und Temperatur in einer Zeile, Wind', async () => {
    const { ctx, page } = await mockSeite(browser);
    await page.waitForTimeout(800);
    const s = await page.evaluate(() => {
      const k = document.querySelector('.k-stunden'), sp = k.querySelector('.std'), z = sp.querySelector('.std-regen').getBoundingClientRect(), t = sp.querySelector('.std-temp').getBoundingClientRect();
      const ak2 = (() => { const e = document.createElement('span'); e.style.color = 'var(--akzent-2)'; document.body.appendChild(e); const c = getComputedStyle(e).color; e.remove(); return c; })();
      return { h: Math.round(k.getBoundingClientRect().height), eineZeile: Math.abs((z.top + z.bottom) / 2 - (t.top + t.bottom) / 2) < 6, tempFarbe: getComputedStyle(sp.querySelector('.std-temp')).color === ak2, text: !!sp.querySelector('.std-text') && sp.querySelector('.std-text').textContent.length > 2, wind: !!sp.querySelector('.std-wind') };
    });
    wahr(s.h <= 190, 'Höhe ' + s.h + ' px');
    wahr(s.eineZeile && s.tempFarbe && s.text && s.wind, JSON.stringify(s));
    await ctx.close();
  });

  await pruefe('12d Ortszeit: liegt der Ort in einer anderen Zeitzone als das Gerät, steht „Stand hh:mm Ortszeit“ in der Kopfzeile (New York: ja, Berlin: nein), Kopfzeile läuft nicht über', async () => {
    for (const [zone, soll] of [['America/New_York', true], ['Europe/Berlin', false]]) {
      const { ctx, page } = await mockSeite(browser, { timezoneId: zone });
      const t = (await page.textContent('#kopf-stand')).trim();
      gleich(/^Stand \d\d:\d\d Ortszeit$/.test(t), soll, zone + ': „' + t + '“');
      wahr(await page.evaluate(() => { const e = document.getElementById('kopf-stand'); return e.scrollWidth <= e.clientWidth + 1; }), 'Kopfzeile läuft über');
      await ctx.close();
    }
  });

  await pruefe('12d2 Zeitumstellung: alte Antwort (Abruf-Offset +2) nach der Umstellung → „Stand“ in der Kopfzeile in MEZ (25.10. 03:30 UTC = 04:30), ohne Ortszeit-Zusatz in Berlin', async () => {
    const { ctx, st } = await mockKontext(browser, { timezoneId: 'Europe/Berlin' });
    await ctx.clock.setFixedTime(new Date('2026-10-25T03:30:00Z'));
    const page = await ctx.newPage(); const fehler = [];
    page.on('pageerror', (e) => fehler.push(e.message));
    await page.goto('http://localhost:' + PORT + '/', { waitUntil: 'load' });
    await page.waitForFunction(() => /Stand \d\d:\d\d/.test(document.getElementById('kopf-stand').textContent), null, { timeout: 15000 });
    gleich((await page.textContent('#kopf-stand')).trim(), 'Stand 04:30', 'Stand-Zeit');
    gleich(fehler.concat(st.fehler), [], 'Seitenfehler');
    await ctx.close();
  });

  await pruefe('12e Ortssuche: Treffer mit Deutschland zuerst, dann Europa, höchstens 8; Anfrage mit count=20', async () => {
    const { ctx, page, st } = await mockSeite(browser);
    await page.click('#knopf-suche'); await page.fill('#orte-suche', 'Hamburg'); await page.waitForSelector('#orte-ergebnisse .ort-name', { timeout: 5000 });
    const l = await page.$$eval('#orte-ergebnisse .ort-name small', (els) => els.map((e) => e.textContent));
    wahr(st.anfragen.some((u) => /geocoding-api\.open-meteo\.com.*count=20/.test(u)), 'count=20 fehlt');
    gleich(l.length, 8, 'Anzahl');
    wahr(/Deutschland/.test(l[0]) && /Deutschland/.test(l[1]), 'DE nicht zuerst: ' + l.join(' | '));
    wahr(/Österreich|Frankreich|Vereinigtes/.test(l[2]) && !/USA|Brasilien/.test(l.slice(0, 5).join()), 'Europa nicht vor Rest: ' + l.join(' | '));
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
    wahr((await inhalt()) > 20, 'Graphs leer');
    wahr(await page.isVisible('#offline-pille') && /Offline · Diagramm braucht Netz/.test(await page.textContent('#offline-pille')), 'Graphs: Offline-Hinweis fehlt');
    wahr(!/nicht erreichbar/.test(await page.evaluate(() => document.getElementById('graphs').innerText)), 'Graphs zeigt „nicht erreichbar“');
    wahr(await page.evaluate(() => document.getElementById('offline-pille').getBoundingClientRect().top >= document.getElementById('kopf').getBoundingClientRect().bottom - 0.5), 'Offline-Pille liegt unter der Kopfleiste nicht');
    for (const id of ['karten', 'radsat']) {
      await zu(); await page.click('#tab-' + id); await page.waitForTimeout(1200);
      wahr(await page.isVisible('#offline-pille'), id + ': kein Offline-Hinweis über der Karte');
      wahr(/Offline.*Karte und Radar brauchen/.test(await page.textContent('#offline-pille')), id + ': Hinweistext');
    }
    await zu(); await page.click('#tab-mehr');
    wahr(await page.isVisible('#reiter-mehr h1') && (await inhalt()) > 100, 'Mehr leer');
    gleich(st.fehler, [], 'pageerror');
    await ctx.close();
  });

  // Vollbild: bei 390 × 844 und 1280 × 800
  for (const [b, h, opt] of [[390, 844, {}], [1280, 800, { isMobile: false, hasTouch: false, deviceScaleFactor: 1 }]]) {
    await pruefe('14 Vollbild (immer an) bei ' + b + ' × ' + h + ': Blatt füllt den Bildschirm, „Fertig“ oben rechts; Fertig, Esc und Zurück schließen und führen zum vorherigen Reiter', async () => {
      const { ctx, page, st } = await mockSeite(browser, Object.assign({ viewport: { width: b, height: h } }, opt), VB_AN);
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
      // „Fertig“ führt zum vorherigen Reiter, hier Mehr (nicht zur Startseite)
      await page.click('#tab-mehr');
      await page.click('#tab-graphs'); await page.waitForSelector('#graphs.mg-vollbild', { timeout: 8000 }); await page.waitForTimeout(500);
      await page.click('#graphs.mg-vollbild .mg-vb-fertig'); await page.waitForSelector('#graphs.mg-vollbild', { state: 'detached', timeout: 5000 });
      gleich(await page.getAttribute('#tab-mehr', 'aria-selected'), 'true', 'Fertig von Graphs (von Mehr gekommen) führt nicht zu Mehr');
      gleich(st.fehler, [], 'pageerror');
      await ctx.close();
    });
  }

  await pruefe('15 Schalter „immer im Vollbild“ aus: Reiter zeigen Diagramm/Karte eingebettet mit ⤢-Taste; Taste öffnet das Blatt, „Fertig“ schließt und bleibt im Reiter', async () => {
    const { ctx, page, st } = await mockSeite(browser);   // ohne gesetzten Schlüssel: ab Werk aus
    await page.click('#tab-mehr');
    gleich(await page.getAttribute('#schalter-vollbild', 'aria-checked'), 'false', 'Schalter ab Werk');
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

  await pruefe('15b Dauer-Vollbild ab Werk aus: Tab Graphs → Tab Rad/Sat und Graphs → Karten per Fingertipp auf die Tab-Leiste, ohne „Fertig“', async () => {
    const { ctx, page, st } = await mockSeite(browser, { colorScheme: 'light' });
    await page.addStyleTag({ content: SAFE });
    gleich(await page.evaluate(() => localStorage.getItem('wetterlage-vollbild-immer')), 'false', 'Schlüssel nach dem Start');
    for (const [von, nach] of [['graphs', 'radsat'], ['graphs', 'karten']]) {
      await page.tap('#tab-' + von); await page.waitForSelector('#graphs .mg-knoepfe', { timeout: 8000 }); await page.waitForTimeout(400);
      gleich(await page.locator('.mg-vollbild, .wk-vollbild').count(), 0, von + ': öffnet als Blatt');
      await page.tap('#tab-' + nach); await page.waitForTimeout(600);
      gleich(await page.getAttribute('#tab-' + nach, 'aria-selected'), 'true', nach + ' nicht aktiv nach Tippen auf die Tab-Leiste');
      wahr(await page.isVisible('#reiter-karte'), nach + ': Kartenreiter nicht sichtbar');
      gleich(await page.locator('.mg-vollbild, .wk-vollbild').count(), 0, nach + ': öffnet als Blatt');
    }
    gleich(st.fehler, [], 'pageerror');
    await ctx.close();
  });

  await pruefe('15c Graphs normal (Schalter aus), Safe Areas 47/34: Knöpfe der Knopfleiste nicht von der Tab-Leiste verdeckt, Datumsfahne unter der Kopfleiste; ⤢ öffnet das Blatt, „Fertig“ bleibt in Graphs', async () => {
    const { ctx, page, st } = await mockSeite(browser, { colorScheme: 'light' }, VB_AUS);
    await page.addStyleTag({ content: SAFE });
    await page.click('#tab-graphs'); await page.waitForSelector('#graphs path.mg-linie', { state: 'attached', timeout: 10000 }); await page.waitForTimeout(800);
    const probleme = [];
    for (const y of [150, 400, 700]) {
      await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(300);
      const r = await page.evaluate(() => {
        const aus = { verdeckt: [], knoepfe: 0, readoutTop: null, kopfUnten: document.getElementById('kopf').getBoundingClientRect().bottom };
        document.querySelectorAll('#graphs .mg-knoepfe button').forEach((b) => {
          const q = b.getBoundingClientRect(); if (q.width < 1 || q.height < 1 || getComputedStyle(b).visibility === 'hidden') return;
          aus.knoepfe++;
          // Mittelpunkt und oberer Rand (+ 6 px): die Tab-Leiste kann nur die untere Hälfte überdecken
          [q.top + q.height / 2, q.top + 6].forEach((py) => {
            const t = document.elementFromPoint(q.left + q.width / 2, py);
            if (!(t === b || b.contains(t))) aus.verdeckt.push((b.getAttribute('class') || b.tagName) + ' → ' + (t && (t.id || t.getAttribute('class') || t.tagName)));
          });
        });
        const ro = document.querySelector('#graphs .mg-readout'); if (ro) aus.readoutTop = ro.getBoundingClientRect().top;
        return aus;
      });
      if (r.knoepfe < 3) probleme.push('scrollY ' + y + ': zu wenige Knöpfe sichtbar (' + r.knoepfe + ')');
      if (r.verdeckt.length) probleme.push('scrollY ' + y + ': verdeckte Knöpfe ' + JSON.stringify(r.verdeckt));
      if (!(r.readoutTop !== null && r.readoutTop >= r.kopfUnten - 0.5)) probleme.push('scrollY ' + y + ': Datumsfahne (top ' + r.readoutTop + ') nicht unter der Kopfleiste (' + r.kopfUnten + ')');
    }
    gleich(probleme, [], 'Verdeckungsprüfung');
    await page.evaluate(() => window.scrollTo(0, 400)); await page.waitForTimeout(300);
    await page.click('#graphs .mg-btn-voll');
    await page.waitForSelector('#graphs.mg-vollbild', { timeout: 5000 }); await page.waitForTimeout(500);
    const unten = await page.evaluate(() => document.querySelector('#graphs.mg-vollbild .mg-knoepfe').getBoundingClientRect().bottom);
    wahr(unten > 844 - 34 - 20, 'Vollbild: Knopfleiste schwebt zu hoch (Unterkante ' + unten + ')');
    await page.click('#graphs.mg-vollbild .mg-vb-fertig'); await page.waitForSelector('#graphs.mg-vollbild', { state: 'detached', timeout: 5000 });
    gleich(await page.getAttribute('#tab-graphs', 'aria-selected'), 'true', 'Reiter nach „Fertig“');
    gleich(st.fehler, [], 'pageerror');
    await ctx.close();
  });

  await pruefe('15d Kopfleiste: fest (position fixed), bleibt beim Scrollen oben, overscroll none, Streifen in Höhe der Safe-Area deckend, Leisten ~85 % deckend, erster Inhalt unter der Kopfleiste bei 100/130/150 %', async () => {
    const { ctx, page, st } = await mockSeite(browser, { colorScheme: 'light' });
    await page.addStyleTag({ content: SAFE });
    const alpha = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c) || /color\(srgb ([^)]+)\)/.exec(c); const p = m[1].split(/[ ,/]+/).filter(Boolean); return p.length > 3 ? +p[3] : 1; };
    const k = await page.evaluate(() => {
      const kopf = document.getElementById('kopf'), c = getComputedStyle(kopf), b = getComputedStyle(kopf, '::before'), t = getComputedStyle(document.querySelector('.tabbar-huelle .tabbar'));
      return { pos: c.position, oh: getComputedStyle(document.documentElement).overscrollBehaviorY, ob: getComputedStyle(document.body).overscrollBehaviorY, bg: c.backgroundColor, tbg: t.backgroundColor,
        streifenH: b.height, streifenBg: b.backgroundColor, streifenPos: b.position, bf: c.backdropFilter || c.webkitBackdropFilter };
    });
    gleich(k.pos, 'fixed', 'Kopfleiste position');
    gleich([k.oh, k.ob], ['none', 'none'], 'overscroll-behavior html/body');
    gleich(k.streifenH, '47px', 'Streifen über der Kopfleiste (Höhe = Safe-Area oben)');
    gleich(alpha(k.streifenBg), 1, 'Streifen deckend');
    wahr(alpha(k.bg) >= 0.8 && alpha(k.bg) <= 0.9, 'Deckkraft Kopfleiste ' + alpha(k.bg) + ' (' + k.bg + ')');
    wahr(alpha(k.tbg) >= 0.8 && alpha(k.tbg) <= 0.9, 'Deckkraft Tab-Leiste ' + alpha(k.tbg) + ' (' + k.tbg + ')');
    wahr(/blur/.test(k.bf), 'Glas-Unschärfe der Kopfleiste fehlt: ' + k.bf);
    await page.evaluate(() => window.scrollTo(0, 600)); await page.waitForTimeout(300);
    gleich(await page.evaluate(() => window.scrollY > 100 && document.getElementById('kopf').getBoundingClientRect().top), 0, 'Kopfleiste nach Scrollen bei top');
    await page.evaluate(() => window.scrollTo(0, 0));
    for (const prozent of [100, 130, 150]) {
      await page.evaluate((p) => { document.documentElement.style.fontSize = (17 * p / 100) + 'px'; window.dispatchEvent(new Event('resize')); }, prozent);
      await page.waitForTimeout(600);
      for (const [tab, erst] of [['wetter', '#module > *'], ['mehr', '#reiter-mehr .mehr-titel']]) {
        await page.click('#tab-' + tab); await page.waitForTimeout(500);
        const m = await page.evaluate((q) => { const e = document.querySelector(q).getBoundingClientRect(); return [document.getElementById('kopf').getBoundingClientRect().bottom, e.top]; }, erst);
        wahr(m[1] >= m[0] - 0.5, prozent + ' % ' + tab + ': erster Inhalt (top ' + m[1] + ') beginnt unter der Kopfleiste (Unterkante ' + m[0] + ')');
      }
    }
    gleich(st.fehler, [], 'pageerror');
    await ctx.close();
  });

  await pruefe('16 Karte: nur die gewählten Ebenen sichtbar (Druck aus), Radar fordert keine Kacheln über Zoomstufe 7 an', async () => {
    const { ctx, page, st } = await mockSeite(browser, {}, VB_AN);
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
      try { localStorage.setItem('wetterlage-einheiten', '{"wind":"mph"}'); } catch (e) { }
      let ks; window.__ksFunktionen = null;
      Object.defineProperty(window, 'KSStudio', { configurable: true, get: () => ks, set: (v) => { ks = v; if (v && v.mount) { const m = v.mount; v.mount = function (w, o) { window.__ksFunktionen = o.funktionen; window.__ksOpt = { appName: o.appName, wind: o.wetter && o.wetter.wind }; return m.call(this, w, o); }; } } });
    });
    await page.goto('http://localhost:' + PORT + '/', { waitUntil: 'load' });
    await page.waitForFunction(() => /Stand \d\d:\d\d/.test(document.getElementById('kopf-stand').textContent), null, { timeout: 15000 });
    await page.click('#knopf-teilen');
    await page.waitForFunction(() => window.__ksFunktionen, null, { timeout: 15000 });
    const f = await page.evaluate(() => window.__ksFunktionen);
    gleich(f.wetterZeitpunkt, false, 'wetterZeitpunkt');
    const o = await page.evaluate(() => window.__ksOpt);
    gleich(o.appName, 'Wetterlage', 'appName (Logo-Schriftzug)');
    // Das Studio schreibt „km/h“ fest und hat keine Einheiten-Option: der Wind bleibt trotz mph-Wahl in km/h (Fixture 9,9 km/h), sonst stünde mph-Zahl mit „km/h“ im Bild
    gleich(o.wind, 10, 'Windwert für das Studio (km/h)');
    wahr(f.kamera === true && f.mediathek === true, 'übrige Funktionen aus kamera-studio.json fehlen');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    wahr(await page.isVisible('#studio-blatt'), 'Esc hat das Studio geschlossen');
    await page.click('#studio-fertig'); await page.waitForTimeout(300);
    wahr(!(await page.isVisible('#studio-blatt')), 'Fertig schließt das Studio nicht');
    gleich(st.fehler, [], 'pageerror');
    await ctx.close();
  });

  await pruefe('20 Karte im Reiter (Vollbild aus): Leaflet-Ebenen liegen weder über der Kopfleiste noch über dem Orte-Blatt', async () => {
    const { ctx, page, st } = await mockSeite(browser);
    // Wächter: echte Bildkacheln statt 1×1 px. Der Zeichenfehler selbst trat nur live auf (vermutlich durch die Temperaturfläche aus Live-Gitterdaten, die hier fehlen); belegt im Korrekturlauf 3 per Live-Skript
    await ctx.route((url) => /tile\.|tilecache\./.test(url.hostname), (r) => r.fulfill({ status: 200, contentType: 'image/png', headers: CORS, body: fs.readFileSync(path.join(WURZEL, 'apple-touch-icon.png')) }));
    for (const tab of ['karten', 'radsat']) {
      await page.tap('#tab-' + tab); await page.waitForTimeout(1500);
      // Kopfleiste: Mittelpunkt des Ortsnamens muss die Kopfleiste treffen, auch wenn die Karte darunter durchgescrollt ist
      await page.evaluate(() => window.scrollTo(0, 120)); await page.waitForTimeout(300);
      const kopf = await page.evaluate(() => { const k = document.getElementById('kopf-ort').getBoundingClientRect(), t = document.elementFromPoint(k.left + k.width / 2, k.top + k.height / 2); return !!(t && t.closest('#kopf')); });
      wahr(kopf, tab + ': Karte liegt über der Kopfleiste');
      // auch gezeichnet: freie Stelle der Kopfleiste (rechts neben dem Menü-Knopf) muss nahe der Leistenfarbe sein (85 % deckend), nicht Kartenfarbe
      const kp = await page.evaluate(() => { const m = document.getElementById('knopf-orte').getBoundingClientRect(); return { x: Math.round(m.right + 6), y: Math.round(m.top + m.height / 2), c: getComputedStyle(document.documentElement).getPropertyValue('--bg-2') }; });
      const kb = await page.screenshot({ clip: { x: kp.x, y: kp.y, width: 1, height: 1 } });
      const kpx = await page.evaluate(async (b64) => { const i = new Image(); i.src = 'data:image/png;base64,' + b64; await i.decode(); const cv = document.createElement('canvas'); cv.width = 1; cv.height = 1; const g = cv.getContext('2d'); g.drawImage(i, 0, 0); return Array.from(g.getImageData(0, 0, 1, 1).data.slice(0, 3)); }, kb.toString('base64'));
      const kso = await page.evaluate((c) => { const d = document.createElement('div'); d.style.color = c; document.body.appendChild(d); const v = getComputedStyle(d).color; d.remove(); const n = v.match(/[\d.]+/g).slice(0, 3).map(Number); return /color\(/.test(v) ? n.map((x) => Math.round(x * 255)) : n; }, kp.c.trim());
      wahr(kpx.every((v, i) => Math.abs(v - kso[i]) <= 45), tab + ': Kopfleiste gescrollt nicht in Leistenfarbe (Karte darüber gemalt?) – Pixel ' + kpx.join(',') + ', Leiste ' + kso.join(','));
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.tap('#knopf-orte'); await page.waitForTimeout(500);
      const blatt = await page.evaluate(() => { const r = document.getElementById('orte-fertig').getBoundingClientRect(), t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2), s = document.getElementById('orte-suche').getBoundingClientRect(), u = document.elementFromPoint(s.left + s.width / 2, s.top + s.height / 2); return [!!(t && t.id === 'orte-fertig'), !!(u && u.id === 'orte-suche')]; });
      gleich(blatt, [true, true], tab + ': Fertig und Suchfeld des Orte-Blatts frei');
      // WebKit trifft beim Tippen das Blatt, zeichnete live aber die Kartenebenen darüber: darum zusätzlich die Pixel prüfen (freie Blattfläche neben „Mein Standort“)
      await page.waitForTimeout(500);
      const ziel = await page.evaluate(() => { const s = document.getElementById('orte-standort').getBoundingClientRect(); const c = getComputedStyle(document.getElementById('orte-blatt')).backgroundColor; return { x: Math.round(s.right + 40), y: Math.round(s.top + s.height / 2), c }; });
      const bild = await page.screenshot({ clip: { x: ziel.x, y: ziel.y, width: 1, height: 1 } });
      const px = await page.evaluate(async (b64) => { const i = new Image(); i.src = 'data:image/png;base64,' + b64; await i.decode(); const cv = document.createElement('canvas'); cv.width = i.width; cv.height = i.height; const g = cv.getContext('2d'); g.drawImage(i, 0, 0); return Array.from(g.getImageData(0, 0, 1, 1).data.slice(0, 3)); }, bild.toString('base64'));
      const soll = ziel.c.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => (v <= 1 && /color\(/.test(ziel.c) ? Math.round(v * 255) : Math.round(v)));
      wahr(px.every((v, i) => Math.abs(v - soll[i]) <= 12), tab + ': unter dem Suchfeld ist nicht die Blattfarbe zu sehen (Karte darüber?) – Pixel ' + px.join(',') + ', Blatt ' + soll.join(','));
      await page.tap('#orte-fertig'); await page.waitForTimeout(400);
    }
    gleich(st.fehler, [], 'pageerror');
    await ctx.close();
  });

  await browser.close();
  srv.close();
  const schlecht = ergebnisse.filter((e) => !e[1]).length;
  console.log('\n' + (ergebnisse.length - schlecht) + ' von ' + ergebnisse.length + ' Tests grün');
  process.exit(schlecht ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
