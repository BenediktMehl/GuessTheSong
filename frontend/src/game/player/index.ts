import { WS_URL } from '../../config';
import type { GameContextType, Player } from '../context';

// WebSocket message types
type WebSocketMessage = {
  action: string;
  payload: {
    playerId?: string;
    name?: string;
    players?: Array<{ id: string; name: string; points: number }>;
    reason?: string;
    status?: string;
    [key: string]: unknown;
  };
};

type JoinPayload = {
  sessionId: string;
  name: string;
  playerId?: string;
};

// Reference to store websocket connection between function calls
let ws: WebSocket | null = null;

// Store the player's ID and session info for reconnection
let currentPlayerId: string | null = null;
let currentSessionId: string | null = null;
let currentPlayerName: string | null = null;
let reconnectAttempts = 0;
let reconnectTimeout: number | null = null;
const MAX_RECONNECT_ATTEMPTS = 3;
let hasFailed = false; // Track if we've permanently failed

function attemptReconnect(gameContext: GameContextType) {
  if (!currentSessionId || !currentPlayerName || !currentPlayerId) {
    return;
  }

  if (hasFailed || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    hasFailed = true;
    gameContext.setWsStatus('failed');
    return;
  }

  reconnectTimeout = window.setTimeout(
    () => {
      reconnectAttempts++;
      if (currentPlayerName && currentSessionId) {
        joinGame(gameContext, currentPlayerName, currentSessionId, currentPlayerId || undefined);
      }
    },
    1000 * (reconnectAttempts + 1)
  ); // 1s, 2s, 3s
}

export function joinGame(
  gameContext: GameContextType,
  playerName: string,
  sessionId: string,
  playerId?: string
): Promise<{ success: boolean; status?: string }> {
  // Check if we've already permanently failed
  if (hasFailed) {
    gameContext.setWsStatus('failed');
    return Promise.resolve({ success: false });
  }

  // Set status to connecting
  gameContext.setWsStatus('connecting');

  // Store for reconnection
  currentPlayerName = playerName;
  currentSessionId = sessionId;

  return new Promise((resolve) => {
    // Close existing connection if any
    if (ws) {
      ws.close();
    }

    ws = new WebSocket(WS_URL);

    // Set a timeout in case connection fails
    const timeout = setTimeout(() => {
      if (ws?.readyState !== WebSocket.OPEN) {
        gameContext.setWsStatus('closed');
        ws?.close(); // This will trigger onclose
        resolve({ success: false });
      }
    }, 5000);

    ws.onopen = () => {
      clearTimeout(timeout);
      if (ws) {
        const payload: JoinPayload = {
          sessionId: sessionId,
          name: playerName,
        };

        // Include playerId for reconnection
        if (playerId) {
          payload.playerId = playerId;
        }

        ws.send(
          JSON.stringify({
            serverAction: 'join',
            serverPayload: payload,
          })
        );
      } else {
        gameContext.setWsStatus('closed');
        resolve({ success: false });
      }
    };

    ws.onclose = () => {
      gameContext.setWsStatus('closed');

      // Attempt to reconnect if we have session info (for reconnects)
      // OR if we haven't exceeded max attempts yet (for initial connection failures)
      if (currentSessionId && currentPlayerId) {
        attemptReconnect(gameContext);
      } else if (
        currentSessionId &&
        currentPlayerName &&
        reconnectAttempts < MAX_RECONNECT_ATTEMPTS
      ) {
        // Initial connection failed, retry
        const delay = 1000 * (reconnectAttempts + 1); // 1s, 2s, 3s
        reconnectTimeout = window.setTimeout(() => {
          reconnectAttempts++;
          if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            hasFailed = true;
            gameContext.setWsStatus('failed');
          } else {
            if (currentPlayerName && currentSessionId) {
              joinGame(gameContext, currentPlayerName, currentSessionId, undefined);
            }
          }
        }, delay);
      }
    };

    ws.onerror = () => {
      resolve({ success: false });
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('Received message:', message);

        switch (message.action) {
          case 'join-success': {
            currentPlayerId = message.payload.playerId;
            reconnectAttempts = 0; // Reset on successful connection
            hasFailed = false; // Reset failed flag on success
            if (reconnectTimeout) {
              clearTimeout(reconnectTimeout);
              reconnectTimeout = null;
            }
            gameContext.setSessionId(sessionId);
            gameContext.setWsStatus('open');
            gameContext.setCurrentPlayerId(message.payload.playerId);

            // Set initial players list if provided
            if (message.payload.players && Array.isArray(message.payload.players)) {
              console.log('Setting initial players list:', message.payload.players);
              gameContext.setPlayers(message.payload.players);
            }

            // Set game status if provided (for players joining an active game)
            const gameStatus = message.payload.status as
              | 'notStarted'
              | 'waiting'
              | 'listening'
              | 'guessing'
              | 'finished'
              | undefined;
            if (gameStatus) {
              console.log('Setting game status from join-success:', gameStatus);
              gameContext.setStatus(gameStatus);
            } else {
              // Default to 'notStarted' if no status provided (backwards compatibility)
              gameContext.setStatus('notStarted');
            }

            resolve({ success: true, status: gameStatus || 'notStarted' });
            break;
          }

          case 'player-joined':
            // Another player joined the session
            handlePlayerJoinedForPlayer(gameContext, message);
            break;

          case 'player-left':
            // Another player left the session
            handlePlayerLeftForPlayer(gameContext, message.payload.playerId);
            break;

          case 'game-started':
            // Game has been started by the host
            console.log('Game started!');
            gameContext.setStatus('waiting');
            break;

          case 'playersChanged':
            // Players list updated (points, etc.)
            if (message.data?.players && Array.isArray(message.data.players)) {
              gameContext.setPlayers(message.data.players);
            }
            break;

          case 'waitingPlayersChanged':
            // Waiting players queue updated
            if (message.data?.buzzedPlayers && Array.isArray(message.data.buzzedPlayers)) {
              gameContext.setWaitingPlayers(message.data.buzzedPlayers);
            }
            break;

          case 'guessedPlayersChanged':
            // Guessed players list updated
            if (message.data?.guessedPlayers && Array.isArray(message.data.guessedPlayers)) {
              gameContext.setGuessedPlayers(message.data.guessedPlayers);
            }
            break;

          case 'join-failed':
            console.error('Failed to join game:', message.payload.reason);
            resolve({ success: false });
            break;

          case 'session-closed':
            console.log('Game session closed:', message.payload.reason);
            alert(`The game session has ended: ${message.payload.reason}`);
            window.location.href = '/';
            break;

          case 'error':
            console.error('Server error:', message.payload.message);
            break;

          default:
            console.log('Unknown message action:', message.action);
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    };
  });
}

