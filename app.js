/* app.js – Hülle der App Wetterlage: Reiter, Orte, Daten laden, Kamera-Studio, Service Worker.
   Schnittstelle zu module.js: #module, Module.skeleton(container), Module.rendern(container, daten, ctx), Module.fehler(container, text, nochmal);
   ctx = { oeffneReiter(id), nochmal(), warnungWeg(ids) }; Module.warnungZeigen(container, daten), Module.rechnen.warn*, Module.WEG_SCHLUESSEL, Module.warnSymbol(). Gemeinsame Hilfen: window.WL (gemeinsam.js). */
(function () {
  'use strict';

  var STANDARD_ORTE = [
    { id: 'mannheim', name: 'Mannheim', lat: 49.4875, lon: 8.466 },
    { id: 'mengerschied', name: 'Mengerschied', lat: 49.91667, lon: 7.5 },
    { id: 'corralejo', name: 'Corralejo', lat: 28.7297, lon: -13.8672 }
  ];
  var STANDARD_IDS = STANDARD_ORTE.map(function (o) { return o.id; });
  var REITER = {
    wetter: { panel: 'reiter-wetter' }, graphs: { panel: 'reiter-graphs' }, karten: { panel: 'reiter-karte' },
    radsat: { panel: 'reiter-karte' }, mehr: { panel: 'reiter-mehr' }
  };
  var REITER_REIHE = ['wetter', 'graphs', 'karten', 'radsat', 'mehr'];
  var BAUSTEIN_REITER = ['graphs', 'karten', 'radsat'];
  var AUFFRISCHEN_MS = 15 * 60 * 1000;
  var GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';

  var z = {
    ort: null, orte: [], favoriten: [], standort: null, einheiten: WL.einheitenLesen(),
    reiter: 'wetter', vorher: null, letzterFester: 'wetter', aktuell: null, ladeNr: 0, startMgAusstehend: false, abbauend: false,
    geoNr: 0, geoTimer: null, blattOeffner: null
  };

  function $(id) { return document.getElementById(id); }
  function esc(s) { return WL.esc(s); }
  function gueltig(o) { return o && typeof o.id === 'string' && typeof o.name === 'string' && isFinite(o.lat) && isFinite(o.lon); }

  // ---------- Symbole in die Knöpfe setzen ----------
  function ikonenSetzen(wurzel) {
    Array.prototype.forEach.call((wurzel || document).querySelectorAll('[data-ikon]'), function (el) {
      if (el.getAttribute('data-ikon-fertig')) return;
      el.insertAdjacentHTML('afterbegin', window.Ikon(el.getAttribute('data-ikon')));
      el.setAttribute('data-ikon-fertig', '1');
    });
  }
  var STERN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.3l-5.8 3.1 1.1-6.5L2.6 9.3l6.5-.9L12 2.5z"/></svg>';

  // ---------- Orte ----------
  function orteLaden() {
    var gespeichert = WL.merk('orte');
    var liste = Array.isArray(gespeichert) ? gespeichert.filter(gueltig) : [];
    STANDARD_ORTE.slice().reverse().forEach(function (s) {
      if (!liste.some(function (o) { return o.id === s.id; })) liste.unshift(Object.assign({}, s));
    });
    z.orte = liste;
    var fav = WL.merk('favoriten');
    z.favoriten = Array.isArray(fav) ? fav.filter(function (id) { return typeof id === 'string'; }) : [];
    var aktivId = WL.merk('ort-aktiv');
    z.ort = z.orte.filter(function (o) { return o.id === aktivId; })[0] || z.orte.filter(function (o) { return o.id === 'mannheim'; })[0];
  }
  function orteSpeichern() { WL.merk('orte', z.orte.map(function (o) { return { id: o.id, name: o.name, lat: o.lat, lon: o.lon, region: o.region || undefined }; })); }
  function favSpeichern() { WL.merk('favoriten', z.favoriten); }
  function sortierteOrte() {
    var liste = z.orte.slice();
    var fav = liste.filter(function (o) { return z.favoriten.indexOf(o.id) >= 0; });
    var rest = liste.filter(function (o) { return z.favoriten.indexOf(o.id) < 0; });
    var alle = fav.concat(rest);
    if (z.standort) alle.unshift(z.standort);
    return alle;
  }
  function ortZeile(o, kurz) {
    var aktiv = z.ort && o.id === z.ort.id;
    var istStandort = o.id === 'standort';
    var fav = z.favoriten.indexOf(o.id) >= 0;
    var h = '<div class="ort-zeile">';
    h += '<button type="button" class="ort-name" data-aktion="waehlen" data-id="' + esc(o.id) + '"' + (aktiv ? ' aria-current="true"' : '') + '><span>' + esc(o.name) + '</span>' + (o.region ? '<small>' + esc(o.region) + '</small>' : '') + (aktiv ? '<span class="nur-sr">, aktueller Ort</span>' : '') + '</button>';
    if (aktiv) h += '<span class="ort-haken" aria-hidden="true">' + window.Ikon('check') + '</span>';
    if (!istStandort) h += '<button type="button" class="stern" data-aktion="stern" data-id="' + esc(o.id) + '" aria-pressed="' + fav + '">' + STERN + '<span class="nur-sr">Favorit ' + esc(o.name) + '</span></button>';
    if (!kurz && !istStandort && STANDARD_IDS.indexOf(o.id) < 0) h += '<button type="button" class="ort-entfernen" data-aktion="entfernen" data-id="' + esc(o.id) + '" aria-label="' + esc(o.name) + ' entfernen">Entfernen</button>';
    return h + '</div>';
  }
  function orteZeichnen() {
    var alle = sortierteOrte();
    $('orte-liste').innerHTML = alle.map(function (o) { return ortZeile(o, false); }).join('');
    $('mehr-orte').innerHTML = alle.map(function (o) { return ortZeile(o, true); }).join('');
  }
  function ortPerId(id) { return (z.standort && z.standort.id === id) ? z.standort : z.orte.filter(function (o) { return o.id === id; })[0]; }

  function waehleOrt(ort, vonMehr) {
    if (!ort) return;
    z.ort = ort;
    if (ort.id !== 'standort') WL.merk('ort-aktiv', ort.id);
    z.abbauend = true; try { if (window.Bausteine) Bausteine.abbauen(); } catch (e) { } z.abbauend = false;
    z.aktuell = null; z.obj = null; z.startMgAusstehend = false;
    warnKnopfZeigen();
    kopfOrt();
    orteZeichnen();
    if (!$('orte-blatt').hidden) blattSchliessen('orte');
    if (vonMehr || z.reiter === 'mehr') zeigeReiter('wetter'); else zeigeReiter(z.reiter);
    ladeAlles(ort);
  }

  function listenKlick(ev) {
    var b = ev.target.closest && ev.target.closest('[data-aktion]');
    if (!b) return;
    var id = b.getAttribute('data-id'), a = b.getAttribute('data-aktion');
    if (a === 'waehlen') waehleOrt(ortPerId(id), !!b.closest('#mehr-orte'));
    else if (a === 'stern') {
      var i = z.favoriten.indexOf(id);
      if (i >= 0) z.favoriten.splice(i, 1); else z.favoriten.push(id);
      favSpeichern(); orteZeichnen();
      var neu = document.querySelector('.stern[data-id="' + id + '"]'); if (neu) neu.focus();
    } else if (a === 'entfernen') {
      if (STANDARD_IDS.indexOf(id) >= 0) return;
      z.orte = z.orte.filter(function (o) { return o.id !== id; });
      z.favoriten = z.favoriten.filter(function (f) { return f !== id; });
      orteSpeichern(); favSpeichern(); WL.merk('daten-' + id, null); WL.merk('meer-' + id, null);
      if (z.ort.id === id) waehleOrt(ortPerId('mannheim')); else orteZeichnen();
    }
  }

  // ---------- Kopfzeile ----------
  function kopfOrt() { $('kopf-ort').textContent = z.ort ? z.ort.name : 'Wetterlage'; }
  function kopfStand(text) { $('kopf-stand').textContent = text; }
  function standText(d) {
    var off = d.forecast && d.forecast.utc_offset_seconds || 0;
    return (d.offline ? 'Offline · ' : '') + 'Stand ' + WL.ortsZeit(off, d.stand).zeit;
  }

  // Die Kopfleiste ist fest; der Inhalt rückt um ihre echte Höhe ein (bei großer Schrift wird sie höher als --kopf-hoehe)
  function kopfHoeheMessen() {
    var kopf = $('kopf');
    function setze() { document.documentElement.style.setProperty('--kopf-ist', kopf.offsetHeight + 'px'); }
    setze();
    if (window.ResizeObserver) new ResizeObserver(setze).observe(kopf, { box: 'border-box' });   // Safe-Area ist Innenabstand: nur die Rahmenbox ändert sich
    else window.addEventListener('resize', setze);
  }

  // ---------- Warnung: ⚠️ in der Kopfleiste ----------
  // Weg-Liste (localStorage, [{ id, expires }]) pflegt app.js; module.js liest sie beim Zeichnen und meldet das Wegklicken über ctx.warnungWeg
  function wegLesen() { return Module.rechnen.wegAufraeumen(WL.merk(Module.WEG_SCHLUESSEL), Date.now()); }
  function warnAnsage(text) { var a = $('warn-ansage'); a.textContent = ''; setTimeout(function () { a.textContent = text; }, 50); }
  function warnKnopfZeigen() {
    var b = $('knopf-warnung'), d = z.obj, kopf = $('kopf');
    var a = d && Module.rechnen.warnAuswahl(d.warnungen, wegLesen(), Date.now());
    var zeigen = !!(a && !a.zeigen && a.erste);
    var warSichtbar = !b.hidden;
    if (zeigen) {
      var w = a.erste, off = d.forecast && d.forecast.utc_offset_seconds || 0, kurz = Module.rechnen.warnKurz(w, off).split(' · ');
      var stufe = kurz[0].replace(/^Stufe (\d) von 4$/, '$1');
      b.innerHTML = Module.warnSymbol();
      b.setAttribute('data-stufe', stufe);
      b.setAttribute('aria-label', 'Wetterwarnung Stufe ' + stufe + ': ' + kurz.slice(1).join(', ') + ' – antippen zum Anzeigen');
    }
    b.hidden = !zeigen;
    kopf.classList.toggle('mit-warnung', zeigen);
    // Wackeln nur beim Erscheinen, nicht bei jedem Neuladen
    if (zeigen && !warSichtbar) { b.classList.remove('wackelt'); void b.offsetWidth; b.classList.add('wackelt'); }
    if (!zeigen) b.classList.remove('wackelt');
  }
  // „x“ in der Kachel: alle gezeigten Warnungen merken, Kachel ist schon entfernt
  function warnungWeg(ids) {
    var d = z.obj; if (!d) return;
    var liste = wegLesen();
    (d.warnungen || []).forEach(function (w) {
      var i = w && (w.id != null ? w.id : w.alert_id);
      if (i != null && ids.indexOf(String(i)) >= 0) liste = Module.rechnen.wegMerken(liste, w, Date.now());
    });
    WL.merk(Module.WEG_SCHLUESSEL, liste);
    warnKnopfZeigen();
    warnAnsage('Warnung ausgeblendet. Symbol oben links zeigt sie wieder.');
    var b = $('knopf-warnung'); if (!b.hidden) b.focus();
  }
  // Tipp auf ⚠️: Kachel wieder, aufgeklappt, oben, Fokus auf die Kachel-Zeile
  function warnungZurueck() {
    var d = z.obj; if (!d) return;
    var ids = (d.warnungen || []).map(function (w) { return String(w.id != null ? w.id : w.alert_id); });
    WL.merk(Module.WEG_SCHLUESSEL, Module.rechnen.wegEntfernen(wegLesen(), ids));
    var zeile = Module.warnungZeigen($('module'), d);
    warnKnopfZeigen();
    window.scrollTo(0, 0);
    if (zeile) zeile.focus();
  }

  // ---------- Reiter ----------
  // Ohne Netz zeigt der Kartenbaustein nur eine leere Fläche: Hinweis darüber
  // Graphs ohne Netz: derselbe ruhige Hinweis statt der Fehlermeldung des Bausteins (body.graphs-offline blendet sie aus)
  function offlineHinweis() {
    var offline = navigator.onLine === false || !!(z.aktuell && z.aktuell.offline);
    var karte = z.reiter === 'karten' || z.reiter === 'radsat', graphs = z.reiter === 'graphs';
    var pille = $('offline-pille');
    pille.textContent = graphs ? 'Offline · Diagramm braucht Netz' : 'Offline: Karte und Radar brauchen eine Verbindung.';
    pille.hidden = !((karte || graphs) && offline);
    document.body.classList.toggle('graphs-offline', graphs && offline);
  }
  function zeigeReiter(id) {
    if (!REITER[id]) id = 'wetter';
    if (id !== z.reiter) z.vorher = z.reiter;
    z.reiter = id;
    if (BAUSTEIN_REITER.indexOf(id) < 0) z.letzterFester = id;
    var panel = REITER[id].panel;
    ['reiter-wetter', 'reiter-graphs', 'reiter-karte', 'reiter-mehr'].forEach(function (p) { $(p).hidden = p !== panel; });
    REITER_REIHE.forEach(function (r) {
      var t = $('tab-' + r), an = r === id;
      t.setAttribute('aria-selected', an ? 'true' : 'false'); t.tabIndex = an ? 0 : -1;
    });
    $('reiter-karte').setAttribute('aria-labelledby', id === 'radsat' ? 'tab-radsat' : 'tab-karten');
    window.scrollTo(0, 0);
    offlineHinweis();
    if (!window.Bausteine || !z.ort) return;
    var off = z.aktuell && z.aktuell.forecast && z.aktuell.forecast.utc_offset_seconds || 0;
    try {
      if (id === 'wetter') startMeteogrammZeigen();
      else if (id === 'graphs') Bausteine.graphs(z.ort);
      else if (id === 'karten' || id === 'radsat') Bausteine.karte(id, z.ort, z.orte, off);
      else if (id === 'mehr') mehrZeichnen();
    } catch (e) { if (window.console) console.warn('Reiter ' + id + ':', e); }
  }
  function startMeteogrammZeigen() {
    if (!z.startMgAusstehend || !$('start-meteogramm')) return;
    z.startMgAusstehend = false;
    z.abbauend = true; try { Bausteine.abbauen(); } catch (e) { } z.abbauend = false;   // alte Instanz zeigt auf ein ersetztes Ziel
    try { Bausteine.startMeteogramm(z.ort); } catch (e) { if (window.console) console.warn('Meteogramm:', e); }
  }
  function tabTasten(ev) {
    var i = REITER_REIHE.indexOf(z.reiter), n = -1;
    if (ev.key === 'ArrowRight') n = (i + 1) % REITER_REIHE.length;
    else if (ev.key === 'ArrowLeft') n = (i + REITER_REIHE.length - 1) % REITER_REIHE.length;
    else if (ev.key === 'Home') n = 0;
    else if (ev.key === 'End') n = REITER_REIHE.length - 1;
    if (n < 0) return;
    ev.preventDefault();
    zeigeReiter(REITER_REIHE[n]);
    $('tab-' + REITER_REIHE[n]).focus();
  }

  // ---------- Mehr ----------
  function mehrZeichnen() {
    Array.prototype.forEach.call($('seg-temp').children, function (b) { b.setAttribute('aria-checked', String(b.getAttribute('data-wert') === z.einheiten.temp)); });
    Array.prototype.forEach.call($('seg-wind').children, function (b) { b.setAttribute('aria-checked', String(b.getAttribute('data-wert') === z.einheiten.wind)); });
    var vb = false; try { vb = window.Bausteine ? Bausteine.immerVollbild() : false; } catch (e) { }
    $('schalter-vollbild').setAttribute('aria-checked', String(vb));
    var v = window.WL_VERSION || { app: '0.9.0', build: 1 };
    $('ueber-version').textContent = 'Version ' + v.app + ' · Build ' + v.build;
  }
  function einheitWahl(art) {
    return function (ev) {
      var b = ev.target.closest('button[data-wert]'); if (!b) return;
      z.einheiten[art] = b.getAttribute('data-wert');
      WL.einheitenSchreiben(z.einheiten);
      mehrZeichnen();
      if (z.aktuell) rendere(z.aktuell);
    };
  }

  // ---------- Blätter ----------
  var SCHICHTEN = ['kopf', 'inhalt'];
  function schichtenSperren(an) {
    SCHICHTEN.forEach(function (id) { var el = $(id); if (an) el.setAttribute('inert', ''); else el.removeAttribute('inert'); });
    var nav = document.querySelector('.tabbar-huelle'); if (an) nav.setAttribute('inert', ''); else nav.removeAttribute('inert');
    document.body.classList.toggle('blatt-offen', an);
  }
  function blattOeffnen(name, fokusId) {
    var blatt = $(name + '-blatt');
    z.blattOeffner = document.activeElement;
    blatt.hidden = false; schichtenSperren(true);
    var f = $(fokusId || (name + '-titel')); if (f) f.focus();
  }
  function blattSchliessen(name) {
    var blatt = $(name + '-blatt');
    if (blatt.hidden) return;
    blatt.hidden = true; schichtenSperren(false);
    var o = z.blattOeffner; z.blattOeffner = null;
    if (o && document.contains(o) && o.focus) o.focus();
  }
  function orteOeffnen(suchen) {
    orteZeichnen();
    $('orte-meldung').textContent = ''; $('orte-ergebnisse').hidden = true; $('standort-frage').hidden = true;
    blattOeffnen('orte', suchen ? 'orte-suche' : 'orte-titel');
  }

  // ---------- Ortssuche (Geocoding) ----------
  function suche() {
    var q = $('orte-suche').value.trim();
    var erg = $('orte-ergebnisse'), meld = $('orte-meldung');
    clearTimeout(z.geoTimer);
    if (q.length < 2) { erg.hidden = true; erg.innerHTML = ''; meld.textContent = ''; return; }
    z.geoTimer = setTimeout(function () {
      var nr = ++z.geoNr;
      meld.textContent = 'Suche …';
      holeJson(GEO_URL + '?name=' + encodeURIComponent(q) + '&count=8&language=de&format=json').then(function (j) {
        if (nr !== z.geoNr) return;
        var liste = (j && j.results) || [];
        if (!liste.length) { erg.hidden = true; erg.innerHTML = ''; meld.textContent = 'Keinen Ort zu „' + q + '“ gefunden. Versuche eine andere Schreibweise.'; return; }
        meld.textContent = liste.length + (liste.length === 1 ? ' Treffer' : ' Treffer');
        erg.innerHTML = liste.map(function (r, i) {
          var sub = [r.admin1, r.country].filter(Boolean).join(', ');
          return '<div class="ort-zeile"><button type="button" class="ort-name" data-treffer="' + i + '"><span>' + esc(r.name) + '</span>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</button></div>';
        }).join('');
        erg._treffer = liste; erg.hidden = false;
      }).catch(function () {
        if (nr !== z.geoNr) return;
        erg.hidden = true; meld.textContent = 'Die Suche geht gerade nicht. Prüfe deine Verbindung und versuche es noch einmal.';
      });
    }, 300);
  }
  function trefferWaehlen(ev) {
    var b = ev.target.closest('[data-treffer]'); if (!b) return;
    var r = $('orte-ergebnisse')._treffer[+b.getAttribute('data-treffer')]; if (!r) return;
    var id = r.id ? 'geo' + r.id : 'o' + Math.round(r.latitude * 1000) + '_' + Math.round(r.longitude * 1000);
    var ort = ortPerId(id);
    if (!ort) {
      ort = { id: id, name: r.name, lat: r.latitude, lon: r.longitude, region: [r.admin1, r.country].filter(Boolean).join(', ') || undefined };
      z.orte.push(ort); orteSpeichern();
    }
    $('orte-suche').value = ''; $('orte-ergebnisse').hidden = true;
    waehleOrt(ort);
  }

  // ---------- Mein Standort ----------
  function standortFragen() { $('standort-frage').hidden = false; $('standort-ja').focus(); }
  function standortHolen() {
    var meld = $('orte-meldung');
    $('standort-frage').hidden = true;
    if (!navigator.geolocation) { meld.textContent = 'Dein Gerät kann den Standort hier nicht nennen. Such stattdessen einen Ort.'; return; }
    meld.textContent = 'Standort wird gesucht …';
    navigator.geolocation.getCurrentPosition(function (pos) {
      z.standort = { id: 'standort', name: 'Mein Standort', lat: Math.round(pos.coords.latitude * 1000) / 1000, lon: Math.round(pos.coords.longitude * 1000) / 1000 };
      meld.textContent = '';
      waehleOrt(z.standort);
    }, function () {
      meld.textContent = 'Dein Standort ist gerade nicht verfügbar. Du kannst stattdessen einen Ort suchen.';
    }, { timeout: 12000, maximumAge: 600000 });
  }

  // ---------- Daten laden ----------
  function holeJson(url, ms) {
    return new Promise(function (resolve, reject) {
      var ctl = window.AbortController ? new AbortController() : null;
      var t = setTimeout(function () { if (ctl) ctl.abort(); reject(new Error('Zeit abgelaufen')); }, ms || 15000);
      fetch(url, ctl ? { signal: ctl.signal } : undefined).then(function (r) {
        if (!r.ok) { var e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
        return r.json();
      }).then(function (j) { clearTimeout(t); resolve(j); }, function (e) { clearTimeout(t); reject(e); });
    });
  }
  function inDeutschland(o) { return o.lat >= 47.2 && o.lat <= 55.1 && o.lon >= 5.8 && o.lon <= 15.1; }
  var FORECAST_FELDER = {
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
    hourly: 'temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,precipitation_probability,precipitation,weather_code,pressure_msl,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,is_day,sunshine_duration',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,daylight_duration,sunshine_duration,uv_index_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant'
  };
  var POLLEN_LUFT = 'european_aqi,pm10,pm2_5,ozone,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen';
  function hatZahl(a) { return Array.isArray(a) && a.some(function (v) { return typeof v === 'number' && isFinite(v); }); }

  function holeMeer(ort) {
    var dauerhaft = ort.id !== 'standort';
    var gemerkt = dauerhaft ? WL.merk('meer-' + ort.id) : null;
    if (gemerkt === false) { ort.meer = false; return Promise.resolve(null); }
    var url = 'https://marine-api.open-meteo.com/v1/marine?latitude=' + ort.lat + '&longitude=' + ort.lon + '&hourly=sea_level_height_msl&timezone=auto&forecast_days=2';
    return holeJson(url).then(function (j) {
      var kueste = !!(j && j.hourly && hatZahl(j.hourly.sea_level_height_msl));
      ort.meer = kueste;
      if (dauerhaft) WL.merk('meer-' + ort.id, kueste);
      return kueste ? j : null;
    }, function (e) {
      if (e && e.status === 400) { ort.meer = false; if (dauerhaft) WL.merk('meer-' + ort.id, false); return null; }   // kein Meer an diesem Ort
      ort.meer = gemerkt === true ? true : false;
      return null;
    });
  }

  function ladeAlles(ort, still) {
    var nr = ++z.ladeNr;
    var container = $('module');
    if (!still || !z.aktuell) {
      kopfStand('Lädt …');
      if (window.Module && typeof Module.skeleton === 'function') Module.skeleton(container);
      else container.innerHTML = '<p class="hinweis">Lädt …</p>';
    }
    var lat = ort.lat, lon = ort.lon;
    var fUrl = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon + '&timezone=auto&models=best_match&forecast_days=8' +
      '&current=' + FORECAST_FELDER.current + '&hourly=' + FORECAST_FELDER.hourly + '&daily=' + FORECAST_FELDER.daily + '&minutely_15=precipitation&forecast_minutely_15=12';
    var lUrl = 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + lat + '&longitude=' + lon + '&timezone=auto&forecast_days=5&current=' + POLLEN_LUFT + '&hourly=' + POLLEN_LUFT;
    var nul = function () { return null; };
    var pForecast = holeJson(fUrl).catch(nul);
    var pLuft = holeJson(lUrl).catch(nul);
    var pWarn = inDeutschland(ort) ? holeJson('https://api.brightsky.dev/alerts?lat=' + lat + '&lon=' + lon).then(function (j) { return Array.isArray(j && j.alerts) ? j.alerts : null; }).catch(nul) : Promise.resolve(null);
    var pRadar = holeJson('https://api.rainviewer.com/public/weather-maps.json').then(function (j) {
      return j && j.radar && j.radar.past ? { host: j.host, frames: j.radar.past } : null;
    }).catch(nul);
    var pMeer = holeMeer(ort);
    Promise.all([pForecast, pLuft, pWarn, pRadar, pMeer]).then(function (r) {
      if (nr !== z.ladeNr) return;   // inzwischen anderer Ort oder neuere Anfrage
      var forecast = r[0];
      if (forecast && forecast.current) {
        var daten = { stand: Date.now(), forecast: forecast, luft: r[1], warnungen: r[2], radar: r[3], meer: r[4] };
        if (ort.id !== 'standort') WL.merk('daten-' + ort.id, daten);
        rendere(daten);
        return;
      }
      var alt = ort.id !== 'standort' ? WL.merk('daten-' + ort.id) : (z.aktuell || null);
      if (alt && alt.forecast && alt.forecast.current) {
        alt.meer = alt.meer || null;
        rendere(alt, true);
      } else if (window.Module && typeof Module.fehler === 'function') {
        kopfStand('Offline');
        Module.fehler(container, 'Keine Verbindung. Sobald du wieder online bist, lade ich die Werte.', function () { ladeAlles(ort); });
      } else {
        kopfStand('Offline');
        container.innerHTML = '<p class="hinweis">Keine Verbindung. Sobald du wieder online bist, lade ich die Werte.</p>';
      }
    });
  }

  function rendere(d, offline) {
    var ort = z.ort;
    var obj = {
      ort: { id: ort.id, name: ort.name, lat: ort.lat, lon: ort.lon, meer: !!ort.meer },
      forecast: d.forecast, luft: d.luft || null, warnungen: d.warnungen || null, radar: d.radar || null, meer: d.meer || null,
      stand: d.stand, offline: offline === undefined ? !!d.offline : !!offline, einheiten: z.einheiten
    };
    var hatteDaten = !!z.aktuell;
    z.aktuell = Object.assign({}, d, { offline: obj.offline });
    z.obj = obj;
    kopfStand(standText(obj));
    offlineHinweis();
    var cur = d.forecast.current || {};
    if (cur.weather_code != null) {
      var neu = WL.himmelKlasse(cur.weather_code, cur.is_day);
      document.body.className = document.body.className.replace(/\bhimmel-\S+/g, '').trim();
      document.body.classList.add(neu);
    }
    var container = $('module');
    if (window.Module && typeof Module.rendern === 'function') {
      Module.rendern(container, obj, { oeffneReiter: zeigeReiter, nochmal: function () { ladeAlles(ort); }, warnungWeg: warnungWeg });
    } else {
      container.innerHTML = '<p class="hinweis">Module fehlen.</p>';
    }
    warnKnopfZeigen();
    z.startMgAusstehend = !!$('start-meteogramm');
    if (z.reiter === 'wetter') startMeteogrammZeigen();
    // Der Kartenreiter wurde ohne Daten geöffnet (Offset 0): mit dem Offset des Orts neu aufbauen
    if (!hatteDaten && (z.reiter === 'karten' || z.reiter === 'radsat') && window.Bausteine) {
      try { Bausteine.karte(z.reiter, z.ort, z.orte, d.forecast.utc_offset_seconds || 0); } catch (e) { }
    }
  }

  // ---------- Kamera-Studio ----------
  var studio = { promise: null, inst: null, offen: false };
  function ladeSkript(src) {
    return new Promise(function (ok, fehl) {
      var s = document.createElement('script'); s.src = src;
      s.onload = function () { ok(); }; s.onerror = function () { fehl(new Error(src)); };
      document.head.appendChild(s);
    });
  }
  function studioLaden() {
    if (studio.promise) return studio.promise;
    var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'lib/ks-studio.css'; document.head.appendChild(css);
    studio.promise = ladeSkript('lib/ks-symbole.js').then(function () { return ladeSkript('lib/ks-engine.js'); }).then(function () { return ladeSkript('lib/ks-studio.js'); })
      .catch(function (e) { studio.promise = null; if (css.parentNode) css.parentNode.removeChild(css); throw e; });
    return studio.promise;
  }
  function offsetText(sek) {
    var s = sek || 0, v = s < 0 ? '-' : '+'; s = Math.abs(s);
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return v + (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }
  function studioWetter() {
    var d = z.aktuell;
    if (!d || !d.forecast || !d.forecast.current) return window.KSEngine && KSEngine.DEMO_WETTER;
    var f = d.forecast, c = f.current, t = f.daily || {};
    function r(v) { return v == null ? v : Math.round(v); }
    return {
      temp: r(c.temperature_2m), gefuehlt: r(c.apparent_temperature), code: c.weather_code, lage: WL.wetterText(c.weather_code, c.is_day),
      ort: { stadt: z.ort.name, land: '', lat: z.ort.lat, lon: z.ort.lon },
      zeit: c.time + offsetText(f.utc_offset_seconds),
      wind: r(c.wind_speed_10m), windRichtung: WL.windRichtung(c.wind_direction_10m), boeen: r(c.wind_gusts_10m),
      regen: t.precipitation_sum && t.precipitation_sum[0], regenRisiko: t.precipitation_probability_max && t.precipitation_probability_max[0],
      feuchte: c.relative_humidity_2m, uv: t.uv_index_max && t.uv_index_max[0], druck: r(c.pressure_msl),
      sonnenaufgang: t.sunrise ? WL.hhmm(t.sunrise[0]) : undefined, sonnenuntergang: t.sunset ? WL.hhmm(t.sunset[0]) : undefined,
      modell: 'Beste Mischung'
    };
  }
  function studioFehler(text) {
    var w = $('studio-wurzel');
    w.innerHTML = '<div class="hinweis"><p>' + esc(text) + '</p><button type="button" class="knopf-leise" id="studio-nochmal">Erneut versuchen</button></div>';
    $('studio-nochmal').addEventListener('click', studioStarten);
  }
  function studioStarten() {
    var wurzel = $('studio-wurzel');
    wurzel.innerHTML = '<p class="hinweis">Lädt …</p>';
    Promise.all([
      studioLaden(),
      // Schutzregel: kein Foto-GPS an fremde Server; „Wetter von damals“ bleibt aus, bis Stephan es im Konfigurator wieder einschaltet
      fetch('kamera-studio.json').then(function (r) { return r.json(); }).then(function (j) { return j.funktionen || {}; }).then(function (f) { f = Object.assign({}, f); f.wetterZeitpunkt = false; return f; }).catch(function () { return {}; })
    ]).then(function (res) {
      if (!studio.offen) return;
      wurzel.innerHTML = '';
      studio.inst = KSStudio.mount(wurzel, {
        variante: 'buehne', appName: 'Wetterlage', funktionen: res[1], wetter: studioWetter(), beispielFoto: 'lib/beispiel-foto.jpg', theme: 'auto', speicher: 'wetterlage',
        start: {
          format: 'original', overlay: { stil: 'glas', position: 'oben', farbe: 'auto' }, rahmen: 'keiner',
          daten: { temperatur: true, symbol: true, lage: false, datum: true, uhrzeit: false, wind: true, boeen: false, regen: true, regenRisiko: false, sonne: true, uv: false, feuchte: false, druck: false, ort: 'stadt', logo: true },
          ausgabe: { format: 'png', groesse: 1080 }
        }
      });
    }).catch(function () {
      if (studio.offen) studioFehler('Das Wetterfoto-Studio lässt sich gerade nicht laden. Prüfe deine Verbindung und versuche es noch einmal.');
    });
  }
  function studioOeffnen() {
    studio.offen = true;
    blattOeffnen('studio', 'studio-titel');
    studioStarten();
  }
  function studioSchliessen() {
    if (!studio.offen) return;
    studio.offen = false;
    try { if (studio.inst) studio.inst.zerstoere(); } catch (e) { }
    studio.inst = null; $('studio-wurzel').innerHTML = '';
    z.blattOeffner = $('knopf-teilen');
    blattSchliessen('studio');
  }

  // ---------- Schriftgröße (Dynamic Type) ----------
  // iOS: Die Tokens rechnen mit 16 px; Apples Body ist 17 px. Darum wird nur das Verhältnis (Größe der Nutzerwahl / 17) auf 16 px angewendet.
  function schriftMessen() {
    var h = document.documentElement;
    var ios = !!(window.CSS && CSS.supports && CSS.supports('-webkit-touch-callout', 'none'));
    var f = 1;
    if (ios) {
      var sonde = $('schrift-sonde');
      if (!sonde) {
        sonde = document.createElement('div'); sonde.id = 'schrift-sonde'; sonde.setAttribute('aria-hidden', 'true');
        sonde.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;font:-apple-system-body';
        sonde.textContent = 'M'; document.body.appendChild(sonde);
      }
      var sp = parseFloat(getComputedStyle(sonde).fontSize);
      if (sp > 0) { f = sp / 17; h.style.fontSize = (16 * f) + 'px'; }
    } else {
      f = (parseFloat(getComputedStyle(h).fontSize) || 16) / 16;
    }
    if (f >= 1.4) h.setAttribute('data-schrift', '150');
    else if (f >= 1.2) h.setAttribute('data-schrift', '130');
    else h.removeAttribute('data-schrift');
  }

  // ---------- Start ----------
  function start() {
    ikonenSetzen();
    schriftMessen();
    window.addEventListener('resize', schriftMessen);
    document.addEventListener('visibilitychange', schriftMessen);
    orteLaden();
    // Dauer-Vollbild ab Werk aus (der Baustein hätte es an): nur beim ersten Start setzen, danach gilt die Wahl unter „Mehr“
    try { if (window.Bausteine && localStorage.getItem('wetterlage-vollbild-immer') === null) Bausteine.immerVollbildSetzen(false); } catch (e) { }
    kopfHoeheMessen();
    kopfOrt(); orteZeichnen(); mehrZeichnen();

    // Tabs
    $('tabbar').addEventListener('click', function (ev) { var b = ev.target.closest('[data-reiter]'); if (b) zeigeReiter(b.getAttribute('data-reiter')); });
    $('tabbar').addEventListener('keydown', tabTasten);
    Array.prototype.forEach.call($('tabbar').querySelectorAll('[data-reiter]'), function (b) { b.setAttribute('aria-label', b.textContent.trim()); });

    // Kopfzeile
    $('knopf-orte').addEventListener('click', function () { orteOeffnen(false); });
    $('knopf-suche').addEventListener('click', function () { orteOeffnen(true); });
    $('knopf-teilen').addEventListener('click', studioOeffnen);
    $('knopf-warnung').addEventListener('click', warnungZurueck);
    $('mehr-suchen').addEventListener('click', function () { orteOeffnen(true); });

    // Orte-Blatt
    $('orte-fertig').addEventListener('click', function () { blattSchliessen('orte'); });
    $('orte-suche').addEventListener('input', suche);
    $('orte-suche').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); suche(); } });
    $('orte-ergebnisse').addEventListener('click', trefferWaehlen);
    $('orte-liste').addEventListener('click', listenKlick);
    $('mehr-orte').addEventListener('click', listenKlick);
    $('orte-standort').addEventListener('click', standortFragen);
    $('standort-ja').addEventListener('click', standortHolen);
    $('studio-fertig').addEventListener('click', studioSchliessen);

    // Esc schließt das Orte-Blatt; im Studio gehört Esc dem Studio (Blatt, Zuschneiden), geschlossen wird nur mit „Fertig“
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape' || studio.offen) return;
      if (!$('orte-blatt').hidden) { ev.preventDefault(); blattSchliessen('orte'); }
    });

    // Mehr: Darstellung
    $('seg-temp').addEventListener('click', einheitWahl('temp'));
    $('seg-wind').addEventListener('click', einheitWahl('wind'));
    $('schalter-vollbild').addEventListener('click', function () {
      var an = $('schalter-vollbild').getAttribute('aria-checked') !== 'true';
      try { Bausteine.immerVollbildSetzen(an); } catch (e) { }
      mehrZeichnen();
    });

    // Rückweg aus dem Vollbild (wenn „immer im Vollbild“ an ist)
    if (window.Bausteine) {
      Bausteine.beiVollbildZu = function () {
        if (z.abbauend) return;
        // Zurück zum vorherigen Reiter. Ist der selbst ein Baustein-Reiter und „immer im Vollbild“ an, würde er sich wieder als Blatt öffnen
        // und „Fertig“ führte zurück (Ping-Pong): dann gilt der letzte Reiter ohne Baustein (Wetter oder Mehr)
        var ziel = z.vorher || 'wetter';
        var immer = false; try { immer = Bausteine.immerVollbild(); } catch (e) { }
        if (BAUSTEIN_REITER.indexOf(ziel) >= 0 && immer) ziel = z.letzterFester || 'wetter';
        zeigeReiter(ziel);
      };
    }

    // Netz und Sichtbarkeit
    window.addEventListener('online', function () { offlineHinweis(); if (z.ort) ladeAlles(z.ort); });
    window.addEventListener('offline', function () { if (z.aktuell) { z.aktuell.offline = true; kopfStand(standText(z.aktuell)); } offlineHinweis(); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && z.ort && (!z.aktuell || Date.now() - z.aktuell.stand > AUFFRISCHEN_MS)) ladeAlles(z.ort, true);
    });

    // Zeitgeber: alle 15 Minuten neu laden (nur bei sichtbarer Seite und Netz); das Neuladen zeichnet auch die Regenkachel neu
    setInterval(function () {
      if (document.visibilityState === 'visible' && navigator.onLine !== false && z.ort) ladeAlles(z.ort, true);
    }, AUFFRISCHEN_MS);

    zeigeReiter('wetter');
    ladeAlles(z.ort);

    try { if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(function () { }); } catch (e) { }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
