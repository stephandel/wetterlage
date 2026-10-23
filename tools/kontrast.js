// Misst Kontraste der eigenen Farbpaare (WCAG 2.x) in hell und dunkel, mit den echten berechneten Farben aus WebKit.
// Aufruf: node tools/kontrast.js   (Exit-Code 1, wenn ein Paar unter 4,5:1 liegt; Symbole/Rahmen unter 3:1)
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { webkit } = require('playwright');
const WURZEL = path.join(__dirname, '..');
const PORT = 8893;
const TYPEN = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png' };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(WURZEL, p); if (!f.startsWith(WURZEL) || f.includes('node_modules') || !fs.existsSync(f) || !fs.statSync(f).isFile()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': TYPEN[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(PORT);

// [Name, Vordergrund, Hintergrund, Mindestwert]; Hintergründe dürfen mit Alpha über --bg (Seite) liegen
const PAARE = [
  ['Text auf Kachel', 'var(--label)', 'var(--bg-2)', 4.5],
  ['Nebentext (--label-2) auf Kachel', 'var(--label-2)', 'var(--bg-2)', 4.5],
  ['Nebentext (--label-2) auf Tagesfarbe a', 'var(--label-2)', 'var(--tag-a)', 4.5],
  ['Nebentext (--label-2) auf Tagesfarbe b', 'var(--label-2)', 'var(--tag-b)', 4.5],
  ['Nebentext (--nebentext) auf Seite', 'var(--nebentext)', 'var(--bg)', 4.5],
  ['Nebentext (--nebentext) auf Leiste (85 %) über Seite', 'var(--nebentext)', 'var(--leiste-bg)', 4.5],
  ['Text auf Leiste (Kopfzeile, Tab-Leiste, 85 %)', 'var(--label)', 'var(--leiste-bg)', 4.5],
  ['Akzent auf Seite', 'var(--akzent)', 'var(--bg)', 4.5],
  ['Akzent auf Kachel', 'var(--akzent)', 'var(--bg-2)', 4.5],
  ['Akzent auf Leiste (aktiver Tab, Kopf-Symbole, 85 %)', 'var(--akzent)', 'var(--leiste-bg)', 4.5],
  ['Text auf Akzentfläche (Segment, Schalter)', 'var(--auf-akzent)', 'var(--akzent)', 4.5],
  ['Zweitfarbe auf Kachel (Hero, Aktuell, Stundenwerte)', 'var(--akzent-2)', 'var(--bg-2)', 4.5],
  ['Tagesname/Höchstwert auf Tagesfarbe a', 'var(--akzent-2-text)', 'var(--tag-a)', 4.5],
  ['Tagesname/Höchstwert auf Tagesfarbe b', 'var(--akzent-2-text)', 'var(--tag-b)', 4.5],
  ['Pille „Stufe N von 4“ (label auf akzent-tint)', 'var(--label)', 'var(--akzent-tint)', 4.5],
  ['Warnung Stufe 1: Text', 'var(--label)', 'var(--warn-1)', 4.5],
  ['Warnung Stufe 2: Text', 'var(--label)', 'var(--warn-2)', 4.5],
  ['Warnung Stufe 3: Text', 'var(--label)', 'var(--warn-3)', 4.5],
  ['Warnung Stufe 4: Text', 'var(--label)', 'var(--warn-4)', 4.5],
  ['Pille auf Warnung Stufe 1', 'var(--label)', 'var(--akzent-tint)', 4.5],
  ['Chip „Karte öffnen“ (label auf fuellung über Kachel)', 'var(--label)', 'color-mix(in srgb, var(--fuellung) 100%, var(--bg-2))', 4.5],
  ['Chip-Symbol (Akzent auf fuellung) – Symbol 3:1', 'var(--akzent)', 'color-mix(in srgb, var(--fuellung) 100%, var(--bg-2))', 3],
  ['Radar-Chip „04:30 Uhr“ (label auf bg-2 88 %)', 'var(--label)', 'var(--bg-2)', 4.5],
  ['Segment aus: label auf fuellung', 'var(--label)', 'color-mix(in srgb, var(--fuellung) 100%, var(--bg-2))', 4.5],
  ['Schalter-Rand (Nebentext auf Kachel) – 3:1', 'var(--nebentext)', 'var(--bg-2)', 3],
  ['Luftring orange auf Kachel (hell mit brightness(.82) wie in module.css) – Symbol 3:1', ['color-mix(in srgb, var(--orange) 82%, black)', 'var(--orange)'], 'var(--bg-2)', 3],
  ['Luftring grün auf Kachel (hell mit brightness(.82) wie in module.css) – Symbol 3:1', ['color-mix(in srgb, var(--gruen) 82%, black)', 'var(--gruen)'], 'var(--bg-2)', 3],
  ['Luftring rot auf Kachel (hell mit brightness(.82) wie in module.css) – Symbol 3:1', ['color-mix(in srgb, var(--rot) 82%, black)', 'var(--rot)'], 'var(--bg-2)', 3]
];

function rgba(s) {
  let m = /^rgba?\(([^)]+)\)$/.exec(s);
  if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
  m = /^color\(srgb ([^)]+)\)$/.exec(s);
  if (m) { const p = m[1].split(/[ /]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p.length > 3 ? p[3] : 1]; }
  throw new Error('Farbe nicht lesbar: ' + s);
}
const ueber = (v, h) => [0, 1, 2].map((i) => v[i] * v[3] + h[i] * (1 - v[3])).concat(1);
function lum(c) { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); }
const verhaeltnis = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

(async () => {
  const browser = await webkit.launch();
  let schlecht = 0;
  for (const modus of ['light', 'dark']) {
    const page = await (await browser.newContext({ colorScheme: modus })).newPage();
    await page.goto('http://localhost:' + PORT + '/', { waitUntil: 'load' });
    const farben = await page.evaluate(([paare, dunkel]) => paare.map(([n, f, b]) => {
      if (Array.isArray(f)) f = f[dunkel ? 1 : 0];
      const e = document.createElement('div'); e.style.color = f; e.style.backgroundColor = b; document.body.appendChild(e);
      const cs = getComputedStyle(e), r = [cs.color, cs.backgroundColor]; e.remove();
      const s = document.createElement('div'); s.style.backgroundColor = 'var(--bg)'; document.body.appendChild(s); r.push(getComputedStyle(s).backgroundColor); s.remove();
      return r;
    }), [PAARE, modus === 'dark']);
    console.log('\n' + (modus === 'light' ? 'HELL' : 'DUNKEL'));
    PAARE.forEach(([n, , , min], i) => {
      const seite = rgba(farben[i][2]);
      const bg = ueber(rgba(farben[i][1]), seite), fg = ueber(rgba(farben[i][0]), bg);
      const v = verhaeltnis(fg, bg), ok = v >= min;
      if (!ok) schlecht++;
      console.log((ok ? 'ok     ' : 'ZU WENIG ') + v.toFixed(2).padStart(5) + ':1 (min ' + min + ')  ' + n);
    });
  }
  await browser.close(); srv.close();
  console.log('\n' + (schlecht ? schlecht + ' Paar(e) unter dem Mindestwert' : 'alle Paare erreichen den Mindestwert'));
  process.exit(schlecht ? 1 : 0);
})();
