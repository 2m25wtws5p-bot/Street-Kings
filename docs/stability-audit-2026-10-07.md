# Street Kings – Stabilitätsprüfung vom 7. Oktober 2026

## Umfang und Ergebnis

Ausgangspunkt: Commit `3a66b1baffd14437ecdbeaeccb520941f49beece`.
Geprüft wurden React-Oberfläche, lokale JavaScript-Engine, Python-Engine,
FastAPI, MongoDB-Persistenz, Multiplayer-Sitzungen, Bot-Abläufe, Tests und
Veröffentlichungskonfiguration. Spielmechanik und vorhandenes Kartendesign
wurden nicht umgebaut. Hilfetexte wurden an das tatsächliche Verhalten angepasst.

Die abschließenden zwei lokalen Backend-Gesamtläufe bestanden mit jeweils
**103 Tests**. Die abschließenden zwei Frontend-Gesamtläufe bestanden mit jeweils
**47 Tests**, zusätzlich die Sound-Prüfung. Es bleiben in den geprüften Abläufen
keine bekannten reproduzierbaren hohen oder kritischen Fehler. Dies ist keine
Garantie für Fehlerfreiheit, vollständige Testabdeckung oder eine Sicherheitszertifizierung.

## Gefundene Fehler, Ursachen und Korrekturen

