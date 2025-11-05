const crypto = require('node:crypto');

function generateSessionId() {
  // Generates a random 4-letter uppercase session ID
  return crypto.randomBytes(2).toString('hex').toUpperCase();
}

function generatePlayerId() {
  // Generates a UUID for player ID
  return crypto.randomUUID();
}

function sendError(ws, message) {
  ws.send(
    JSON.stringify({
      action: 'error',
      payload: { message },
    })
  );
}

module.exports = {
  generateSessionId,
  generatePlayerId,
  sendError,
};
