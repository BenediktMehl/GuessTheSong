const { sessions, createSession } = require('../sessions');
const { generateSessionId, sendError } = require('../utils');
const logger = require('../logger');

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

  createSession(newSessionId, ws);
  ws.sessionId = newSessionId;
  ws.send(
    JSON.stringify({
      action: 'created',
      payload: { sessionId: newSessionId },
    })
  );
  logger.info(
    { sessionId: newSessionId, openSessions: Object.keys(sessions).length },
    'Session created'
  );
}

module.exports = { handleCreate };