| Priorität | Fehler / Ursache | Korrektur und betroffene Bereiche |
|---|---|---|
| Hoch | Spieler-/Hostplatz konnte nach kurzer Abwesenheit allein durch Kenntnis des öffentlichen Namens übernommen werden. | Wiederverbindung nur mit ursprünglichem Spieler-Token; Token bleibt gültig. `server.py`, Wiederverbindungsintegration, Online-Hilfe. |
| Hoch | Private Karten eines alten Tokens konnten durch verzögerte Antworten oder bereits geladenen Zustand nach einem Sitzungswechsel sichtbar bleiben. | Antworten und sichtbarer Zustand an die aktuelle Raum-/Token-Identität gebunden; alte Abfragen beim Verlassen abgebrochen. `useOnlineGame.js`. |
| Hoch | Raumcode-Kollision konnte einen vorhandenen Raum überschreiben. | Atomare Neuanlage mit eindeutiger ID und begrenzten Wiederholungen. `server.py`. |
| Hoch | Veraltete Raumkopien konnten neuere Spielzüge überschreiben oder gelöschte Räume erneut anlegen. | Versionsvergleich beim Speichern, kein Upsert; Konflikte verständlich als 409, fehlende Räume als 404. Alte Räume ohne Versionsfeld bleiben lesbar. `server.py`. |
| Hoch | Lokale Mehrfachaktionen, falsche Phasen, doppelte/fremde Tauschkarten und illegale Karten konnten den Spielzustand verändern. | Phasen-, Besitzer-, Mengen- und Bedienpflichtprüfung vor jeder Änderung. `useGame.js`. |
| Hoch | Beschädigte gespeicherte Statistik bzw. Namen wie `__proto__` führten zu ungültigen Zählern oder Abstürzen. | Daten normalisiert, ungültige Einträge verworfen, sichere Namenszuordnung; verweigerter Browserspeicher blockiert das Spiel nicht. `storage.js`, `StatsDialog.jsx`. |
| Mittel | Fehlende/ungültige Serverfelder, Tauschlisten, Zuschauerlisten, Takeover-Sitze und unbekannte Sonderkartenschlüssel konnten Komponenten abstürzen lassen. | Antwortprüfung vor dem Rendern, verständlicher Fehler und erneute Verbindung statt Weitergabe kaputter Daten. `api.js`. |
| Mittel | Online-Mehrfachklicks erzeugten parallele Spielaktionen; fehlgeschlagene Aktionen wurden teilweise verschluckt. | Eine Spielaktion pro Sitzung gleichzeitig, sichtbare und schließbare Fehler; Rückblick-Präsenz unabhängig davon geordnet und zusammengefasst. `useOnlineGame.js`, `OnlineTable.jsx`, `OnlineFlow.jsx`. |
| Mittel | Kurzer Abfragefehler entfernte die Spielansicht und damit die aktuelle Kartenauswahl. | Letzten gültigen Tisch erhalten und automatisch erneut verbinden. `OnlineFlow.jsx`. |
| Mittel | Entfernen eines mittleren Bots hinterließ Sitzlücken und später doppelte Sitze. Bereits gespeicherte alte Lobbys wurden dadurch unbenutzbar. | Lobbyplätze kompakt neu nummeriert; alte Lobby-Sitzlücken beim Laden sicher korrigiert. Keine Umnummerierung laufender Spiele. `server.py`. |
| Mittel | Wiederholung der Endaufzeichnung konnte dieselbe Partie mehrfach speichern. | Eindeutige ID pro Partie und atomare Ergebnis-Anlage; eine Revanche bekommt eine andere Partie-ID. `server.py`. |
| Mittel | Veraltete Avatare konnten Bot-Erstellung abstürzen lassen; ungültige Ergebnisfelder konnten die Historie verunreinigen. | Neue Eingaben validiert, defekte alte Avatarfelder abgefangen. Neue Namensgrenzen gelten nur beim Erstellen, nicht rückwirkend beim Lesen alter Ergebnisse. `server.py`. |
| Mittel | Veralteter Einladungscode blieb nach Zurück-Navigation im Zustand bzw. in der Adresse hängen. | Einladungszustand und URL beim Verlassen gelöscht; neue Raum-Erstellung wieder möglich. `App.js`, `OnlineFlow.jsx`. |
| Mittel | Wiederaufnahme bei vorübergehend unerreichbarem Server verwarf den gespeicherten Zugang; manche asynchronen Antworten setzten Zustand nach Verlassen. | Token bei vorübergehenden Fehlern behalten, abgebrochene/alte Antworten ignorieren. `OnlineFlow.jsx`, `StatsDialog.jsx`. |
| Niedrig | Gespielte Aktionen aktualisierten die Präsenz nicht zuverlässig; unbenutzte Raumsperren blieben im Speicher; Historienabfragen waren unbegrenzt. | Präsenz aktualisiert, unbenutzte Sperren freigegeben, Abfragegrenze 1–100. `server.py`. |
| Niedrig | Ungültige Spielerzahl/Deckgröße/Rundenindex sowie leere Stich-/Bot-Eingaben hatten zufällige Fehler oder Kartenverlust zur Folge. | Explizite Grenzprüfungen in beiden Engines; gültige Regeln und Bot-Strategie unverändert. `witches_engine.py`, `engine.js`. |
| Niedrig | Zwischenablage-Verweigerung hatte kein brauchbares Feedback; Wiederverbindungs- und Kingpin-Hilfe waren widersprüchlich. | Kopierfehler erklärt, Raumcode als Alternative; Hilfe beschreibt gespeicherten Zugang, rote-Karten-Verdopplung und tatsächliche Tauschrunden. Komponenten und `constants.js`. |
| Test / Veröffentlichung | Alte Tests verlangten unsichere Namensübernahme oder verglichen globale Zähler, während andere Tests ebenfalls Partien speicherten. Pages-Standardadresse zeigte auf das alte Railway-Backend. | Tests prüfen sichere Wiederaufnahme und eigene Ergebnis-IDs; parallele CI bleibt aktiviert. Pages-Standardadresse ist der vorhandene Render-Spielserver. TestClient-Abhängigkeit nur für CI ergänzt. |

## Ergänzte automatisierte Prüfungen

Neu sind **86 eigenständige Tests**: 52 Backend-Tests und 34 Frontend-Tests.
Bestehende Tests für Wiederverbindung, Kartentausch und Ergebnis-Speicherung
wurden an sichere Abläufe und parallele Ausführung angepasst, nicht entfernt.

- `backend/tests/test_engine_stability.py`: 10 Tests für Kartenerhaltung, Grenzwerte,
  vollständige Spiele und tatsächlich ausgeführte Python-/JavaScript-Parität.
