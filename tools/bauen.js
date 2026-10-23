// Erhöht die Build-Nummer in sw.js und version.js um 1 und gibt die neue Nummer aus.
const fs = require('node:fs');
const path = require('node:path');
const wurzel = path.join(__dirname, '..');

function ersetze(datei, muster) {
  const pfad = path.join(wurzel, datei);
  const text = fs.readFileSync(pfad, 'utf8');
  let neu = null;
  const aus = text.replace(muster, (m, vor, nr, nach) => { neu = Number(nr) + 1; return vor + neu + nach; });
  if (neu === null) throw new Error('Build-Nummer in ' + datei + ' nicht gefunden');
  fs.writeFileSync(pfad, aus);
  return neu;
}

const a = ersetze('sw.js', /(const BUILD = )(\d+)(;)/);
const b = ersetze('version.js', /(build: )(\d+)( \})/);
if (a !== b) console.warn('Achtung: sw.js (' + a + ') und version.js (' + b + ') hatten verschiedene Nummern.');
console.log('Build ' + b);
