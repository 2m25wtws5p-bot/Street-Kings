# Comic-Chat: Umsetzung und lokale QA

Stand: 7. Oktober 2026. Die Umsetzung und die unten beschriebenen lokalen Prüfungen sind abgeschlossen. Dieser Bericht bestätigt keinen neuen Remote-Deploy und keinen physischen iPhone-Test.

## 16 umgesetzte Punkte

1. **Punkteübersicht:** farbige, nachvollziehbare Aufschlüsselung von Grundpunkten, Sonderkarten, Multiplikatoren und Takeover.
2. **Raumcode kopieren:** ein Klick kopiert nur den Code; der Einladungslink hat einen eigenen Knopf. Erfolgsanzeige und Clipboard-Fallback sind enthalten.
3. **Chat:** Text bis 140 Unicode-Zeichen, acht Schnell-Emojis, Verlauf mit 30 Nachrichten und kurzlebige Sprechblasen am Namen. Zuschauer lesen nur; Chatfehler blockieren keine Spielaktion.
4. **Namen:** einheitlich maximal 24 Zeichen, lokal und online, mit serverseitiger Prüfung.
5. **Host-Krone:** gefülltes goldenes Symbol in Lobby und Spielerliste.
6. **Weitergabe-Status:** ausdrücklich „Bereit“ beziehungsweise „Wartet“ je Spieler, ohne fremde Karten offenzulegen.
7. **Comic-Porträts:** passende Spielerbilder und lesbare Identitäten im gemeinsamen Comic-Stil.
8. **Mobiles Layout:** feste äußere Spielfläche ohne Seiten-Overscroll; längere Menüs, Setup und Ergebnisse scrollen intern.
9. **Regeln/Akte:** zusammenhängende Gestaltung und verständliche Erklärungen mit passenden Beispielen.
10. **PDF-Regeln:** paraphrasierte Regeln und die freigegebenen Mechanik-Korrekturen in beiden Engines; Details siehe unten.
11. **Karten am PC:** größere, responsive Karten; volle Stiche und eigene Hand bleiben auch auf kurzen Desktop-Ansichten getrennt.
12. **Zugerinnerung:** Polizei-Sirene und visueller Hinweis nach zehn Sekunden ohne Zug; Wiederholung alle zehn Sekunden nur während des eigenen sichtbaren Zuges.
13. **Mobiler Ton:** Freischaltung durch echte Nutzerinteraktion; pausierte Audio-Kontexte werden beim Aktivieren fortgesetzt.
14. **Sonderkarten:** sichtbare Effektleiste und klarer Aktivstatus, ohne automatisches Anheben der eigenen Karten.
15. **Graffiti:** dezente, handgezeichnet wirkende Street-Kings-Schriftzüge im Hintergrund, ohne Karten und Hinweise zu überdecken.
16. **Tests und Korrekturen:** zusätzliche Regressionstests, konsistente lokale/Server-Regeln, Chat-Sitzschutz sowie korrigierte mobile und Desktop-Abstände.

## Freigegebene Mechanik-Korrekturen zur PDF

Frontend und Backend verwenden dieselben Regeln:

- Weitergabe: bei 3/4/5/6 Spielern jeweils **4/3/3/2 Karten**. Bei 3 und 5 Spielern links/rechts; bei 4 und 6 links/rechts/gegenüber. Keine Runde ohne Weitergabe.
- Fixer (blau 11) neutralisiert sämtliche roten und grünen Heat-Punkte.
- Kingpin (rot 11) zählt selbst 0 und verdoppelt die übrigen roten Punkte, gedeckelt auf 15. Informant (grün 11) bringt 5, Patin (grün 12) 10 Punkte.
- Schmierer (gelb 11) reduziert nur die aktuelle Runde um bis zu 5, niemals unter 0. Die optionale PDF-Variante zur Senkung alter Gesamtpunkte ist nicht aktiviert.
- Takeover erfordert alle 14 roten Karten plus Informant und/oder Patin: 20/25/30 Punkte. Normale Sonderkarteneffekte sind dabei inaktiv.
- Endspiel-Ausnahme: Würde ein normaler Takeover das Spiel beenden und ein anderer Spieler zu den Gewinnern mit niedrigstem Gesamtstand gehören, erhalten die anderen in dieser Runde 0. Der Takeover-Wert wird stattdessen vom bisherigen Stand des Auslösers abgezogen, mindestens bis 0; das Spiel geht weiter.

Die Regeltexte sind eine eigene deutsche Zusammenfassung, keine vollständige Wiedergabe der PDF.

## Prüfergebnisse

