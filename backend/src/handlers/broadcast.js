const { sessions } = require('../sessions');

function handleBroadcast(ws, serverPayload) {
  const hostSessionId = ws.sessionId;
  if (hostSessionId && sessions[hostSessionId]) {
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
