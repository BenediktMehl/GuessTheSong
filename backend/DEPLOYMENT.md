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
5. Backend läuft auf Port 8080

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

## Nginx WebSocket Proxy (Optional für WSS)

Wenn du **wss://** (verschlüsselte WebSocket) nutzen möchtest, füge zu deiner nginx-Config hinzu:

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    
    # ... existing frontend config ...
    
    # WebSocket Proxy für Backend
    location /ws {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

Dann kannst du in `frontend/src/config.ts` die Production URL zu `wss://guess-the-song.duckdns.org/ws` ändern.

## Testen

```bash
# Von deinem lokalen Rechner:
wscat -c ws://guess-the-song.duckdns.org:8080

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
