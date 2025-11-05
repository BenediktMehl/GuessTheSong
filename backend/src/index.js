const { httpServer, ws } = require('./server');
const { PORT, HOST, USE_TLS } = require('./config');
const { sendError } = require('./utils');
const { sessions, disconnectedPlayers, cleanupForTests } = require('./sessions');
const { handleJoin } = require('./handlers/join');
const { handleCreate } = require('./handlers/create');
const { handlePlayerAction } = require('./handlers/player-action');
const { handleBroadcast } = require('./handlers/broadcast');
const { handleDisconnect } = require('./handlers/disconnect');

ws.on('connection', (ws) => {
  ws.on('message', (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch (_e) {
      sendError(ws, 'Could not interpret the command (invalid JSON).');
      return;
    }

    const { serverAction, serverPayload } = data;

    switch (serverAction) {
      case 'join':
        handleJoin(ws, serverPayload);
        break;
      case 'create':
        handleCreate(ws);
        break;
      case 'player-action':
        handlePlayerAction(ws, serverPayload);
        break;
      case 'broadcast':
        handleBroadcast(ws, serverPayload);
        break;
      default:
        sendError(ws, `Unknown serverAction: ${serverAction}`);
    }
  });

  ws.on('close', () => {
    handleDisconnect(ws);
  });
});

// Only start listening if not in test mode (Jest sets NODE_ENV=test)
if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT, HOST, () => {
    const protocol = USE_TLS ? 'wss' : 'ws';
    console.log(`GuessTheSong backend listening on ${protocol}://${HOST}:${PORT}`);
  });
}

// Export server and cleanup function for testing purposes
module.exports = { httpServer, ws, cleanupForTests, disconnectedPlayers, sessions };
