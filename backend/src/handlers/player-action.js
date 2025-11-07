const { sessions } = require('../sessions');
const { sendError } = require('../utils');

function handlePlayerAction(ws, serverPayload) {
  const playerSessionId = ws.sessionId;
  if (playerSessionId && sessions[playerSessionId]) {
    try {
      // Add playerId to the payload so host knows which player sent the action
      const payloadWithPlayerId = {
        ...serverPayload,
        payload: {
          ...serverPayload.payload,
          playerId: ws.playerId,
        },
        serverTimestamp: Date.now(),
      };
      sessions[playerSessionId].host.send(JSON.stringify(payloadWithPlayerId));
    } catch (error) {
      console.error('Failed to send to host:', error);
      sendError(ws, 'Failed to forward action to host.');
    }
  } else {
    sendError(ws, 'Session does not exist.');
  }
}

module.exports = { handlePlayerAction };
