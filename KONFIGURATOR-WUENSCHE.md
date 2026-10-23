# Wünsche an den Design-Konfigurator (Wetterlage, Stand 23.10.2026)

Diese Punkte lassen sich nicht in der App beheben, weil sie in den fertigen Bausteinen (Meteogramm, Karte) oder in den Vorgaben des Konfigurators stecken. Die App-Dateien dürfen diese Bausteine nicht ändern. Nummern in Klammern verweisen auf `FEHLERLISTE-2026-10-23.md`.

| Nr. | Problem | Wunsch |
|---|---|---|
| 4 | Im Vollbild von Graphs, Karten und Rad/Sat steht nirgends, für welchen Ort das Diagramm oder die Karte gilt. | `bausteine-einbau.js` soll den Ortsnamen als Titel des Vollbilds mitgeben (z. B. „Graphs · Mannheim“). |
| 13 | Im Meteogramm steht links oben manchmal das Datum von gestern („Do 22.10.“), obwohl „Jetzt“ in der Mitte heute zeigt. | Das Datums-Etikett soll sich nach dem Zentrieren auf „Jetzt“ neu berechnen oder am Jetzt-Strich ausrichten. |
| 15 | Stellt man unter „Mehr“ auf °F oder mph um, zeigen Graphs und die Meteogramm-Kachel weiter °C und km/h. | Die Bausteine sollen die gewählten Einheiten übernehmen (Einstellung über `bausteine-einbau.js`). |
| 34 | Das Regenradar unter Rad/Sat ist etwa 50 Minuten alt, obwohl ein neueres Bild da wäre. | Den festen Verzug von 50 Minuten nur für den Satelliten nehmen, beim Radar das neueste Bild zeigen. |
| 35 | Karten und Rad/Sat zeigen rechts eine Symbolspalte ohne Beschriftung, die Vorschau zeigt beschriftete Knöpfe (Temperatur, Niederschlag …). Auch das Diagramm in Graphs sieht anders aus als die Vorschau. | Entweder die Vorschau an die Bausteine anpassen oder die Bausteine wie die Vorschau gestalten – eines von beiden soll gelten. |
| 36 | Im Diagramm verdecken die Werte-Marken links („14“, „79“) die Zahlen der Achse („12“, „100“). | Marken und Achsenzahlen so setzen, dass sie sich nicht überlappen. |
| 17 | Das Kamera-Studio schreibt Wind immer in km/h und Temperatur in °C auf das Foto, auch wenn unter „Mehr“ mph oder °F gewählt ist (fest im Studio-Baustein). | Das Kamera-Studio soll eine Einheiten-Einstellung bekommen, die die App beim Öffnen übergibt. |
| 40 | Wechselt man sehr schnell nach „Fertig“ die Karte, erscheint selten eine Fehlermeldung in der Konsole (unsichtbar für Nutzer). | Im Karten-Baustein beim Abbauen den letzten Zeitgeber stoppen (`clearTimeout`). |
| – | Ab Werk ist „Meteogramm und Karten immer im Vollbild“ eingeschaltet. Dann verschwinden Tab-Leiste und Kopfleiste, man kommt nur über „Fertig“ heraus. Die App schaltet es beim ersten Start selbst aus. | Vorgabe im Konfigurator (und in `bausteine-einbau.js`, DESIGN.md) auf AUS stellen. |
| – | DESIGN.md und design.json nennen die Meteogramm-Kachel „klein“ (halbe Breite), die Vorschau zeigt sie in voller Breite. Halb breit ist das Diagramm unbrauchbar; die App zeigt sie jetzt voll breit. | Modulgröße Meteogramm auf „mittel“ (volle Breite) stellen, damit DESIGN.md, design.json und die App übereinstimmen. |
| – | Die kleine Meteogramm-Kachel zeigt auch in voller Breite nur etwa 19 statt 48 Stunden, weil jede Stunde gleich viel Platz bekommt wie im großen Diagramm. | Für die Kachel auf der Startseite einen kleineren Stundenabstand einstellbar machen, damit 48 Stunden hineinpassen. |
