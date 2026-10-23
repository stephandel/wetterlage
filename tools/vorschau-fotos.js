// Fotografiert die Vorschau des Design-Konfigurators (Vergleichsmaßstab) in WebKit.
// Aufruf: node tools/vorschau-fotos.js  ->  pruefung/vorschau-<reiter>-iphone-<hell|dunkel>.png
const fs = require('fs');
const path = require('path');

// Ort der Playwright-Installation außerhalb des Projekts (Ausweichpfad, falls lokal keine da ist)
const PW_AUSWEICH = '/private/tmp/claude-501/-Users-stephanhandel-KI-Projekte-wetterlage/89d1888f-608b-4816-89f7-422d5363c083/scratchpad/pw/node_modules/playwright';
let webkit;
try { ({ webkit } = require('playwright')); } catch (e) { ({ webkit } = require(PW_AUSWEICH)); }

const projekt = path.join(__dirname, '..');
const url = fs.readFileSync(path.join(projekt, 'PRUEFAUFTRAG.md'), 'utf8').match(/https:\/\/design-konfigurator\.[^\s)>"'`]+#c=[^\s)>"'`]+/)[0];
const ausgabe = path.join(projekt, 'pruefung');
fs.mkdirSync(ausgabe, { recursive: true });

const reiter = { wetter: 'Wetter', graphs: 'Graphs', karten: 'Karten', radsat: 'Rad/Sat', mehr: 'Mehr' };

(async () => {
  const browser = await webkit.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
  page.on('pageerror', e => console.log('Seitenfehler:', e.message));
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForSelector('#pvRoot [role=tab]', { timeout: 30000 });
  // Begrüßungs-Dialog schließen, falls vorhanden
  for (const n of ['Weiter', 'Schließen', 'Los']) {
    const b = page.locator('dialog[open] button, [role=dialog] button').filter({ hasText: n }).first();
    if (await b.count()) { await b.click().catch(() => {}); break; }
  }
  const waehle = (name, wert) => page.evaluate(([n, w]) => { const r = document.querySelector(`input[name="${n}"][value="${w}"]`); r.checked = true; r.click(); r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); }, [name, wert]);
  await waehle('geraet', 'iphone');
  for (const modus of ['hell', 'dunkel']) {
    await waehle('erscheinung', modus);
    await page.waitForTimeout(800);
    for (const [key, text] of Object.entries(reiter)) {
      const tab = page.locator('#pvRoot [role=tab]').filter({ has: page.locator('span', { hasText: new RegExp('^' + text.replace('/', '\\/') + '$') }) }).first();
      if (!(await tab.count())) { console.log('Reiter fehlt:', text); continue; }
      // Graphs/Karten usw. erscheinen als Unterbildschirm mit „Fertig“ und ohne Tab-Leiste: erst zurück
      if (!(await tab.isVisible())) {
        await page.locator('#pvRoot button').filter({ hasText: /^Fertig$/ }).first().click();
        await page.waitForTimeout(500);
      }
      await tab.click();
      await page.waitForTimeout(2500);
      const datei = path.join(ausgabe, `vorschau-${key}-iphone-${modus}.png`);
      await page.locator('#frame').screenshot({ path: datei });
      console.log('OK', datei);
    }
  }
  await browser.close();
})().catch(e => { console.error('Fehler:', e.message); process.exit(1); });
