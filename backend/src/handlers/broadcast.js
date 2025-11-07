const { sessions, updateSessionStatus } = require('../sessions');

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
        console.error('Failed to broadcast to player:', error);
      }
    });
  }
}

module.exports = { handleBroadcast };