- `backend/tests/test_server_stability.py`: 38 Tests plus 72 Unterprüfungen für
  Zugriffsrechte, alte Daten, Konflikte, Eingabevalidierung, Kollisionsbehandlung,
  Ressourcenfreigabe und Ergebnis-Idempotenz. Fünf Tests verwenden echte MongoDB.
- `backend/tests/test_game_lifecycle.py`: vier Fälle mit drei bis sechs Spielern;
  jeweils zwei vollständige Online-Partien und eine Revanche. Prüft private
  Ansichten, legalen Spielablauf, Stichgewinner, Wertung und genau eine Aufzeichnung
  pro Partie anhand eigener eindeutiger Namen/IDs.
- `frontend/tests/engine-stability.test.mjs`: neun Tests; unter anderem 160 gesetzte
  Zufallsrunden, 32 vollständige Bot-Partien und 448 Wertungskombinationen.
- `frontend/tests/stability.test.mjs`: 25 Tests für defekte Speicherung, ungewöhnliche
  Namen, beschädigte Antworten, lokale Mehrfachaktionen, Sitzungsrennen,
  Abbruch, Antwortreihenfolge, Rückblick-Präsenz und Navigation. Navigation wird
  auf Callback-Ebene getestet; dies ersetzt keinen automatisierten Browser-Test.

Zusätzlich wurden 1.000 Python-Bot-Runden mit 60.000 legalen Zügen ausgeführt.
Bei gültigen Spielzuständen ergab sich dabei kein Wertungs-/Stichgewinnerfehler.
Das prüft Konsistenz der vorhandenen Regeln, nicht erneut deren Übereinstimmung
mit einer externen Original-Witches-Anleitung.

## Testdurchläufe und tatsächliche Umgebung

Sieben lokale Backend-Gesamtläufe während der Korrekturen:

| Lauf | Ergebnis | Einordnung |
|---|---|---|
| 1 | 86/87 bestanden | Alter Test erwartete die unsichere Namensübernahme. |
| 2 | 96/96 bestanden | Sichere Wiederaufnahme und neue Randfälle. |
| 3 | 96/96 bestanden | Wiederholte Gesamtregression. |
| 4 | 103/103 bestanden | Vollständige Partien und alte Lobby-Daten ergänzt. |
| 5 | 102/103 bestanden | Neuer Testname war länger als die bestehende 16-Zeichen-Raumgrenze; Testfixture korrigiert. |
| 6 | 103/103 bestanden | Gesamtlauf nach dieser Testkorrektur. |
| 7 | 103/103 bestanden | Abschließende Gesamtregression nach Browser- und Neustartprüfung. |

Gezielte neue Fehlerprüfungen schlugen vor ihren jeweiligen Korrekturen fehl und
bestanden danach; zusätzlich unabhängige Diff-Nachprüfung. Frontend-Suiten wurden
mehrfach vollständig ausgeführt, die abschließenden zwei Läufe jeweils 47/47 grün.

Tatsächlich lokal: Windows, Python 3.12.14, Node 24.19.0, FastAPI 0.110.1,
Motor 3.3.1, PyMongo 4.6.3, echte isolierte MongoDB 7.0.16 auf Loopback.
Kein Zugriff auf Produktions-Daten für diese Tests. Temporäre Integrationstests
verwenden Verzögerung 0; separate Timing-Tests prüfen die Produktionsfristen.
Die Browser-Zugprüfung nutzte auch 0,95 Sekunden Bot-Verzögerung und 2 Sekunden Stichhalt.

Lokales pytest lief mit dem ausdrücklich unterstützten `-n 0`, da parallele
Unterprozesse in dieser Windows-Sandbox nicht zuverlässig starteten.
`pytest.ini` blieb unverändert: GitHub CI prüft weiterhin mit zwei Prozessen
auf Ubuntu und Python 3.11. Persistenztests haben eigene UUID-Datenbanken;
Partie-Tests prüfen eigene IDs statt globale Zähler.

