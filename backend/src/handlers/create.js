const { sessions, createSession, disconnectedHosts } = require('../sessions');
const { generateSessionId, generatePlayerId, sendError } = require('../utils');
const logger = require('../logger');

function handleCreate(ws, serverPayload) {
  const reconnectHostId = serverPayload?.hostId; // For reconnection

  // Check if this is a reconnection attempt
  if (reconnectHostId && disconnectedHosts.has(reconnectHostId)) {
    const disconnectedHost = disconnectedHosts.get(reconnectHostId);
    const sessionId = disconnectedHost.sessionId;

    // Verify the session still exists
    if (sessions[sessionId]) {
      logger.info({ hostId: reconnectHostId, sessionId }, 'Host reconnecting');

      // Cancel the removal timeout
      clearTimeout(disconnectedHost.timeout);
      disconnectedHosts.delete(reconnectHostId);

      // Replace old WebSocket with new one
      sessions[sessionId].host = ws;
      ws.sessionId = sessionId;
      ws.hostId = reconnectHostId;

      // Send reconnection success
      ws.send(
        JSON.stringify({
          action: 'created',
          payload: {
            sessionId: sessionId,
            hostId: reconnectHostId,
          },
        })
      );

      logger.info({ hostId: reconnectHostId, sessionId }, 'Host successfully reconnected');
      return;
    } else {
      // Session no longer exists, remove from disconnected hosts
      disconnectedHosts.delete(reconnectHostId);
      logger.warn({ hostId: reconnectHostId }, 'Host reconnection failed - session no longer exists');
    }
  }

  // Create new session
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

  const hostId = generatePlayerId(); // Reuse playerId generator for hostId
  createSession(newSessionId, ws);
  ws.sessionId = newSessionId;
  ws.hostId = hostId;
  ws.send(
    JSON.stringify({
      action: 'created',
      payload: { sessionId: newSessionId, hostId: hostId },
    })
  );
  logger.info(
    { sessionId: newSessionId, hostId: hostId, openSessions: Object.keys(sessions).length },
    'Session created'
  );
}

module.exports = { handleCreate };
