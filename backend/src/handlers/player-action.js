const { sessions } = require('../sessions');
const { sendError } = require('../utils');

function handlePlayerAction(ws, serverPayload) {
  const playerSessionId = ws.sessionId;
  if (playerSessionId && sessions[playerSessionId]) {
    if (playerSessionId && sessions[playerSessionId]) {
      try {
        sessions[playerSessionId].host.send(
          JSON.stringify({
            ...serverPayload,
            serverTimestamp: Date.now(),
          })
        );
      } catch (error) {
        console.error('Failed to send to host:', error);
        sendError(ws, 'Failed to forward action to host.');
      }
    } else {
  } else {
    sendError(ws, 'Session does not exist.');
  }
}

module.exports = { handlePlayerAction };
