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
      ws.send(JSON.stringify({ 
        type: "host", 
        action: "error", 
        payload: { message: 'Could not interpret the command (invalid JSON).' }
      }));
      return;
    }
    
    const { type, action, payload } = data;

    // Handle incoming messages based on type and action
    if (type === 'player' && action === 'join') {
      // Check if this WebSocket is already a player
      if (ws.playerName && ws.playerName !== '') {
        ws.send(JSON.stringify({ 
          type: 'host', 
          action: 'join-failed', 
          payload: { reason: 'You are already connected to a session as a player.' }
        }));
        return;
      }

      // Accept sessionId in any case (upper/lower)
      const normalizedSessionId = payload?.sessionId?.toUpperCase();
      if (!normalizedSessionId || !sessions[normalizedSessionId]) {
        ws.send(JSON.stringify({ 
          type: 'host', 
          action: 'join-failed', 
          payload: { reason: 'Session does not exist.' }
        }));
        return;
      }

      // Check if a player with the same name already exists in the session
      const playerName = payload?.name;
      const isDuplicate = Array.from(sessions[normalizedSessionId].players).some(player => 
        player.playerName === playerName
      );
      
      if (isDuplicate) {
        ws.send(JSON.stringify({ 
          type: 'host', 
          action: 'join-failed', 
          payload: { reason: 'A player with this name already exists in the session.' }
        }));
        return;
      }
      
      sessions[normalizedSessionId].players.add(ws);
      ws.sessionId = normalizedSessionId;
      ws.playerName = playerName; 
      ws.playerId = generatePlayerId();

      // Send join-success with playerId to player
      ws.send(JSON.stringify({ 
        type: 'host', 
        action: 'join-success', 
        payload: { sessionId: normalizedSessionId, playerId: ws.playerId }
      }));

      console.log(`Player joined session ${normalizedSessionId}. Players in session: ${sessions[normalizedSessionId].players.size}`);

      // Notify host that a new player joined, send the player's name and id
      const host = sessions[normalizedSessionId].host;
      if (host) {
        host.send(JSON.stringify({
          type: 'player-forward',
          action: 'player-joined',
          payload: {
            name: ws.playerName,
            playerId: ws.playerId
          }
        }));
      }
    } 
    else if (type === 'host' && action === 'create') {
      // Host requests to create a new session
      let newSessionId;
      let attempts = 0;
      do {
        newSessionId = generateSessionId();
        attempts++;
        // Prevent infinite loop in the rare case of collision
        if (attempts > 100) {
          ws.send(JSON.stringify({ 
            type: 'host', 
            action: 'error', 
            payload: { message: 'Could not generate unique session ID.' }
          }));
          return;
        }
      } while (sessions[newSessionId]);
      sessions[newSessionId] = { host: ws, players: new Set() };
      ws.sessionId = newSessionId;
      ws.send(JSON.stringify({ 
        type: 'host', 
        action: 'created', 
        payload: { sessionId: newSessionId }
      }));
      console.log(`Session created: ${newSessionId}. Open sessions: ${Object.keys(sessions).length}`);
    } 
    else if (type === 'player' && (action === 'guessed' || action === 'wantToGuess' || 
             action === 'musicHostChanged' || action === 'refereeChanged')) {
      // Player sends action → forward to Host with timestamp and player name
      const playerSessionId = ws.sessionId;
      if (playerSessionId && sessions[playerSessionId]) {
        sessions[playerSessionId].host.send(JSON.stringify({
          type: 'player-forward',
          action: action,
          payload: {
            ...payload,
            serverTimestamp: Date.now(),
            playerId: ws.playerId,
            playerName: ws.playerName
          }
        }));
      } else {
        ws.send(JSON.stringify({ 
          type: 'host', 
          action: 'error', 
          payload: { message: 'Session does not exist.' }
        }));
      }
    } 
    else if (type === 'host' && action === 'broadcast') {
      // Host sends update → broadcast to all players
      const hostSessionId = ws.sessionId;
      if (hostSessionId && sessions[hostSessionId]) {
        sessions[hostSessionId].players.forEach(playerWs => {
          playerWs.send(JSON.stringify({ 
            type: 'host-broadcast', 
            action: payload.action || 'update', 
            payload: payload.data || payload
          }));
        });
      }
    }
  });

  ws.on('close', () => {
    const { sessionId, playerName, playerId } = ws;
    if (!sessionId) return;
    const isPlayer = sessions[sessionId]?.host !== ws;
    if (isPlayer) {
      sessions[sessionId]?.players.delete(ws);
      if (sessions[sessionId]) {
        console.log(`Player left session ${sessionId}. Players in session: ${sessions[sessionId].players.size}`);
        // Notify host that a player left, send the player's name and id
        const host = sessions[sessionId].host;
        if (host) {
          host.send(JSON.stringify({
            type: 'player-forward',
            action: 'player-left',
            payload: {
              sessionId,
              name: playerName,
              playerId: playerId
            }
          }));
        }
      }
    } else {
      if (sessions[sessionId]) {
        // Notify all players in the session
        sessions[sessionId].players.forEach(playerWs => {
          playerWs.send(JSON.stringify({ 
            type: 'host-broadcast', 
            action: 'session-closed', 
            payload: { reason: 'Host disconnected' }
          }));
          playerWs.close();
        });
        delete sessions[sessionId];
        console.log(`Session deleted: ${sessionId}. Open sessions: ${Object.keys(sessions).length}`);
      }
    }
  });
});