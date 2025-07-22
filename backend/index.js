const WebSocket = require('ws');
const crypto = require('crypto');
const wss = new WebSocket.Server({ port: 8080 });

const sessions = {}; // sessionId -> { host: ws, players: Set<ws> }

function generateSessionId() {
  // Generates a random 4-letter uppercase session ID
  return crypto.randomBytes(2).toString('hex').toUpperCase();
}

function generatePlayerId() {
  // Generates a UUID for player ID
  return crypto.randomUUID();
}

wss.on('connection', (ws) => {
  ws.on('message', (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', message: 'Could not interpret the command (invalid JSON).' }));
      return;
    }
    const { type, role, payload, sessionId } = data;

    if (type === 'create') {
      // Host requests to create a new session
      let newSessionId;
      let attempts = 0;
      do {
        newSessionId = generateSessionId();
        attempts++;
        // Prevent infinite loop in the rare case of collision
        if (attempts > 100) {
          ws.send(JSON.stringify({ type: 'error', message: 'Could not generate unique session ID.' }));
          return;
        }
      } while (sessions[newSessionId]);
      sessions[newSessionId] = { host: ws, players: new Set() };
      ws.sessionId = newSessionId;
      ws.role = 'host';
      ws.send(JSON.stringify({ type: 'created', sessionId: newSessionId }));
      console.log(`Session created: ${newSessionId}. Open sessions: ${Object.keys(sessions).length}`);
    } else if (type === 'join') {
      // Accept sessionId in any case (upper/lower)
      const normalizedSessionId = sessionId?.toUpperCase();
      if (!normalizedSessionId || !sessions[normalizedSessionId]) {
        ws.send(JSON.stringify({ type: 'join-failed', reason: 'Session does not exist.' }));
        return;
      }
      sessions[normalizedSessionId].players.add(ws);
      ws.sessionId = normalizedSessionId;
      ws.role = 'player';
      ws.playerName = payload?.name; // Store player name on the ws connection
      ws.playerId = generatePlayerId(); // Generate and store playerId

      // Send join-success with playerId to player
      ws.send(JSON.stringify({ type: 'join-success', sessionId: normalizedSessionId, playerId: ws.playerId }));

      console.log(`Player joined session ${normalizedSessionId}. Players in session: ${sessions[normalizedSessionId].players.size}`);

      // Notify host that a new player joined, send the player's name and id
      const host = sessions[normalizedSessionId].host;
      if (host) {
        host.send(JSON.stringify({
          type: 'player-joined',
          name: ws.playerName,
          playerId: ws.playerId
        }));
      }
    } else if (type === 'player-action') {
      // Player sends action → forward to Host with timestamp and player name
      const playerSessionId = ws.sessionId;
      if (playerSessionId && sessions[playerSessionId]) {
        sessions[playerSessionId].host.send(JSON.stringify({
          type: 'player-action',
          payload,
          serverTimestamp: Date.now(),
          name: ws.playerName, // Attach player name
          playerId: ws.playerId // Attach player id
        }));
      } else {
        ws.send(JSON.stringify({ type: 'error', message: 'Session does not exist.' }));
      }
    } else if (type === 'host-broadcast') {
      // Host sends update → broadcast to all players
      const hostSessionId = ws.sessionId;
      if (hostSessionId && sessions[hostSessionId]) {
        sessions[hostSessionId].players.forEach(playerWs => {
          playerWs.send(JSON.stringify({ type: 'update', payload }));
        });
      }
    }
  });

  ws.on('close', () => {
    const { sessionId, role, playerName, playerId } = ws;
    if (!sessionId) return;
    if (role === 'player') {
      sessions[sessionId]?.players.delete(ws);
      if (sessions[sessionId]) {
        console.log(`Player left session ${sessionId}. Players in session: ${sessions[sessionId].players.size}`);
        // Notify host that a player left, send the player's name and id
        const host = sessions[sessionId].host;
        if (host) {
          host.send(JSON.stringify({
            type: 'player-left',
            sessionId,
            name: playerName,
            playerId: playerId
          }));
        }
      }
    }
    // If host disconnects, close session and notify all players
    if (role === 'host') {
      if (sessions[sessionId]) {
        // Notify all players in the session
        sessions[sessionId].players.forEach(playerWs => {
          playerWs.send(JSON.stringify({ type: 'session-closed', reason: 'Host disconnected' }));
          playerWs.close();
        });
        delete sessions[sessionId];
        console.log(`Session deleted: ${sessionId}. Open sessions: ${Object.keys(sessions).length}`);
      }
    }
  });
});