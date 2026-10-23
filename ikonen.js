/* ikonen.js – Bedien-Symbole (Tabs, Menü, Teilen, Suche …), erzeugt vom Design-Konfigurator am 23.10.2026
   Satz: Linien, Strich 1.5 px, Farbe folgt currentColor. Eigene Zeichnung, frei im Projekt verwendbar.
   Aufruf: knopf.innerHTML = Ikon('search');  Namen: sun, cloud, cloudsun, rain, storm, fog, moon, wind, map, pin, calendar, sliders, search, chevron, chevdown, sunrise, sunset, check, x, chart, radar, more, share, camera, image, tropfen */
(function () {
  var STRICH = 1.5;
  var IKONEN = {
    "sun": "<circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41\"/>",
    "cloud": "<path d=\"M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z\"/>",
    "cloudsun": "<path d=\"M12 2v2M4.93 4.93l1.41 1.41M20 12h2M19.07 4.93l-1.41 1.41M15.95 12.5a4 4 0 1 0-5.9 4.5\"/><path d=\"M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z\"/>",
    "rain": "<path d=\"M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2\"/><path d=\"M16 14v6M8 14v6M12 16v6\"/>",
    "storm": "<path d=\"M6 16.3A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 3 7.9\"/><path d=\"m13 12-3 5h4l-3 5\"/>",
    "fog": "<path d=\"M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2\"/><path d=\"M16 17H7M17 21H9\"/>",
    "moon": "<path d=\"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z\"/>",
    "wind": "<path d=\"M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2M9.6 4.6A2 2 0 1 1 11 8H2M12.6 19.4A2 2 0 1 0 14 16H2\"/>",
    "map": "<path d=\"M14.1 6.3 9.9 4.2a1 1 0 0 0-.9 0L4.4 6.5A1 1 0 0 0 4 7.4v11.9a1 1 0 0 0 1.4.9l4.5-2.3 4.2 2.1a1 1 0 0 0 .9 0l4.6-2.3a1 1 0 0 0 .4-.9V4.9a1 1 0 0 0-1.4-.9l-4.5 2.3Z\"/><path d=\"M15 5.8v14M9 4v14\"/>",
    "pin": "<path d=\"M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z\"/><circle cx=\"12\" cy=\"10\" r=\"3\"/>",
    "calendar": "<rect x=\"3\" y=\"4\" width=\"18\" height=\"18\" rx=\"2\"/><path d=\"M16 2v4M8 2v4M3 10h18\"/>",
    "sliders": "<path d=\"M21 4h-4M13 4H3M21 12h-9M8 12H3M21 20h-6M11 20H3M17 2v4M8 10v4M15 18v4\"/>",
    "search": "<circle cx=\"11\" cy=\"11\" r=\"8\"/><path d=\"m21 21-4.3-4.3\"/>",
    "chevron": "<path d=\"m9 18 6-6-6-6\"/>",
    "chevdown": "<path d=\"m6 9 6 6 6-6\"/>",
    "sunrise": "<path d=\"M12 2v6M4.2 10.2l1.4 1.4M2 18h2M20 18h2M18.4 11.6l1.4-1.4M22 22H2\"/><path d=\"M16 18a4 4 0 0 0-8 0\"/><path d=\"m8 6 4-4 4 4\"/>",
    "sunset": "<path d=\"M12 10V2M4.2 10.2l1.4 1.4M2 18h2M20 18h2M18.4 11.6l1.4-1.4M22 22H2\"/><path d=\"M16 18a4 4 0 0 0-8 0\"/><path d=\"m16 6-4 4-4-4\"/>",
    "check": "<path d=\"M20 6 9 17l-5-5\"/>",
    "x": "<path d=\"M18 6 6 18M6 6l12 12\"/>",
    "chart": "<path d=\"M3 3v18h18\"/><path d=\"m7 15 4-4 3 3 5-6\"/>",
    "radar": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><circle cx=\"12\" cy=\"12\" r=\"5\"/><path d=\"m12 12 6.4-6.4\"/>",
    "more": "<circle cx=\"5\" cy=\"12\" r=\"1\"/><circle cx=\"12\" cy=\"12\" r=\"1\"/><circle cx=\"19\" cy=\"12\" r=\"1\"/>",
    "share": "<path d=\"M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8\"/><path d=\"m16 6-4-4-4 4\"/><path d=\"M12 2v13\"/>",
    "camera": "<path d=\"M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z\"/><circle cx=\"12\" cy=\"13\" r=\"3\"/>",
    "image": "<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\"/><circle cx=\"9\" cy=\"9\" r=\"2\"/><path d=\"m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21\"/>",
    "tropfen": "<path d=\"M12 2.7s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11Z\"/>"
  };
  window.IKONEN_NAMEN = Object.keys(IKONEN);
  window.Ikon = function (name, klasse) {
    return '<svg class="ikon' + (klasse ? ' ' + klasse : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + STRICH + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IKONEN[name] || '') + '</svg>';
  };
})();
