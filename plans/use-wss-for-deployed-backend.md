---
name: Use WSS for Deployed Backend
type: fix
state: todo
version: 0.1.0
---

## Goal

Ensure the deployed backend serves WebSocket traffic over TLS so the HTTPS-hosted frontend can connect without mixed-content issues, while keeping local development workflows unaffected.

## Tasks

Audit current WebSocket configuration, introduce secure WebSocket support on the Raspberry Pi deployment, and update the frontend to negotiate `wss` when appropriate. 
Keep using the current ws setup on local development. Validate both local and production flows and document any deployment/runtime changes.

### 1. Audit current WebSocket usage
- Locate every `ws://` reference in frontend and backend code (e.g., `frontend/src/config.ts`, `frontend/src/game/*`, `backend/index.js`).
- Confirm how environment variables or build-time configuration currently select the backend URL.
- Identify any assumptions (ports, protocols) baked into deployment scripts or docs.

### 2. Enable TLS termination for backend WebSocket server
- Decide whether to wrap the existing Node.js WebSocket server with an HTTPS server or terminate TLS at nginx (confirm current reverse-proxy setup on Raspberry Pi).
- Add environment-driven configuration for certificate/key paths (`/etc/letsencrypt/live/guess-the-song.duckdns.org/fullchain.pem` and `.../privkey.pem`).
- Update code (and potentially `Dockerfile`/`docker-compose.yml`) so production bootstraps a secure server while local dev keeps using plain `ws`.
- Adjust firewall/nginx configuration if port changes are required.

### 3. Update frontend connection logic
- Modify the frontend to derive the WebSocket protocol from the current page protocol (e.g., `location.protocol === 'https:' ? 'wss' : 'ws'`).
- Ensure configuration files or environment variables support overriding the WebSocket URL for different environments.
- Verify reconnection/heartbeat logic continues to work with `wss`.

### 4. Verify and document
- Run automated tests (`npm test` in both `frontend` and `backend`) to ensure regressions are caught.
- Perform local smoke test: HTTPS reverse proxy (or mock) to confirm `wss` handshake works end-to-end.
- Document deployment instructions in `SETUP.md` or a relevant README, noting certificate paths and any new env vars.

## Steps

- [ ] Complete Task 1: Audit current WebSocket usage
- [ ] Complete Task 2: Enable TLS termination for backend WebSocket server
- [ ] Complete Task 3: Update frontend connection logic
- [ ] Complete Task 4: Verify and document

## Review Feedback Addressed

1. **TBD**: Document any review feedback and resolutions once received
2. **TBD**: Document any additional reviewer concerns once received

## Notes

- Certificates are stored at `/etc/letsencrypt/live/guess-the-song.duckdns.org/fullchain.pem` and `/etc/letsencrypt/live/guess-the-song.duckdns.org/privkey.pem` on the Raspberry Pi host.
- Consider using environment variables (e.g., `BACKEND_WSS_CERT`, `BACKEND_WSS_KEY`) to avoid hard-coding absolute paths in code.
- Evaluate whether nginx already handles TLS; if so, ensure it forwards upgraded WebSocket connections correctly (`proxy_set_header Upgrade` / `Connection upgrade`).
- Plan to verify that service restarts pick up renewed LetsEncrypt certificates without manual intervention.
