const { sessions, disconnectedPlayers, disconnectedHosts, deleteSession } = require('../sessions');
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

function handleGameHostDisconnect(ws, sessionId) {
  const hostId = ws.hostId;

  if (sessions[sessionId] && hostId) {
    logger.info(
      { hostId, sessionId, gracePeriod: RECONNECT_GRACE_PERIOD_MS / 1000 },
      'Host disconnected (grace period started)'
    );

    // Store disconnected host info
    const session = sessions[sessionId];
    if (!session) {
      return;
    }

    const timeout = setTimeout(() => {
      // After grace period, delete session if host hasn't reconnected
      if (disconnectedHosts.has(hostId)) {
        disconnectedHosts.delete(hostId);

        const activeSession = sessions[sessionId];
        if (activeSession) {
          logger.info({ hostId, sessionId }, 'Session deleted after host timeout');

          // Notify all players in the session
          activeSession.players.forEach((playerWs) => {
            playerWs.send(
              JSON.stringify({
                action: 'session-closed',
                payload: { reason: 'Host disconnected' },
              })
            );
            playerWs.close();
          });
          deleteSession(sessionId);
        }
      }
    }, RECONNECT_GRACE_PERIOD_MS);

    disconnectedHosts.set(hostId, {
      ws,
      sessionId,
      disconnectTime: Date.now(),
      timeout,
    });
  } else if (sessions[sessionId] && !hostId) {
    // Legacy case: host without hostId - delete immediately
    logger.warn({ sessionId }, 'Host disconnected without hostId - deleting session immediately');
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
