const { sessions } = require('../sessions');
const { sendError } = require('../utils');

function handlePlayerAction(ws, serverPayload) {
  console.log('[Backend] handlePlayerAction called', {
    playerId: ws.playerId,
    playerName: ws.playerName,
    sessionId: ws.sessionId,
    serverPayload,
  });

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
      console.log('[Backend] Host WebSocket state:', {
        readyState: hostWs.readyState,
        OPEN: 1, // WebSocket.OPEN = 1
        isOpen: hostWs.readyState === 1,
      });

      if (hostWs.readyState !== 1) {
        console.error('[Backend] Host WebSocket is not open! State:', hostWs.readyState);
        sendError(ws, 'Host connection is not open.');
        return;
      }

      console.log('[Backend] Forwarding to host:', payloadWithPlayerId);
      try {
        hostWs.send(JSON.stringify(payloadWithPlayerId));
        console.log('[Backend] Message forwarded to host successfully');
      } catch (sendError) {
        console.error('[Backend] Error sending to host:', sendError);
        throw sendError;
      }
    } catch (error) {
      console.error('[Backend] Failed to send to host:', error);
      sendError(ws, 'Failed to forward action to host.');
    }
  } else {
    console.error('[Backend] Session does not exist', {
      playerSessionId,
      sessionExists: !!sessions[playerSessionId],
    });
    sendError(ws, 'Session does not exist.');
  }
}

module.exports = { handlePlayerAction };
