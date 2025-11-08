const { sessions, updateSessionStatus } = require('../sessions');
const logger = require('../logger');

function handleBroadcast(ws, serverPayload) {
  const hostSessionId = ws.sessionId;
  if (hostSessionId && sessions[hostSessionId]) {
    // Update session status if game-started is being broadcast
    if (serverPayload.action === 'game-started') {
      updateSessionStatus(hostSessionId, 'waiting');
    }

    sessions[hostSessionId].players.forEach((playerWs) => {
      try {
        playerWs.send(JSON.stringify(serverPayload));
      } catch (error) {
        logger.error({ err: error }, 'Failed to broadcast to player');
      }
    });
  }
}

module.exports = { handleBroadcast };
