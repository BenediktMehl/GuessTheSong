const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const WebSocket = require('ws');
const { USE_TLS, TLS_CERT_PATH, TLS_KEY_PATH, ALLOWED_ORIGINS } = require('./config');

function handleHttpRequest(_, res) {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('GuessTheSong backend is running.');
}

function createHttpServer() {
  if (!USE_TLS) {
    return http.createServer(handleHttpRequest);
  }

  if (!TLS_CERT_PATH || !TLS_KEY_PATH) {
    console.error('WS_USE_TLS=true requires WS_TLS_CERT_PATH and WS_TLS_KEY_PATH to be set.');
    process.exit(1);
  }

  try {
    const credentials = {
      cert: fs.readFileSync(TLS_CERT_PATH),
      key: fs.readFileSync(TLS_KEY_PATH),
    };

    return https.createServer(credentials, handleHttpRequest);
  } catch (error) {
    console.error('Failed to load TLS credentials:', error);
    process.exit(1);
  }
}

const httpServer = createHttpServer();
const ws = new WebSocket.Server({
  server: httpServer,
  verifyClient: ({ origin }, done) => {
    const allowed = !origin || ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin);

    if (allowed) {
      done(true);
      return;
    }

    console.warn(`Rejecting connection from disallowed origin: ${origin}`);
    done(false, 403, 'Origin not allowed');
  },
});

module.exports = { httpServer, ws };
