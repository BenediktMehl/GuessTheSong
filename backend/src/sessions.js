const sessions = {}; // sessionId -> { host: ws, players: Set<ws> }
const disconnectedPlayers = new Map(); // playerId -> { ws, sessionId, disconnectTime, timeout }

function getSession(sessionId) {
  return sessions[sessionId];
}

function createSession(sessionId, host) {
  sessions[sessionId] = { host, players: new Set() };
}

function deleteSession(sessionId) {
  delete sessions[sessionId];
}

function cleanupForTests() {
  // Clear all grace period timers
  disconnectedPlayers.forEach(({ timeout }) => {
    if (timeout) {
      clearTimeout(timeout);
    }
  });
  disconnectedPlayers.clear();

  // Clear all sessions
  Object.keys(sessions).forEach((key) => {
    delete sessions[key];
  });
}

module.exports = {
  sessions,
  disconnectedPlayers,
  getSession,
  createSession,
  deleteSession,
  cleanupForTests,
};
