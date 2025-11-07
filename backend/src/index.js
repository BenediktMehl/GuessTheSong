// Load environment variables from .env.local at the repository root
// Look for the file at the repository root (two levels up from backend/src/)
const fs = require('node:fs');
const path = require('node:path');
const logger = require('./logger');

const envLocalPath = path.join(__dirname, '../../', '.env.local');

if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
  logger.info('Loaded environment variables from .env.local');
} else {
  logger.warn('Warning: .env.local not found at repository root. Some features may not work.');
}

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
      logger.debug({ msg: data }, 'Received raw message');
    } catch (_e) {
      logger.error({ err: _e }, 'Failed to parse JSON');
      sendError(ws, 'Could not interpret the command (invalid JSON).');
      return;
    }

    const { serverAction, serverPayload } = data;
    logger.debug({ serverAction, serverPayload }, 'Parsed message');

    try {
      switch (serverAction) {
        case 'join':
          logger.debug('Handling join');
          handleJoin(ws, serverPayload);
          break;
        case 'create':
          logger.debug('Handling create');
          handleCreate(ws);
          break;
        case 'player-action':
          logger.debug('Handling player-action');
          handlePlayerAction(ws, serverPayload);
          break;
        case 'broadcast':
          logger.debug('Handling broadcast');
          handleBroadcast(ws, serverPayload);
          break;
        default:
          logger.error({ serverAction }, 'Unknown serverAction');
          sendError(ws, `Unknown serverAction: ${serverAction}`);
      }
    } catch (error) {
      logger.error({ err: error }, 'Handler error');
      sendError(ws, 'Internal server error.');
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
    logger.info(`GuessTheSong backend listening on ${protocol}://${HOST}:${PORT}`);
  });
}

// Export server and cleanup function for testing purposes
module.exports = { httpServer, ws, cleanupForTests, disconnectedPlayers, sessions };
