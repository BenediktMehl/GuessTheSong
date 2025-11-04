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

## Nginx + Certbot (WSS Reverse Proxy)

Um das Backend sicher über `wss://` zugänglich zu machen, setze ein Nginx-Reverse-Proxy mit Let's Encrypt TLS-Zertifikat ein. Die folgenden Schritte laufen alle auf dem Raspberry Pi.

### 1. Nginx & Certbot installieren

```bash
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx -y
```

### 2. DNS & Port-Freigabe prüfen

- DNS-Eintrag (z. B. `guess-the-song.duckdns.org`) muss auf die öffentliche IP des Pi zeigen.
- Router: leite **Port 80 (TCP)** und **Port 443 (TCP)** zum Pi durch.

### 3. Zertifikat mit Certbot holen

```bash
sudo certbot --nginx -d guess-the-song.duckdns.org
```

Folge dem Assistenten und aktiviere den automatischen HTTPS-Redirect, wenn gefragt. Certbot erneuert das Zertifikat später automatisch per Cronjob.

### 4. Nginx für WebSocket-Proxy konfigurieren

Erstelle oder bearbeite `/etc/nginx/sites-available/guessthesong` und hinterlege:

```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name guess-the-song.duckdns.org;

    ssl_certificate /etc/letsencrypt/live/guess-the-song.duckdns.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/guess-the-song.duckdns.org/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # WebSocket Proxy
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 300s;
    }
}

server {
    listen 80;
    listen [::]:80;
    server_name guess-the-song.duckdns.org;

    return 301 https://$host$request_uri;
}
```

Aktiviere die Site und teste Nginx:

```bash
sudo ln -sf /etc/nginx/sites-available/guessthesong /etc/nginx/sites-enabled/guessthesong
sudo nginx -t
sudo systemctl reload nginx
```

### 5. Frontend konfigurieren

- Setze in der Vercel-Umgebung `VITE_WS_URL=wss://guess-the-song.duckdns.org` (oder den passenden Hostnamen).
- Lokale Entwicklung bleibt unverändert, solange `VITE_SPOTIFY_REDIRECT_BASE` bzw. der Fallback genutzt wird.

### 6. Verbindung testen

```bash
wscat -c wss://guess-the-song.duckdns.org

# Test-Nachricht senden:
{"serverAction":"create"}
```

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
