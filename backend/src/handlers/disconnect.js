const { sessions, disconnectedPlayers, disconnectedHosts, deleteSession } = require('../sessions');

// Don't remove immediately - give grace period for reconnection
const RECONNECT_GRACE_PERIOD_MS = 180000; // 3 minutes

function handlePlayerDisconnect(ws, sessionId) {
  const playerId = ws.playerId;

  if (sessions[sessionId] && playerId) {
    console.log(
      `Player ${playerId} disconnected from session ${sessionId}. Grace period: ${RECONNECT_GRACE_PERIOD_MS / 1000}s`
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
          console.log(`Player ${playerId} removed from session ${sessionId} after timeout`);

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
  const session = sessions[sessionId];
  if (!session) {
    return;
  }

  console.log(
    `Host disconnected from session ${sessionId}. Grace period: ${RECONNECT_GRACE_PERIOD_MS / 1000}s`
  );

  // Store disconnected host info for reconnection
  const timeout = setTimeout(() => {
    // After grace period, delete session if host hasn't reconnected
    if (disconnectedHosts.has(sessionId)) {
      disconnectedHosts.delete(sessionId);

      const activeSession = sessions[sessionId];
      if (activeSession) {
        console.log(`Session ${sessionId} deleted after host timeout`);

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
        console.log(
          `Session deleted: ${sessionId}. Open sessions: ${Object.keys(sessions).length}`
        );
      }
    }
  }, RECONNECT_GRACE_PERIOD_MS);

  // Store disconnected host info
  disconnectedHosts.set(sessionId, {
    ws,
    sessionId,
    disconnectTime: Date.now(),
    timeout,
  });

  // Clear the host from the session but keep the session alive
  session.host = null;
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
