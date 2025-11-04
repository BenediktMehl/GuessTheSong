const fs = require('fs');
const http = require('http');
const https = require('https');
const WebSocket = require('ws');
const crypto = require('crypto');

const PORT = Number.parseInt(process.env.PORT ?? '8080', 10);
const HOST = process.env.HOST ?? '0.0.0.0';
const USE_TLS = process.env.WS_USE_TLS === 'true';
const TLS_CERT_PATH = process.env.WS_TLS_CERT_PATH;
const TLS_KEY_PATH = process.env.WS_TLS_KEY_PATH;

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
      key: fs.readFileSync(TLS_KEY_PATH)
    };

  return https.createServer(credentials, handleHttpRequest);
  } catch (error) {
    console.error('Failed to load TLS credentials:', error);
    process.exit(1);
  }
}

const httpServer = createHttpServer();
const ws = new WebSocket.Server({ server: httpServer });


const sessions = {}; // sessionId -> { host: ws, players: Set<ws> }
const disconnectedPlayers = new Map(); // playerId -> { ws, sessionId, disconnectTime, timeout }

function generateSessionId() {
  // Generates a random 4-letter uppercase session ID
  return crypto.randomBytes(2).toString('hex').toUpperCase();
}

function generatePlayerId() {
  // Generates a UUID for player ID
  return crypto.randomUUID();
}

function sendError(ws, message) {
  ws.send(JSON.stringify({
    action: "error",
    payload: { message }
  }));
}

function handleJoin(ws, serverPayload) {
  // Accept sessionId in any case (upper/lower)
  const normalizedSessionId = serverPayload?.sessionId?.toUpperCase();
  const playerName = serverPayload?.name;
  const reconnectPlayerId = serverPayload?.playerId; // For reconnection
  
  if (!normalizedSessionId || !sessions[normalizedSessionId]) {
    ws.send(JSON.stringify({
      action: 'join-failed',
      payload: { reason: 'Session does not exist.' }
    }));
    return;
  }

  // Check if this is a reconnection attempt
  if (reconnectPlayerId && disconnectedPlayers.has(reconnectPlayerId)) {
    const disconnectedPlayer = disconnectedPlayers.get(reconnectPlayerId);
    
    // Verify the player was in this session
    if (disconnectedPlayer.sessionId === normalizedSessionId) {
  log(`Player ${reconnectPlayerId} reconnecting to session ${normalizedSessionId}`);
      
      // Cancel the removal timeout
      clearTimeout(disconnectedPlayer.timeout);
      disconnectedPlayers.delete(reconnectPlayerId);
      
      // Remove old WebSocket and add new one
      sessions[normalizedSessionId].players.delete(disconnectedPlayer.ws);
      sessions[normalizedSessionId].players.add(ws);
      
      ws.sessionId = normalizedSessionId;
      ws.playerName = playerName;
      ws.playerId = reconnectPlayerId;
      
      // Send reconnection success
      ws.send(JSON.stringify({
        action: 'join-success',
        payload: { sessionId: normalizedSessionId, playerId: reconnectPlayerId }
      }));
      
  log(`Player ${reconnectPlayerId} successfully reconnected`);
      return;
    }
  }

  // Check if this WebSocket is already a player
  if (ws.playerName && ws.playerName !== '') {
    ws.send(JSON.stringify({
      action: 'join-failed',
      payload: { reason: 'You are already connected to a session as a player.' }
    }));
    return;
  }

  // Check if a player with the same name already exists in the session
  const isDuplicate = Array.from(sessions[normalizedSessionId].players).some(player =>
    player.playerName === playerName
  );

  if (isDuplicate) {
    ws.send(JSON.stringify({
      action: 'join-failed',
      payload: { reason: 'A player with this name already exists in the session.' }
    }));
    return;
  }

  // Set player properties BEFORE adding to session to prevent race conditions
  ws.sessionId = normalizedSessionId;
  ws.playerName = playerName;
  ws.playerId = generatePlayerId();
  
  // Now add to session
  sessions[normalizedSessionId].players.add(ws);

  // Get list of all players for the new player
  const allPlayers = Array.from(sessions[normalizedSessionId].players).map(p => ({
    id: p.playerId,
    name: p.playerName,
    points: 0 // Initial points
  }));

  // Send join-success with playerId and all players to the new player
  ws.send(JSON.stringify({
    action: 'join-success',
    payload: { 
      sessionId: normalizedSessionId, 
      playerId: ws.playerId,
      players: allPlayers // Send list of all players
    }
  }));

  log(`Player joined session ${normalizedSessionId}. Players in session: ${sessions[normalizedSessionId].players.size}`);

  // Notify host that a new player joined
  const host = sessions[normalizedSessionId].host;
  if (host) {
    host.send(JSON.stringify({
      action: 'player-joined',
      payload: {
        name: ws.playerName,
        playerId: ws.playerId
      }
    }));
  }

  // Notify all OTHER players in the session about the new player
  sessions[normalizedSessionId].players.forEach(playerWs => {
    if (playerWs !== ws) { // Don't send to the player who just joined
      playerWs.send(JSON.stringify({
        action: 'player-joined',
        payload: {
          name: ws.playerName,
          playerId: ws.playerId
        }
      }));
    }
  });
}