function handlePlayerJoinedForPlayer(gameContext: GameContextType, msg: WebSocketMessage) {
  const playerId = msg.payload.playerId;
  const playerName = msg.payload.name;

  if (!playerId || !playerName) {
    console.error('Invalid player data: missing playerId or name', msg.payload);
    return;
  }

  const newPlayer: Player = {
    id: playerId,
    name: playerName,
    points: 0,
  };
  console.log('Player joined (player perspective):', newPlayer);

  gameContext.setPlayers((currentPlayers) => {
    // Check if player already exists (avoid duplicates)
    if (currentPlayers.some((p) => p.id === newPlayer.id)) {
      return currentPlayers;
    }
    return [...currentPlayers, newPlayer];
  });
}

function handlePlayerLeftForPlayer(gameContext: GameContextType, playerId: string) {
  console.log('Player left (player perspective):', playerId);

  gameContext.setPlayers((currentPlayers) =>
    currentPlayers.filter((player) => player.id !== playerId)
  );
}

export function sendPlayerAction(action: string, payload?: Record<string, unknown>) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.error('WebSocket is not connected');
    return false;
  }

  try {
    ws.send(
      JSON.stringify({
        action: 'player-action',
        payload: {
          action,
          payload,
          localTimestamp: Date.now(),
        },
      })
    );
    return true;
  } catch (error) {
    console.error('Error sending action:', error);
    return false;
  }
}

export function sendPlayerBuzzedAction(): boolean {
  return sendPlayerAction('player-buzzed');
}

export function disconnectFromGame() {
  if (ws) {
    ws.close();
    ws = null;
    currentPlayerId = null;
  }
  // Reset reconnection state on manual disconnect
  reconnectAttempts = 0;
  hasFailed = false;
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
}

export function isConnected(): boolean {
  return ws !== null && ws.readyState === WebSocket.OPEN;
}
