const sessions = {}; // sessionId -> { host: ws, players: Set<ws> }
const disconnectedPlayers = new Map(); // playerId -> { ws, sessionId, disconnectTime, timeout }
const disconnectedHosts = new Map(); // hostId -> { ws, sessionId, disconnectTime, timeout }

function getSession(sessionId) {
  return sessions[sessionId];
}

function createSession(sessionId, host) {
  sessions[sessionId] = { host, players: new Set(), status: 'notStarted' };
}

function deleteSession(sessionId) {
  delete sessions[sessionId];
}

function updateSessionStatus(sessionId, status) {
  if (sessions[sessionId]) {
    sessions[sessionId].status = status;
  }
}

function cleanupForTests() {
  // Clear all grace period timers
  disconnectedPlayers.forEach(({ timeout }) => {
    if (timeout) {
      clearTimeout(timeout);
    }
  });
  disconnectedPlayers.clear();

  disconnectedHosts.forEach(({ timeout }) => {
    if (timeout) {
      clearTimeout(timeout);
    }
  });
  disconnectedHosts.clear();

  // Clear all sessions
  Object.keys(sessions).forEach((key) => {
    delete sessions[key];
  });
}

module.exports = {
  sessions,
  disconnectedPlayers,
  disconnectedHosts,
  getSession,
  createSession,
  deleteSession,
  updateSessionStatus,
  cleanupForTests,
};
