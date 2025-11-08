const { sessions, disconnectedPlayers, deleteSession } = require('../sessions');
const logger = require('../logger');

// Don't remove immediately - give grace period for reconnection
const RECONNECT_GRACE_PERIOD_MS = 180000; // 3 minutes

function handlePlayerDisconnect(ws, sessionId) {
  const playerId = ws.playerId;

  if (sessions[sessionId] && playerId) {
    logger.info(
      { playerId, sessionId, gracePeriod: RECONNECT_GRACE_PERIOD_MS / 1000 },
      'Player disconnected (grace period started)'
    );

    // Store disconnected player info
    const session = sessions[sessionId];
    if (!session) {
      return;
    }

    session.players.delete(ws);

    const timeout = setTimeout(() => {
      // After grace period, remove player if still disconnected
      if (disconnectedPlayers.has(playerId)) {
        disconnectedPlayers.delete(playerId);

        const activeSession = sessions[sessionId];
        if (activeSession) {
          logger.info({ playerId, sessionId }, 'Player removed from session after timeout');

          // Notify host that player left
          const host = activeSession.host;
          if (host) {
            host.send(
              JSON.stringify({
                action: 'player-left',
                payload: { playerId },
              })
            );
          }

          // Notify all other players that this player left
          activeSession.players.forEach((playerWs) => {
            playerWs.send(
              JSON.stringify({
                action: 'player-left',
                payload: { playerId },
              })
            );
          });
        }
      }
    }, RECONNECT_GRACE_PERIOD_MS);

    disconnectedPlayers.set(playerId, {
      ws,
      sessionId,
      playerName: ws.playerName,
      disconnectTime: Date.now(),
      timeout,
    });
  }
}

function handleGameHostDisconnect(_ws, sessionId) {
  if (sessions[sessionId]) {
    // Notify all players in the session
    sessions[sessionId].players.forEach((playerWs) => {
      playerWs.send(
        JSON.stringify({
          action: 'session-closed',
          payload: { reason: 'Host disconnected' },
        })
      );
      playerWs.close();
    });
    deleteSession(sessionId);
    logger.info({ sessionId, openSessions: Object.keys(sessions).length }, 'Session deleted');
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

module.exports = { handleDisconnect };
