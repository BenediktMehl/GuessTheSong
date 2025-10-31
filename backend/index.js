const WebSocket = require('ws');
const crypto = require('crypto');
const ws = new WebSocket.Server({ port: 8080 });

const sessions = {}; // sessionId -> { host: ws, players: Set<ws> }

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
  // Check if this WebSocket is already a player
  if (ws.playerName && ws.playerName !== '') {
    ws.send(JSON.stringify({
      action: 'join-failed',
      payload: { reason: 'You are already connected to a session as a player.' }
    }));
    return;
  }

  // Accept sessionId in any case (upper/lower)
  const normalizedSessionId = serverPayload?.sessionId?.toUpperCase();
  if (!normalizedSessionId || !sessions[normalizedSessionId]) {
    ws.send(JSON.stringify({
      action: 'join-failed',
      payload: { reason: 'Session does not exist.' }
    }));
    return;
  }

  // Check if a player with the same name already exists in the session
  const playerName = serverPayload?.name;
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

  sessions[normalizedSessionId].players.add(ws);
  ws.sessionId = normalizedSessionId;
  ws.playerName = playerName;
  ws.playerId = generatePlayerId();

  // Send join-success with playerId to player
  ws.send(JSON.stringify({
    action: 'join-success',
    payload: { sessionId: normalizedSessionId, playerId: ws.playerId }
  }));

  console.log(`Player joined session ${normalizedSessionId}. Players in session: ${sessions[normalizedSessionId].players.size}`);

  // Notify host that a new player joined, send the player's name and id
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
  console.log(`Session created: ${newSessionId}. Open sessions: ${Object.keys(sessions).length}`);
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
  sessions[sessionId]?.players.delete(ws);
  if (sessions[sessionId]) {
    console.log(`Player left session ${sessionId}. Players in session: ${sessions[sessionId].players.size}`);
    // Notify host that a player left, send the player's id
    const host = sessions[sessionId].host;
    if (host && ws.playerId) {
      host.send(JSON.stringify({
        action: 'player-left',
        payload: {
          playerId: ws.playerId
        }
      }));
    }
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
    console.log(`Session deleted: ${sessionId}. Open sessions: ${Object.keys(sessions).length}`);
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