| Prüfung | Ergebnis |
| --- | --- |
| Frontend-Tests | 102 bestanden; zusätzliche Sound-Prüfungen bestanden |
| Backend-Tests | 115 bestanden, einschließlich 1.067 Unterprüfungen |
| Timing-Integration | 5 Tests in der Zero-Delay-Umgebung ausgelassen; Produktionsfristen separat deterministisch mit kontrollierter Uhr geprüft |
| Produktions-Build | lokal im strengen Modus `CI=true` bestanden |
| Browser-Verhalten | 21 erfolgreiche Prüfungen |
| Bild-/Layoutprüfung | 45 Validierungsaufnahmen, 27 saubere Geometrieprüfungen |
| Browserfehler | 0 ungefangene Fehler |

Getestete Ansichten: **320×568, 393×852, 640×950, 768×1024, 1024×600, 1366×768 und 1920×1080**.

Die eigene Hand blieb bei Auswahl, Warten und vollem Stich positions- und größenstabil; gemessene Abweichungen lagen innerhalb der Rundungstoleranz von 0,1 px. In den 27 finalen Geometrieprüfungen wurden weder horizontales Überlaufen noch unerlaubte Karten-/Aktionsüberschneidungen gefunden.

Die Browserprüfungen deckten unter anderem getrennte menschliche Sitzungen, Raumbeitritt, Start, Weitergabe, Kartenspiel, vollständige Bot-Runde, Punkteansicht und erreichbaren „Weiter“-Knopf ab. Zusätzlich geprüft: Lobby-/Tisch-Chat, Emoji, Ablauf der Sprechblasen, sichere Textausgabe, 24-Zeichen-Namen, beide Kopierfunktionen samt abgelehntem Clipboard-Zugriff, Zuschauerrechte, Neuladen der Sitzung und Spielaktionen während eines fehlschlagenden Chatversands. Lokales Setup mit sechs Spielern und Weitergabe mit drei/vier Spielern wurden auf kleinem Mobilformat geprüft.

## Lokale Reproduktion und Artefakte

Alle mutierenden Browser-/API-Prüfungen liefen ausschließlich gegen die lokale Testumgebung: Frontend `127.0.0.1:8765`, API `127.0.0.1:8871`, MongoDB `127.0.0.1:28217`, Datenbank **street_kings_comic_qa**. Für schnelle Integrationsrunden waren `BOT_PLAY_DELAY=0` und `TRICK_HOLD_SECONDS=0` gesetzt. Die Produktionswerte sind davon unberührt.

Aus dem Repository-Verzeichnis, mit installierten Abhängigkeiten:

```powershell
node --test frontend/tests/*.test.mjs
node frontend/scripts/test-street-sounds.cjs
$env:CI = 'true'
npm --prefix frontend run build
$env:PYTHONPATH = 'backend'
$env:REACT_APP_BACKEND_URL = 'http://127.0.0.1:8871'
$env:MONGO_URL = 'mongodb://127.0.0.1:28217'
$env:DB_NAME = 'street_kings_comic_qa'
$env:BOT_PLAY_DELAY = '0'
$env:TRICK_HOLD_SECONDS = '0'
python -m pytest backend/tests -q -n0 --basetemp=.qa/pytest-comic-final
```

Der dokumentierte Backend-Lauf nutzte denselben Aufruf mit `../stability-runtime/Scripts/python.exe` anstelle von `python`. Für erneute Läufe einen eigenen, noch nicht verwendeten `--basetemp` wählen.

Die lokalen Browserprüfungen benötigen das gebündelte Playwright/Chromium und eine laufende isolierte Testumgebung:

```powershell
node .qa/browser-chat.cjs
node .qa/browser-layout.cjs
```

Die lokale Build-Konfiguration `.qa/build-config.cjs` ergänzte vorhandene Workspace-Abhängigkeiten. Die Browserprogramme und folgende Nachweise liegen im ignorierten Verzeichnis `.qa/` und werden nicht veröffentlicht:

- `.qa/browser-chat-report.json`: Chat-/Sitzungs- und Spielflussprüfungen.
- `.qa/browser-layout-report.json`: zusammengeführte finale Layout-, Verhaltens- und Geometriematrix.
- `.qa/browser-layout-online-report.json`: letzter Online-Nachlauf gegen den finalen CSS-Build.
- `.qa/screenshots/`: zugehörige Validierungsaufnahmen.

## Verbleibende Grenze

Audio-Freischaltung wurde in Chromium mit Touch-Emulation und einem absichtlich pausierten Audio-Kontext geprüft. **Ein echtes iPhone mit Safari und physischer Tonausgabe wurde nicht geprüft.** Browser benötigen weiterhin die erste bewusste Berührung beziehungsweise einen Klick zum Freischalten des Tons; Stummschaltung bleibt wirksam. Eine kurze echte iPhone-Prüfung vor einer Aussage über alle Mobilgeräte ist sinnvoll.

Keine Produktionsdaten wurden verändert und keine Remote-Schreibaktionen durch diese QA ausgeführt.