Mehrere echte CRA/CRACO-Produktionsbuilds waren erfolgreich, einschließlich des
abschließenden Builds. Python-Kompilation, Ruff-Prüfung auf Syntax-/kritische
Programmierfehler und Diff-Whitespace-Prüfung bestanden. Das Projekt hat keinen
separaten TypeScript-Typecheck; ein solcher wurde nicht behauptet.

## Tatsächliche Browser-Prüfungen

Geprüft am vollständigen gebauten React-Frontend, nicht nur an einem Layout-Mock:

- lokale Vorbereitung, eigener Name trotz Porträtwechsel, Solo-Bots;
- mobile Mehrfachauswahl, angehobene Karten, Tauschbestätigung;
- sichtbare Bot-Züge, kompletter Stich, Rückblick und Fortsetzen;
- private Tauschübersicht mit gesendeten/empfangenen Karten;
- fehlerhafter Einladungsraum, Zurück-Navigation, gelöschter Einladungscode;
- Online-Raumerstellung, Bots hinzufügen/entfernen, Spielstart, Tausch und Zug;
- Server tatsächlich gestoppt und neu gestartet: Tisch/Auswahl blieben erhalten,
  fehlgeschlagene Aktion blieb sichtbar, automatische Wiederverbindung funktionierte;
- Seite neu geladen: derselbe gespeicherte Zugang, Sitz und Karten wurden wiederhergestellt;
- Rückblick-Präsenz war in der öffentlichen Zuschauerantwort sichtbar, private Hand nicht;
- Layoutkontrolle bei 320×568, 375×667 und normaler Desktopbreite.

## Einschränkungen und verbleibende Risiken

- Kein Test auf einem physischen iPhone/Safari oder Android-Gerät. Mobile Größen
  wurden im integrierten Browser geprüft; Mehrspieler mit unabhängigen Tokens über
  echte HTTP-Aufrufe, nicht mit mehreren physischen Geräten.
- Kein Produktions-Lasttest, vollständiger Penetrationstest oder umfassendes
  Abhängigkeits-Audit. Die grundlegende Eingabe-/Zugriffskontrolle wurde geprüft;
  eine Suche in versionierten Textdateien fand kein offensichtliches eingebettetes
  Credential-Muster. Das ist keine vollständige Secret-Historienprüfung.
- Kein neues Konto-, Rate-Limit- oder Anti-Cheat-System. Die lokale Statistik-API
  nimmt wie bisher öffentlich gemeldete lokale Ergebnisse an; sie ist keine
  manipulationssichere Rangliste. Online-Spielzustände bleiben serverautoritativ.
- Der Betrieb bleibt auf einen Serverprozess/eine Instanz ausgelegt. CAS verhindert
  veraltetes Überschreiben, ersetzt jedoch kein allgemein verteiltes Lock-System.
- Verlust/Löschung des gespeicherten Spieler-Tokens erlaubt keine Wiederaufnahme
  allein per Namen. Das ist bewusst sicherer; der Host kann offline Plätze durch Bots ersetzen.
- Bestehende FastAPI-/Testframework-Abkündigungswarnungen bleiben ohne funktionale
  Auswirkung. CRA-Abhängigkeiten wurden nicht unnötig modernisiert.
- Kostenlose Hosting-Ruhephasen und die vorhandene Raum-Ablaufzeit bleiben bestehen.
  Keine kostenpflichtigen Dienste oder Tarifänderungen wurden vorgenommen.
- Docker-Build war lokal mangels Docker nicht ausführbar; der vorhandene CI-Job
  baut das tatsächliche Deployment-Image. CI-/Live-Veröffentlichung wird getrennt
  von diesen lokalen Ergebnissen kontrolliert.

Neue Tests sind im bestehenden GitHub-Actions-Ablauf eingebunden. Der vollständige
Lauf und Pages-Veröffentlichung sind unter den Repository-Actions nachvollziehbar.
