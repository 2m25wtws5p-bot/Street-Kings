# Street Kings: Online-Spielbetrieb

Die Oberfläche bleibt auf https://2m25wtws5p-bot.github.io/Street-Kings/.
Der Raum-Code-Modus benötigt den Python-Server und eine MongoDB.
Der Server läuft unabhängig von Emergent.

## Server veröffentlichen

Das Dockerfile im Repository-Hauptverzeichnis startet den vorhandenen Server.
Nur eine Instanz mit einem Worker betreiben: Raum-Sperren sind derzeit
prozesslokal. Nicht horizontal skalieren und während laufender Spiele möglichst
keine neue Version veröffentlichen.

Zum Beispiel auf Railway:
1. Einen Server-Dienst aus diesem GitHub-Repository erstellen (Dockerfile im Hauptverzeichnis).
2. Eine MongoDB im selben Projekt mit persistentem Datenträger und Zugangsdaten erstellen.
3. Die private MongoDB-Verbindungsadresse beim Server als MONGO_URL hinterlegen.
   MONGO_URI wird alternativ ebenfalls akzeptiert.
4. DB_NAME=street_kings und CORS_ORIGINS=https://2m25wtws5p-bot.github.io setzen.
5. Den Server öffentlich per HTTPS erreichbar machen.
6. Healthcheck-Pfad /api/health einstellen. Er bestätigt auch die MongoDB-Verbindung.
   PORT wird vom Hosting-Dienst vorgegeben; Standard ist 8000.

Hosting und Datenbank können Kosten verursachen. Vor der Einrichtung Tarif,
Kostenlimit und automatische Backups prüfen. Die Datenbank nicht öffentlich
ohne Authentifizierung freigeben. Zugangsdaten gehören ausschließlich in
die geschützten Variablen des Hosting-Dienstes, niemals ins Repository.

## GitHub Pages verbinden

Unter Settings > Secrets and variables > Actions > Variables die Variable
REACT_APP_BACKEND_URL auf die HTTPS-Adresse des Servers setzen (ohne /api).
Der Pages-Workflow akzeptiert alternativ ein gleichnamiges Actions-Secret.
Diese URL wird im Browser sichtbar; hier niemals Datenbank-Zugangsdaten hinterlegen.
Anschließend den Workflow Deploy frontend to GitHub Pages erneut ausführen.

## Prüfen

1. /api/health liefert HTTP 200 und {"status":"ok"}.
2. Unter dem bisherigen Pages-Link einen Raum erstellen.
3. Zwei andere Browserprofile oder Geräte treten mit unterschiedlichen Namen bei.
4. Der Host startet mit mindestens drei Spielern; fehlende Sitze dürfen Bots sein.
5. Jeder Spieler sieht ausschließlich die eigene Hand.
6. Kartenweitergabe, vollständige Runde und nächste Runde gemeinsam testen.

Der Workflow Test online multiplayer prüft alle bestehenden Backend-Tests
sowie eine komplette Runde mit drei getrennten Spieler-Token, Kartenprivatsphäre,
Bedienung, ungültige Züge und den CORS-Zugang von GitHub Pages gegen eine
temporäre MongoDB. Er ist kein dauerhafter Spielserver.

## Lokal entwickeln

MongoDB lokal starten und MONGO_URL, DB_NAME sowie CORS_ORIGINS konfigurieren.
Dann:
    python -m pip install -r backend/requirements.runtime.txt
    python -m uvicorn server:app --app-dir backend --host 127.0.0.1 --port 8000 --workers 1

Für Frontend-Entwicklung REACT_APP_BACKEND_URL=http://localhost:8000 setzen.
Für Tests zusätzlich pytest, pytest-xdist und requests installieren,
REACT_APP_BACKEND_URL=http://localhost:8000 und PYTHONPATH=backend setzen,
dann python -m pytest backend/tests ausführen.
