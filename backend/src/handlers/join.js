const { sessions, disconnectedPlayers } = require('../sessions');
const { generatePlayerId } = require('../utils');
const logger = require('../logger');

function handleJoin(ws, serverPayload) {
  // Accept sessionId in any case (upper/lower)
  const normalizedSessionId = serverPayload?.sessionId?.toUpperCase();
  const playerName = serverPayload?.name;
  const reconnectPlayerId = serverPayload?.playerId; // For reconnection

  if (!normalizedSessionId || !sessions[normalizedSessionId]) {
    ws.send(
      JSON.stringify({
        action: 'join-failed',
        payload: { reason: 'Session does not exist.' },
      })
    );
    return;
  }

  // Check if this is a reconnection attempt
  if (reconnectPlayerId && disconnectedPlayers.has(reconnectPlayerId)) {
    const disconnectedPlayer = disconnectedPlayers.get(reconnectPlayerId);

    // Verify the player was in this session
    if (disconnectedPlayer.sessionId === normalizedSessionId) {
      logger.info(
        { playerId: reconnectPlayerId, sessionId: normalizedSessionId },
        'Player reconnecting'
      );

      // Cancel the removal timeout
      clearTimeout(disconnectedPlayer.timeout);
      disconnectedPlayers.delete(reconnectPlayerId);

      // Remove old WebSocket and add new one
      sessions[normalizedSessionId].players.delete(disconnectedPlayer.ws);
      sessions[normalizedSessionId].players.add(ws);

      ws.sessionId = normalizedSessionId;
      ws.playerName = playerName;
      ws.playerId = reconnectPlayerId;

      // Get list of all players for the reconnecting player
      // Note: Points are managed by the host and will be updated via playersChanged message
      const allPlayers = Array.from(sessions[normalizedSessionId].players).map((p) => ({
        id: p.playerId,
        name: p.playerName,
        points: 0, // Points will be updated by host via playersChanged message
      }));

      // Send reconnection success with current game status and players list
      const session = sessions[normalizedSessionId];
      ws.send(
        JSON.stringify({
          action: 'join-success',
          payload: {
            sessionId: normalizedSessionId,
            playerId: reconnectPlayerId,
            players: allPlayers, // Send list of all players
            status: session.status || 'notStarted',
          },
        })
      );

      logger.info({ playerId: reconnectPlayerId }, 'Player successfully reconnected');
      return;
    }
  }

  // Check if this WebSocket is already a player
  if (ws.playerName && ws.playerName !== '') {
    ws.send(
      JSON.stringify({
        action: 'join-failed',
        payload: { reason: 'You are already connected to a session as a player.' },
      })
    );
    return;
  }

  // Check if a player with the same name already exists in the session
  const isDuplicate = Array.from(sessions[normalizedSessionId].players).some(
    (player) => player.playerName === playerName
  );

  if (isDuplicate) {
    ws.send(
      JSON.stringify({
        action: 'join-failed',
        payload: { reason: 'A player with this name already exists in the session.' },
      })
    );
    return;
  }

  // Set player properties BEFORE adding to session to prevent race conditions
  ws.sessionId = normalizedSessionId;
  ws.playerName = playerName;
  ws.playerId = generatePlayerId();

  // Now add to session
  sessions[normalizedSessionId].players.add(ws);

  // Get list of all players for the new player
  const allPlayers = Array.from(sessions[normalizedSessionId].players).map((p) => ({
    id: p.playerId,
    name: p.playerName,
    points: 0, // Initial points
  }));

  // Get current game status
  const session = sessions[normalizedSessionId];
  const currentStatus = session.status || 'notStarted';

  // Send join-success with playerId, all players, and current game status to the new player
  ws.send(
    JSON.stringify({
      action: 'join-success',
      payload: {
        sessionId: normalizedSessionId,
        playerId: ws.playerId,
        players: allPlayers, // Send list of all players
        status: currentStatus, // Send current game status
      },
    })
  );

  logger.info(
    {
      sessionId: normalizedSessionId,
      playerCount: sessions[normalizedSessionId].players.size,
    },
    'Player joined session'
  );

  // Notify host that a new player joined
  const host = sessions[normalizedSessionId].host;
  if (host) {
    host.send(
      JSON.stringify({
        action: 'player-joined',
        payload: {
          name: ws.playerName,
          playerId: ws.playerId,
        },
      })
    );
  }

  // Notify all OTHER players in the session about the new player
  sessions[normalizedSessionId].players.forEach((playerWs) => {
    if (playerWs !== ws) {
      // Don't send to the player who just joined
      playerWs.send(
        JSON.stringify({
          action: 'player-joined',
          payload: {
            name: ws.playerName,
            playerId: ws.playerId,
          },
        })
      );
    }
  });
}

module.exports = { handleJoin };
