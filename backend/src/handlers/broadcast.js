const { sessions } = require('../sessions');

function handleBroadcast(ws, serverPayload) {
  const hostSessionId = ws.sessionId;
  if (hostSessionId && sessions[hostSessionId]) {
    sessions[hostSessionId].players.forEach((playerWs) => {
      playerWs.send(JSON.stringify(serverPayload));
    });
  }
}

module.exports = { handleBroadcast };
