const { sessions } = require('../sessions');
const { sendError } = require('../utils');
const logger = require('../logger');

function handlePlayerAction(ws, serverPayload) {
  logger.debug(
    { playerId: ws.playerId, playerName: ws.playerName, sessionId: ws.sessionId, serverPayload },
    'handlePlayerAction called'
  );

  const playerSessionId = ws.sessionId;
  if (playerSessionId && sessions[playerSessionId]) {
    try {
      // Get player name from the WebSocket (it's stored when player joins)
      const playerName = ws.playerName || 'Unknown Player';

      // Add playerId and playerName to the payload so host knows which player sent the action
      const payloadWithPlayerId = {
        ...serverPayload,
        payload: {
          ...(serverPayload.payload || {}),
          playerId: ws.playerId,
          playerName: playerName, // Include player name so host doesn't need to look it up
        },
        serverTimestamp: Date.now(),
      };
      const hostWs = sessions[playerSessionId].host;
      logger.debug(
        { readyState: hostWs.readyState, isOpen: hostWs.readyState === 1 },
        'Host WebSocket state'
      );

      if (hostWs.readyState !== 1) {
        logger.error({ readyState: hostWs.readyState }, 'Host WebSocket is not open');
        sendError(ws, 'Host connection is not open.');
        return;
      }

      logger.debug({ payload: payloadWithPlayerId }, 'Forwarding to host');
      try {
        hostWs.send(JSON.stringify(payloadWithPlayerId));
        logger.debug('Message forwarded to host successfully');
      } catch (sendErr) {
        logger.error({ err: sendErr }, 'Error sending to host');
        throw sendErr;
      }
    } catch (error) {
      logger.error({ err: error }, 'Failed to send to host');
      sendError(ws, 'Failed to forward action to host.');
    }
  } else {
    logger.error(
      { playerSessionId, sessionExists: !!sessions[playerSessionId] },
      'Session does not exist'
    );
    sendError(ws, 'Session does not exist.');
  }
}

module.exports = { handlePlayerAction };
