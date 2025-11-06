const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const { URL } = require('node:url');
const WebSocket = require('ws');
const { USE_TLS, TLS_CERT_PATH, TLS_KEY_PATH, ALLOWED_ORIGINS } = require('./config');

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';

// Log if credentials are configured (without exposing the secret)
if (SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET) {
  console.log('Spotify credentials loaded (Client ID configured)');
} else {
  console.warn('Spotify credentials not fully configured. Token exchange will not work.');
  if (!SPOTIFY_CLIENT_ID) console.warn('  Missing: SPOTIFY_CLIENT_ID');
  if (!SPOTIFY_CLIENT_SECRET) console.warn('  Missing: SPOTIFY_CLIENT_SECRET');
}

// Helper function to get CORS headers object
function getCorsHeaders(req) {
  const origin = req.headers.origin;
  const headers = {};
  
  // In development (or if NODE_ENV not set, assume development), allow localhost origins
  const isDevelopment = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
  
  if (origin) {
    // In development, allow any localhost/127.0.0.1 origin
    if (isDevelopment && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
      headers['Access-Control-Allow-Headers'] = 'Content-Type';
      headers['Access-Control-Allow-Credentials'] = 'true';
      console.log(`[CORS] Allowing origin: ${origin} (development mode)`);
      return headers;
    }
    
    // Check against configured allowed origins
    const allowedOrigin = ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin);
    if (allowedOrigin) {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
      headers['Access-Control-Allow-Headers'] = 'Content-Type';
      headers['Access-Control-Allow-Credentials'] = 'true';
      console.log(`[CORS] Allowing origin: ${origin} (configured)`);
      return headers;
    }
    
    console.log(`[CORS] Rejecting origin: ${origin}`);
  } else {
    console.log('[CORS] No origin header present');
  }
  
  return headers;
}

async function handleTokenExchange(req, res) {
  const corsHeaders = getCorsHeaders(req);

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    res.end();
    return;
  }

  // Only allow POST
  if (req.method !== 'POST') {
    res.writeHead(405, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  let body = '';
  req.on('data', (chunk) => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      const { code, code_verifier, redirect_uri } = JSON.parse(body);

      if (!code || !code_verifier) {
        res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing code or code_verifier' }));
        return;
      }

      if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
        res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Spotify credentials not configured on server' }));
        return;
      }

      // Exchange code for token using Spotify API
      const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: redirect_uri || 'http://127.0.0.1:5173/spotifycallback',
          code_verifier: code_verifier,
        }),
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        res.writeHead(tokenResponse.status, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: tokenData.error || 'Token exchange failed', details: tokenData }));
        return;
      }

      // Return only the tokens to frontend (client secret stays on server)
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in,
      }));
    } catch (error) {
      console.error('Token exchange error:', error);
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error', message: error.message }));
    }
  });
}

function handleHttpRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  // Handle token exchange endpoint (both POST and OPTIONS)
  if (url.pathname === '/api/spotify/token') {
    handleTokenExchange(req, res);
    return;
  }

  // Default response
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
