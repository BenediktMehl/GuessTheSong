const { sessions } = require('../sessions');
const { sendError } = require('../utils');

function handlePlayerAction(ws, serverPayload) {
  const playerSessionId = ws.sessionId;
  if (playerSessionId && sessions[playerSessionId]) {
    sessions[playerSessionId].host.send(
      JSON.stringify({
        ...serverPayload,
        serverTimestamp: Date.now(),
      })
    );
  } else {
    sendError(ws, 'Session does not exist.');
  }
}

module.exports = { handlePlayerAction };
