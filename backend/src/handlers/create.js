const { sessions, createSession } = require('../sessions');
const { generateSessionId, sendError } = require('../utils');

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
  console.log(`Session created: ${newSessionId}. Open sessions: ${Object.keys(sessions).length}`);
}

module.exports = { handleCreate };
