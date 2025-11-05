const { sessions, disconnectedPlayers, deleteSession } = require('../sessions');

// Don't remove immediately - give grace period for reconnection
const RECONNECT_GRACE_PERIOD_MS = 180000; // 3 minutes

function handlePlayerDisconnect(ws, sessionId) {
  const playerId = ws.playerId;

  if (sessions[sessionId] && playerId) {
    console.log(
      `Player ${playerId} disconnected from session ${sessionId}. Grace period: ${RECONNECT_GRACE_PERIOD_MS / 1000}s`
    );

    // Store disconnected player info
    const timeout = setTimeout(() => {
      // After grace period, remove player if still disconnected
      if (disconnectedPlayers.has(playerId)) {
        disconnectedPlayers.delete(playerId);

        if (sessions[sessionId]) {
          sessions[sessionId].players.delete(ws);
          console.log(`Player ${playerId} removed from session ${sessionId} after timeout`);

          // Notify host that player left
          const host = sessions[sessionId].host;
          if (host) {
            host.send(
              JSON.stringify({
                action: 'player-left',
                payload: { playerId },
              })
            );
          }

          // Notify all other players that this player left
          sessions[sessionId].players.forEach((playerWs) => {
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

    disconnectedPlayers.set(playerId, { ws, sessionId, disconnectTime: Date.now(), timeout });
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

module.exports = { handleDisconnect };
