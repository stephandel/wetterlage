// Fotografiert jeden Reiter der App (Playwright WebKit, 390 × 844, doppelte Auflösung) in hell und dunkel.
// Aufruf: node tools/fotos.js [--fixtur] [--nur=reiter,schrift,quer,offline]   ->   pruefung/<reiter>-iphone-<hell|dunkel>.png
// Braucht Netz (echte Daten); ohne Netz zeigen die Fotos die Hinweise „keine Verbindung“.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { webkit } = require('playwright');

const WURZEL = path.join(__dirname, '..');
const AUS = path.join(WURZEL, 'pruefung');
const PORT = 8894;
const TYPEN = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };
const nur = ((process.argv.find((a) => a.startsWith('--nur=')) || '').slice(6) || 'reiter,schrift,quer,offline').split(',');

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

// Wartet auf Daten (Stand in der Kopfzeile) oder den Hinweis „keine Verbindung“, höchstens 15 s
async function datenDa(page) {
  await page.waitForFunction(() => { const t = document.getElementById('kopf-stand').textContent; return /Stand|Offline/.test(t); }, null, { timeout: 15000 }).catch(() => { });
  await page.waitForTimeout(1500);
}
// Schließt ein offenes Vollbild-Blatt („Fertig“), damit die Tab-Leiste wieder erreichbar ist
async function blattZu(page) {
  const f = page.locator('.mg-vb-fertig:visible, .wk-vb-fertig:visible').first();
  if (await f.count()) { await f.click(); await page.waitForTimeout(900); }   // der Kartenbaustein hat nach dem Verschieben einen 350-ms-Zeitgeber, der den Abbau stört
}
async function reiter(page, id) {
  await blattZu(page);
  await page.click('#tab-' + id);
  await page.waitForTimeout(400);
}
async function diagrammDa(page) {
  await page.waitForFunction(() => document.querySelectorAll('#graphs svg.mg-svg rect').length > 5 || /keine Verbindung|nicht erreichbar|Keine Daten/i.test(document.getElementById('graphs').textContent), null, { timeout: 15000 }).catch(() => { });
  await page.waitForTimeout(1200);
}
async function karteDa(page) {
  await page.waitForFunction(() => document.querySelectorAll('#karte .leaflet-tile-loaded').length > 3 || /keine Verbindung|nicht erreichbar/i.test(document.getElementById('karte').textContent), null, { timeout: 15000 }).catch(() => { });
  await page.waitForTimeout(2500);
}
async function foto(page, name) {
  const datei = path.join(AUS, name + '.png');
  await page.screenshot({ path: datei });
  console.log('Foto ' + path.relative(WURZEL, datei));
}
// --fixtur: Wetterdaten aus tests/fixturen mit fester Uhr (23.10.2026 04:40 Ortszeit), nur Kartenkacheln kommen aus dem Netz
// (nützlich, wenn die Open-Meteo-Stundengrenze erreicht ist); ohne den Schalter kommt alles live aus dem Netz
const FIXTUR = process.argv.includes('--fixtur');
async function neu(browser, opt) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, FIXTUR ? { serviceWorkers: 'block' } : {}, opt));   // mit Service Worker umgeht WebKit das route()
  if (FIXTUR) {
    const F = (n) => fs.readFileSync(path.join(WURZEL, 'tests', 'fixturen', n));
    await ctx.route((url) => url.hostname !== 'localhost' && url.hostname !== '127.0.0.1', (r) => {
      const u = new URL(r.request().url()), j = (n) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: F(n) });
      if (u.hostname === 'api.open-meteo.com') return /minutely_15/.test(u.search) ? j('vorhersage.json') : (/latitude=[^&]*,/.test(u.search) ? r.abort() : j('meteogramm.json'));
      if (u.hostname === 'air-quality-api.open-meteo.com') return j('luft.json');
      if (u.hostname === 'api.brightsky.dev') return j('warnung.json');
      if (u.hostname === 'marine-api.open-meteo.com') return j('meer.json');
      if (u.hostname === 'api.rainviewer.com') return j('radar.json');
      return r.continue();
    });
    await ctx.clock.setFixedTime(new Date('2026-10-23T02:40:00Z'));
  }
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', (e) => fehler.push(e.message));
  return { ctx, page, fehler };
}

(async () => {
  fs.mkdirSync(AUS, { recursive: true });
  const srv = server();
  const browser = await webkit.launch();
  const url = 'http://localhost:' + PORT + '/';

  if (nur.includes('reiter')) {
    for (const modus of ['hell', 'dunkel']) {
      const { ctx, page, fehler } = await neu(browser, { colorScheme: modus === 'hell' ? 'light' : 'dark' });
      await page.goto(url, { waitUntil: 'load' });
      await datenDa(page);
      await foto(page, 'wetter-iphone-' + modus);
      // ganze Seite in Abschnitten (fullPage scheitert in WebKit)
      const hoehe = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let i = 1, y = 700; y < hoehe; i++, y += 700) {
        await page.evaluate((v) => window.scrollTo(0, v), y);
        await page.waitForTimeout(500);
        await foto(page, 'wetter-iphone-' + modus + '-' + i);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await reiter(page, 'graphs'); await diagrammDa(page); await foto(page, 'graphs-iphone-' + modus);
      await reiter(page, 'karten'); await karteDa(page); await foto(page, 'karten-iphone-' + modus);
      await reiter(page, 'radsat'); await karteDa(page); await foto(page, 'radsat-iphone-' + modus);
      await reiter(page, 'mehr'); await page.waitForTimeout(500); await foto(page, 'mehr-iphone-' + modus);
      console.log('Seitenfehler (' + modus + '): ' + JSON.stringify(fehler));
      await ctx.close();
    }
  }

  if (nur.includes('schrift')) {
    for (const prozent of [130, 150]) {
      const { ctx, page, fehler } = await neu(browser, { colorScheme: 'light' });
      await page.goto(url, { waitUntil: 'load' });
      await datenDa(page);
      await page.evaluate((p) => { document.documentElement.style.fontSize = (17 * p / 100) + 'px'; window.dispatchEvent(new Event('resize')); }, prozent);
      await page.waitForTimeout(800);
      await foto(page, 'wetter-iphone-' + prozent);
      const hoehe = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let i = 1, y = 700; y < hoehe; i++, y += 700) {
        await page.evaluate((v) => window.scrollTo(0, v), y);
        await page.waitForTimeout(400);
        await foto(page, 'wetter-iphone-' + prozent + '-' + i);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await reiter(page, 'mehr'); await page.waitForTimeout(500); await foto(page, 'mehr-iphone-' + prozent);
      console.log('scrollWidth bei ' + prozent + ' %: ' + (await page.evaluate(() => document.documentElement.scrollWidth)) + ', Seitenfehler: ' + JSON.stringify(fehler));
      await ctx.close();
    }
  }

  if (nur.includes('quer')) {
    const { ctx, page } = await neu(browser, { colorScheme: 'light', viewport: { width: 844, height: 390 } });
    await page.goto(url, { waitUntil: 'load' });
    await datenDa(page);
    await foto(page, 'wetter-quer-hell');
    await ctx.close();
  }

  if (nur.includes('offline')) {
    const { ctx, page } = await neu(browser, { colorScheme: 'light', serviceWorkers: 'allow' });
    await page.goto(url, { waitUntil: 'load' });
    await datenDa(page);
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await ctx.setOffline(true);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(2500);
    await foto(page, 'offline-iphone-hell');
    await ctx.close();
  }

  await browser.close();
  srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
