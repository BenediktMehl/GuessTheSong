const { sessions, createSession, disconnectedHosts } = require('../sessions');
const { generateSessionId, sendError } = require('../utils');

function handleCreate(ws, serverPayload) {
  // Check if this is a reconnection attempt
  const reconnectSessionId = serverPayload?.reconnectSessionId?.toUpperCase();

  if (reconnectSessionId && disconnectedHosts.has(reconnectSessionId)) {
    const disconnectedHost = disconnectedHosts.get(reconnectSessionId);
    const session = sessions[reconnectSessionId];

    if (session) {
      console.log(`Host reconnecting to session ${reconnectSessionId}`);

      // Cancel the removal timeout
      clearTimeout(disconnectedHost.timeout);
      disconnectedHosts.delete(reconnectSessionId);

      // Restore host connection
      session.host = ws;
      ws.sessionId = reconnectSessionId;

      // Get list of all players for the reconnecting host
      const allPlayers = Array.from(session.players).map((p) => ({
        id: p.playerId,
        name: p.playerName,
        points: 0, // Initial points (could be enhanced to track actual points)
      }));

      // Send reconnection success with existing sessionId and players
      ws.send(
        JSON.stringify({
          action: 'created',
          payload: {
            sessionId: reconnectSessionId,
            players: allPlayers,
            reconnected: true,
          },
        })
      );

      console.log(
        `Host successfully reconnected to session ${reconnectSessionId}. Players in session: ${session.players.size}`
      );
      return;
    }
  }

  // Create new session (normal flow or reconnection failed)
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

  createSession(newSessionId, ws);
  ws.sessionId = newSessionId;
  ws.send(
    JSON.stringify({
      action: 'created',
      payload: { sessionId: newSessionId },
    })
  );
  console.log(`Session created: ${newSessionId}. Open sessions: ${Object.keys(sessions).length}`);
}

module.exports = { handleCreate };