function handleCreate(ws) {
  let newSessionId;
  let attempts = 0;
  do {
    newSessionId = generateSessionId();
    attempts++;
    // Prevent infinite loop in the rare case of collision
    if (attempts > 100) {
      sendError(ws, 'Could not generate unique session ID.');
      return;
    }
  } while (sessions[newSessionId]);

  sessions[newSessionId] = { host: ws, players: new Set() };
  ws.sessionId = newSessionId;
  ws.send(JSON.stringify({
    action: 'created',
    payload: { sessionId: newSessionId }
  }));
  log(`Session created: ${newSessionId}. Open sessions: ${Object.keys(sessions).length}`);
}

function handlePlayerAction(ws, serverPayload) {
  const playerSessionId = ws.sessionId;
  if (playerSessionId && sessions[playerSessionId]) {
    sessions[playerSessionId].host.send(JSON.stringify({
      ...serverPayload,
      serverTimestamp: Date.now()
    }));
  } else {
    sendError(ws, 'Session does not exist.');
  }
}

function handleBroadcast(ws, serverPayload) {
  const hostSessionId = ws.sessionId;
  if (hostSessionId && sessions[hostSessionId]) {
    sessions[hostSessionId].players.forEach(playerWs => {
      playerWs.send(JSON.stringify(serverPayload));
    });
  }
}

function handlePlayerDisconnect(ws, sessionId) {
  const playerId = ws.playerId;
  
  // Don't remove immediately - give grace period for reconnection
  const RECONNECT_GRACE_PERIOD_MS = 180000; // 3 minutes
  
  if (sessions[sessionId] && playerId) {
  log(`Player ${playerId} disconnected from session ${sessionId}. Grace period: ${RECONNECT_GRACE_PERIOD_MS / 1000}s`);
    
    // Store disconnected player info
    const timeout = setTimeout(() => {
      // After grace period, remove player if still disconnected
      if (disconnectedPlayers.has(playerId)) {
        disconnectedPlayers.delete(playerId);
        
        if (sessions[sessionId]) {
          sessions[sessionId].players.delete(ws);
          log(`Player ${playerId} removed from session ${sessionId} after timeout`);
          
          // Notify host that player left
          const host = sessions[sessionId].host;
          if (host) {
            host.send(JSON.stringify({
              action: 'player-left',
              payload: { playerId }
            }));
          }

          // Notify all other players that this player left
          sessions[sessionId].players.forEach(playerWs => {
            playerWs.send(JSON.stringify({
              action: 'player-left',
              payload: { playerId }
            }));
          });
        }
      }
    }, RECONNECT_GRACE_PERIOD_MS);
    
    disconnectedPlayers.set(playerId, { ws, sessionId, disconnectTime: Date.now(), timeout });
  }
}

function handleGameHostDisconnect(ws, sessionId) {
  if (sessions[sessionId]) {
    // Notify all players in the session
    sessions[sessionId].players.forEach(playerWs => {
      playerWs.send(JSON.stringify({
        action: 'session-closed',
        payload: { reason: 'Host disconnected' }
      }));
      playerWs.close();
    });
    delete sessions[sessionId];
  log(`Session deleted: ${sessionId}. Open sessions: ${Object.keys(sessions).length}`);
  }
}

function handleDisconnect(ws) {
  const { sessionId } = ws;
  if (!sessionId) return;

  const isPlayer = sessions[sessionId]?.host !== ws;

  if (isPlayer) {
    handlePlayerDisconnect(ws, sessionId);
  } else {
    handleGameHostDisconnect(ws, sessionId);
  }
}

ws.on('connection', (ws) => {
  ws.on('message', (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch (e) {
      sendError(ws, 'Could not interpret the command (invalid JSON).');
      return;
    }

    const { serverAction, serverPayload } = data;

    switch (serverAction) {
      case 'join':
        handleJoin(ws, serverPayload);
        break;
      case 'create':
        handleCreate(ws);
        break;
      case 'player-action':
        handlePlayerAction(ws, serverPayload);
        break;
      case 'broadcast':
        handleBroadcast(ws, serverPayload);
        break;
      default:
        sendError(ws, `Unknown serverAction: ${serverAction}`);
    }
  });

  ws.on('close', () => {
    handleDisconnect(ws);
  });
});

httpServer.listen(PORT, HOST, () => {
  const protocol = USE_TLS ? 'wss' : 'ws';
  console.log(`GuessTheSong backend listening on ${protocol}://${HOST}:${PORT}`);
});