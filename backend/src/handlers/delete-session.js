const { sessions, disconnectedHosts, deleteSession } = require('../sessions');
const logger = require('../logger');

function handleDeleteSession(ws) {
  const sessionId = ws.sessionId;
  const hostId = ws.hostId;

  if (!sessionId) {
    logger.warn({ hostId }, 'Delete session requested but no sessionId found');
    return;
  }

  const session = sessions[sessionId];
  if (!session) {
    logger.warn({ sessionId, hostId }, 'Delete session requested but session not found');
    return;
  }

  // Verify this is the host
  if (session.host !== ws) {
    logger.warn({ sessionId, hostId }, 'Delete session requested by non-host');
    return;
  }

  logger.info({ sessionId, hostId }, 'Host requested immediate session deletion');

  // Clear any grace period timeout for this host
  if (hostId && disconnectedHosts.has(hostId)) {
    const disconnectedHost = disconnectedHosts.get(hostId);
    if (disconnectedHost?.timeout) {
      clearTimeout(disconnectedHost.timeout);
      disconnectedHosts.delete(hostId);
      logger.debug({ hostId }, 'Cleared grace period timeout for host');
    }
  }

  // Notify all players that the session is closed
  session.players.forEach((playerWs) => {
    try {
      playerWs.send(
        JSON.stringify({
          action: 'session-closed',
          payload: { reason: 'Host left the game' },
        })
      );
      playerWs.close();
    } catch (error) {
      logger.error({ err: error }, 'Failed to notify player of session closure');
    }
  });

  // Delete the session
  deleteSession(sessionId);
  logger.info(
    { sessionId, openSessions: Object.keys(sessions).length },
    'Session deleted immediately'
  );

  // Close the host's WebSocket connection
  try {
    ws.close();
  } catch (error) {
    logger.error({ err: error }, 'Error closing host WebSocket');
  }
}

module.exports = { handleDeleteSession };
