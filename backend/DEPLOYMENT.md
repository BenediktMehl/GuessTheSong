# Backend Deployment Setup (Docker)

## Port Configuration
Das Backend läuft auf **Port 8080** (WebSocket) in einem Docker Container.

## Voraussetzungen auf dem Raspberry Pi

### Docker & Docker Compose installieren

```bash
# Docker installieren
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# User zu docker Gruppe hinzufügen
sudo usermod -aG docker benedikt.mehl

# Neu einloggen damit Gruppenzugehörigkeit aktiv wird
# Dann Docker Compose installieren (falls nicht bereits vorhanden):
sudo apt-get update
sudo apt-get install docker-compose-plugin
```

## Setup auf dem Raspberry Pi

### 1. Verzeichnis erstellen (einmalig)

```bash
mkdir -p /home/benedikt.mehl/guessthesong-backend
```

### 2. Router Port-Forwarding

Leite **Port 8080 TCP** auf die IP des Raspberry Pi weiter:
- Externer Port: **8080**
- Interner Port: **8080**
- Protokoll: **TCP**
- Ziel-IP: [Raspberry Pi IP]

## GitHub Actions Deployment

Der Backend-Workflow (`.github/workflows/backend.yml`) wird automatisch ausgelöst bei:
- Push auf `main` Branch
- Änderungen im `backend/` Ordner

### Deployment-Ablauf

1. Code-Änderung im `backend/` Ordner pushen
2. GitHub Action wird getriggert
3. Dateien werden per SCP auf Pi kopiert nach `/home/benedikt.mehl/guessthesong-backend`
4. Docker Container wird neu gebaut und gestartet via `docker compose up -d --build`
5. Backend läuft auf Port 8080 (per `wss://` wenn TLS aktiviert ist)

## Manuelle Container-Verwaltung

```bash
cd /home/benedikt.mehl/guessthesong-backend

# Container starten
docker compose up -d

# Container stoppen
docker compose down

# Logs anzeigen
docker compose logs -f

# Container neu bauen und starten
docker compose up -d --build

# Status prüfen
docker compose ps
```

## TLS-Konfiguration direkt im Container

Der Node.js-Server kann die TLS-Zertifikate direkt laden. Nginx ist nicht mehr zwingend notwendig (kann aber weiterhin als Reverse Proxy genutzt werden, wenn gewünscht).

Das Backend läuft **aus Sicherheitsgründen als non-root Benutzer** (`node`). Um trotzdem auf die Let's Encrypt Zertifikate zugreifen zu können, die standardmäßig nur für Root lesbar sind, kopiert ein Entrypoint-Script die Zertifikate beim Container-Start in ein beschreibbares Verzeichnis mit den richtigen Berechtigungen.

1. Zertifikate liegen standardmäßig unter `/etc/letsencrypt/live/guess-the-song.duckdns.org/`.
1. Zertifikate liegen standardmäßig unter `/etc/letsencrypt/live/guess-the-song.duckdns.org/`.
2. Mount die Dateien read-only in den Container, z. B. nach `/source-certs/fullchain.pem` und `/source-certs/privkey.pem`.
3. Ein Entrypoint-Script (`entrypoint.sh`) kopiert die Zertifikate beim Start in das beschreibbare Verzeichnis `/tmp/certs/` und setzt die Berechtigungen (600).
3. Ein Entrypoint-Script (`entrypoint.sh`) kopiert die Zertifikate beim Start in das beschreibbare Verzeichnis `/tmp/certs/` und setzt die Berechtigungen (600).
4. Die Environment-Variablen im Compose-File zeigen auf die kopierten Zertifikate:
   - `WS_USE_TLS=true`
   - `WS_TLS_CERT_PATH=/tmp/certs/fullchain.pem`
   - `WS_TLS_KEY_PATH=/tmp/certs/privkey.pem`

Nach einem `docker compose up -d --build` lauscht das Backend auf `wss://<host>:8080`.

> Hinweis: Nutze das Zusatz-Compose-File `docker-compose.tls.yml`, um TLS inklusive Zertifikat-Mount zu aktivieren:
>
> ```bash
> docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d --build
> ```
>
> Das Overlay konfiguriert automatisch die Zertifikats-Kopie und läuft sicher als non-root Benutzer.

### Frontend konfigurieren

- Setze in der Produktionsumgebung `VITE_WS_URL=wss://guess-the-song.duckdns.org:8080` (oder den passenden Hostnamen/Port).
- Lokale Entwicklung bleibt unverändert; `ws://localhost:8080` bleibt der Standard.

### Verbindung testen

```bash
wscat -c wss://guess-the-song.duckdns.org:8080

# Test-Nachricht senden:
{"serverAction":"create"}
```

## Testen

```bash
# Von deinem lokalen Rechner (Produktions-Endpoint):
wscat -c wss://guess-the-song.duckdns.org:8080

# Test-Nachricht senden:
{"serverAction":"create"}
```

## Troubleshooting

```bash
# Container Logs live ansehen
docker compose logs -f backend

# In Container Shell einsteigen
docker compose exec backend sh

# Container neu starten
docker compose restart backend

# Alle Container und Images aufräumen
docker system prune -a
```
