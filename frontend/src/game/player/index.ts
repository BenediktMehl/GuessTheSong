import { WS_URL } from '../../config';
import logger from '../../utils/logger';
import { clearPlayerData, savePlayerData } from '../../utils/playerStorage';
import type { GameContextType, Player } from '../context';

// WebSocket message types
type WebSocketMessage = {
  action: string;
  payload?: {
    playerId?: string;
    name?: string;
    players?: Array<{ id: string; name: string; points: number }>;
    reason?: string;
    status?: string;
    [key: string]: unknown;
  };
  data?: {
    playerId?: string;
    playerName?: string;
    players?: Array<{ id: string; name: string; points: number }>;
    buzzedPlayers?: Array<{ id: string; name: string; points: number }>;
    guessedPlayers?: Array<{ id: string; name: string; points: number }>;
    partiallyGuessedPlayers?: Array<{ id: string; name: string; points: number }>;
    noCluePlayers?: Array<{ id: string; name: string; points: number }>;
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

// Track if we've shown a new song toast to avoid duplicates
let newSongToastShown = false;
let newSongToastTimeout: number | null = null;
// Track if we're expecting a new song (set when player-guessed-right is received)
let expectingNewSong = false;

// Helper function to show toast notification
function showToast(
  gameContext: GameContextType,
  message: string,
  type: 'success' | 'warning' | 'error' | 'info',
  duration?: number
) {
  gameContext.setPlayerToasts((prev) => [...prev, { message, type, duration }]);
}

// Helper function to get player name from playerId
function getPlayerName(gameContext: GameContextType, playerId: string | undefined): string {
  if (!playerId) {
    return 'Someone';
  }
  const player = gameContext.players.find((p) => p.id === playerId);
  return player?.name || 'Someone';
}

// Helper function to show new song toast if not already shown
function showNewSongToast(gameContext: GameContextType) {
  if (!newSongToastShown) {
    newSongToastShown = true;
    showToast(gameContext, 'New song starting!', 'info', 3000);
    // Reset flag after a delay to allow showing again for next song
    if (newSongToastTimeout) {
      clearTimeout(newSongToastTimeout);
    }
    newSongToastTimeout = window.setTimeout(() => {
      newSongToastShown = false;
      newSongToastTimeout = null;
    }, 5000);
  }
}

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
        logger.debug('[Player] Received message:', message);

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

            // Save player data to localStorage for future reconnection
            if (message.payload.playerId && sessionId && playerName) {
              savePlayerData(message.payload.playerId, sessionId, playerName);
            }

            // Set initial players list if provided
            if (message.payload.players && Array.isArray(message.payload.players)) {
              logger.debug('Setting initial players list:', message.payload.players);
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
              logger.debug('Setting game status from join-success:', gameStatus);
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
            if (message.payload?.playerId) {
              handlePlayerLeftForPlayer(gameContext, message.payload.playerId);
            }
            break;

          case 'game-started':
            // Game has been started by the host
            logger.info('Game started!');
            gameContext.setStatus('waiting');
            showToast(gameContext, 'Game started!', 'info', 3000);
            break;

          case 'playersChanged':
            // Players list updated (points, etc.)
            if (message.data?.players && Array.isArray(message.data.players)) {
              logger.debug('[Player] Players list updated, syncing points');
              const updatedPlayers = message.data.players;
              gameContext.setPlayers(updatedPlayers);

              // After updating players list, sync waiting and guessed players to ensure correct points
              // This ensures that when points are updated, they are reflected in all lists
              gameContext.setWaitingPlayers((currentWaiting) => {
                if (currentWaiting.length === 0) {
                  return [];
                }
                const synced = currentWaiting.map((listPlayer) => {
                  const playerWithPoints = updatedPlayers.find(
                    (p: Player) => p.id === listPlayer.id
                  );
                  if (playerWithPoints) {
                    logger.debug(
                      '[Player] Syncing waiting player points:',
                      listPlayer.name,
                      listPlayer.points,
                      '->',
                      playerWithPoints.points
                    );
                  }
                  return playerWithPoints || listPlayer;
                });
                return synced;
              });

              gameContext.setGuessedPlayers((currentGuessed) => {
                if (currentGuessed.length === 0) {
                  return [];
                }
                const synced = currentGuessed.map((listPlayer) => {
                  const playerWithPoints = updatedPlayers.find(
                    (p: Player) => p.id === listPlayer.id
                  );
                  if (playerWithPoints) {
                    logger.debug(
                      '[Player] Syncing guessed player points:',
                      listPlayer.name,
                      listPlayer.points,
                      '->',
                      playerWithPoints.points
                    );
                  }
                  return playerWithPoints || listPlayer;
                });
                return synced;
              });

              gameContext.setPartiallyGuessedPlayers((currentPartiallyGuessed) => {
                if (currentPartiallyGuessed.length === 0) {
                  return [];
                }
                const synced = currentPartiallyGuessed.map((listPlayer) => {
                  const playerWithPoints = updatedPlayers.find(
                    (p: Player) => p.id === listPlayer.id
                  );
                  if (playerWithPoints) {
                    console.log(
                      '[Player] Syncing partially guessed player points:',
                      listPlayer.name,
                      listPlayer.points,
                      '->',
                      playerWithPoints.points
                    );
                  }
                  return playerWithPoints || listPlayer;
                });
                return synced;
              });
            }
            break;

          case 'waitingPlayersChanged':
            // Waiting players queue updated
            if (
              message.data?.buzzedPlayers !== undefined &&
              Array.isArray(message.data.buzzedPlayers)
            ) {
              // Handle empty array (reset) or populated array
              const waitingCleared = message.data.buzzedPlayers.length === 0;
              if (waitingCleared) {
                // Clear waiting list - all players reset for new round
                logger.debug('[Player] Clearing waiting players list');
                gameContext.setWaitingPlayers([]);
                // Only show new song toast if we're expecting a new song (not just a wrong guess)
                // Use a small delay to allow other state updates to complete
                setTimeout(() => {
                  if (
                    expectingNewSong &&
                    gameContext.waitingPlayers.length === 0 &&
                    gameContext.guessedPlayers.length === 0 &&
                    gameContext.partiallyGuessedPlayers.length === 0
                  ) {
                    showNewSongToast(gameContext);
                    expectingNewSong = false; // Clear flag after showing toast
                  }
                }, 200);
              } else {
                // Sync points from main players list to ensure correct points are displayed
                // Use functional update to get the latest players list
                gameContext.setWaitingPlayers((_currentWaiting) => {
                  const syncedWaitingPlayers = message.data.buzzedPlayers.map(
                    (listPlayer: Player) => {
                      // Get latest players list from context
                      const playerWithPoints = gameContext.players.find(
                        (p) => p.id === listPlayer.id
                      );
                      if (playerWithPoints && playerWithPoints.points !== listPlayer.points) {
                        logger.debug(
                          '[Player] Syncing waiting player points:',
                          listPlayer.name,
                          listPlayer.points,
                          '->',
                          playerWithPoints.points
                        );
                      }
                      return playerWithPoints || listPlayer;
                    }
                  );
                  return syncedWaitingPlayers;
                });
              }
            }
            break;

          case 'guessedPlayersChanged':
            // Guessed players list updated
            if (
              message.data?.guessedPlayers !== undefined &&
              Array.isArray(message.data.guessedPlayers)
            ) {
              // Handle empty array (reset) or populated array
              const guessedCleared = message.data.guessedPlayers.length === 0;
              if (guessedCleared) {
                // Clear guessed list - all players reset for new round
                logger.debug('[Player] Clearing guessed players list');
                gameContext.setGuessedPlayers([]);
                // Only show new song toast if we're expecting a new song (not just a wrong guess)
                // Use a small delay to allow other state updates to complete
                setTimeout(() => {
                  if (
                    expectingNewSong &&
                    gameContext.waitingPlayers.length === 0 &&
                    gameContext.guessedPlayers.length === 0 &&
                    gameContext.partiallyGuessedPlayers.length === 0
                  ) {
                    showNewSongToast(gameContext);
                    expectingNewSong = false; // Clear flag after showing toast
                  }
                }, 200);
              } else {
                // Sync points from main players list to ensure correct points are displayed
                // Use functional update to get the latest players list
                gameContext.setGuessedPlayers((_currentGuessed) => {
                  const syncedGuessedPlayers = message.data.guessedPlayers.map(
                    (listPlayer: Player) => {
                      // Get latest players list from context
                      const playerWithPoints = gameContext.players.find(
                        (p) => p.id === listPlayer.id
                      );
                      if (playerWithPoints && playerWithPoints.points !== listPlayer.points) {
                        logger.debug(
                          '[Player] Syncing guessed player points:',
                          listPlayer.name,
                          listPlayer.points,
                          '->',
                          playerWithPoints.points
                        );
                      }
                      return playerWithPoints || listPlayer;
                    }
                  );
                  return syncedGuessedPlayers;
                });
              }
            }
            break;

          case 'player-guessed-right': {
            // Player guessed right - reset all lists for new round
            // The host sends empty arrays via waitingPlayersChanged and guessedPlayersChanged,
            // but we also handle this message explicitly to ensure cleanup
            logger.info('[Player] Player guessed right - resetting lists', message);
            const rightPlayerId = message.data?.playerId || message.payload?.playerId;
            const rightPlayerName =
              message.data?.playerName || getPlayerName(gameContext, rightPlayerId);
            const toastMessage = `${rightPlayerName} guessed correctly! Next song starts now.`;
            logger.info('[Player] Showing success toast:', toastMessage);
            showToast(gameContext, toastMessage, 'success', 4000);
            // Set flag to indicate we're expecting a new song
            // The list clearing handlers will show the new song toast when lists are cleared
            expectingNewSong = true;
            // Lists will be cleared by waitingPlayersChanged and guessedPlayersChanged messages
            break;
          }

          case 'player-guessed-partially': {
            // Player guessed partially - they are moved to partiallyGuessedPlayers list
            logger.info('[Player] Player guessed partially', message);
            const partialPlayerId = message.data?.playerId || message.payload?.playerId;
            const partialPlayerName =
              message.data?.playerName || getPlayerName(gameContext, partialPlayerId);
            // Determine next player after state updates process
            // Use a small delay to allow state updates from waitingPlayersChanged to process
            setTimeout(() => {
              const nextWaitingPlayer = gameContext.waitingPlayers[0];
              const toastMessage = nextWaitingPlayer
                ? `${partialPlayerName} guessed partially correct. ${nextWaitingPlayer.name} can guess now.`
                : `${partialPlayerName} guessed partially correct. Song continues now.`;
              logger.info('[Player] Showing warning toast:', toastMessage);
              showToast(gameContext, toastMessage, 'warning', 4000);
            }, 100);
            // The partiallyGuessedPlayersChanged message will handle the state update
            break;
          }

          case 'player-guessed-wrong': {
            // Player guessed wrong - they are moved to guessedPlayers list
            logger.info('[Player] Player guessed wrong', message);
            const wrongPlayerId = message.data?.playerId || message.payload?.playerId;
            const wrongPlayerName =
              message.data?.playerName || getPlayerName(gameContext, wrongPlayerId);
            // Determine next player after state updates process
            // Use a small delay to allow state updates from waitingPlayersChanged to process
            setTimeout(() => {
              const nextWaitingPlayer = gameContext.waitingPlayers[0];
              const toastMessage = nextWaitingPlayer
                ? `${wrongPlayerName} guessed wrong. ${nextWaitingPlayer.name} can guess now.`
                : `${wrongPlayerName} guessed wrong. Song continues now.`;
              logger.info('[Player] Showing error toast:', toastMessage);
              showToast(gameContext, toastMessage, 'error', 4000);
            }, 100);
            // The waitingPlayersChanged and guessedPlayersChanged messages will handle the state update
            break;
          }

          case 'partiallyGuessedPlayersChanged':
            // Partially guessed players list updated
            if (
              message.data?.partiallyGuessedPlayers !== undefined &&
              Array.isArray(message.data.partiallyGuessedPlayers)
            ) {
              // Handle empty array (reset) or populated array
              const partiallyCleared = message.data.partiallyGuessedPlayers.length === 0;
              if (partiallyCleared) {
                // Clear partially guessed list - all players reset for new round
                console.log('[Player] Clearing partially guessed players list');
                gameContext.setPartiallyGuessedPlayers([]);
                // Only show new song toast if we're expecting a new song (not just a wrong guess)
                // Use a small delay to allow other state updates to complete
                setTimeout(() => {
                  if (
                    expectingNewSong &&
                    gameContext.waitingPlayers.length === 0 &&
                    gameContext.guessedPlayers.length === 0 &&
                    gameContext.partiallyGuessedPlayers.length === 0
                  ) {
                    showNewSongToast(gameContext);
                    expectingNewSong = false; // Clear flag after showing toast
                  }
                }, 200);
              } else {
                // Sync points from main players list to ensure correct points are displayed
                // Use functional update to get the latest players list
                gameContext.setPartiallyGuessedPlayers((_currentPartiallyGuessed) => {
                  const syncedPartiallyGuessedPlayers = message.data.partiallyGuessedPlayers.map(
                    (listPlayer: Player) => {
                      // Get latest players list from context
                      const playerWithPoints = gameContext.players.find(
                        (p) => p.id === listPlayer.id
                      );
                      if (playerWithPoints && playerWithPoints.points !== listPlayer.points) {
                        console.log(
                          '[Player] Syncing partially guessed player points:',
                          listPlayer.name,
                          listPlayer.points,
                          '->',
                          playerWithPoints.points
                        );
                      }
                      return playerWithPoints || listPlayer;
                    }
                  );
                  return syncedPartiallyGuessedPlayers;
                });
              }
            }
            break;

          case 'noCluePlayersChanged':
            // No clue players list updated
            if (
              message.data?.noCluePlayers !== undefined &&
              Array.isArray(message.data.noCluePlayers)
            ) {
              // Handle empty array (reset) or populated array
              const noClueCleared = message.data.noCluePlayers.length === 0;
              if (noClueCleared) {
                // Clear no clue list - all players reset for new round
                logger.debug('[Player] Clearing no clue players list');
                gameContext.setNoCluePlayers([]);
              } else {
                // Sync points from main players list to ensure correct points are displayed
                // Use functional update to get the latest players list
                gameContext.setNoCluePlayers((_currentNoClue) => {
                  const syncedNoCluePlayers = message.data.noCluePlayers.map(
                    (listPlayer: Player) => {
                      // Get latest players list from context
                      const playerWithPoints = gameContext.players.find(
                        (p) => p.id === listPlayer.id
                      );
                      if (playerWithPoints && playerWithPoints.points !== listPlayer.points) {
                        logger.debug(
                          '[Player] Syncing no clue player points:',
                          listPlayer.name,
                          listPlayer.points,
                          '->',
                          playerWithPoints.points
                        );
                      }
                      return playerWithPoints || listPlayer;
                    }
                  );
                  return syncedNoCluePlayers;
                });
              }
            }
            break;

          case 'lastSongChanged':
            // Last song info updated (when a song ends)
            if (message.data?.lastSong !== undefined) {
              const lastSong = message.data.lastSong;
              console.log('[Player] Last song changed:', lastSong);
              gameContext.setLastSong(lastSong);
            }
            break;

          case 'player-buzzed-notification':
            logger.debug('[Player] Handling player-buzzed-notification:', message);
            handlePlayerBuzzedNotificationForPlayer(gameContext, message);
            break;

          case 'no-points-toast': {
            // No one got any points in the round
            logger.info('[Player] No points toast received');
            const noPointsMessage =
              message.data?.message || 'Next song playing. No one got any points.';
            showToast(gameContext, noPointsMessage, 'error', 4000);
            break;
          }

          case 'join-failed':
            logger.error('Failed to join game:', message.payload.reason);
            // If session doesn't exist, clear stored data
            if (message.payload.reason === 'Session does not exist.') {
              clearPlayerData();
            }
            resolve({ success: false });
            break;

          case 'session-closed':
            logger.info('Game session closed:', message.payload.reason);
            alert(`The game session has ended: ${message.payload.reason}`);
            window.location.href = '/';
            break;

          case 'error':
            logger.error('Server error:', message.payload.message);
            break;

          default:
            logger.warn('Unknown message action:', message.action);
        }
      } catch (error) {
        logger.error('Error processing message:', error);
      }
    };
  });
}

function handlePlayerJoinedForPlayer(gameContext: GameContextType, msg: WebSocketMessage) {
  const playerId = msg.payload?.playerId;
  const playerName = msg.payload?.name;

  if (!playerId || !playerName) {
    logger.error('Invalid player data: missing playerId or name', msg.payload);
    return;
  }

  const newPlayer: Player = {
    id: playerId,
    name: playerName,
    points: 0,
  };
  logger.debug('Player joined (player perspective):', newPlayer);

  gameContext.setPlayers((currentPlayers) => {
    // Check if player already exists (avoid duplicates)
    if (currentPlayers.some((p) => p.id === newPlayer.id)) {
      return currentPlayers;
    }
    return [...currentPlayers, newPlayer];
  });
}

function handlePlayerLeftForPlayer(gameContext: GameContextType, playerId: string) {
  logger.debug('Player left (player perspective):', playerId);

  gameContext.setPlayers((currentPlayers) =>
    currentPlayers.filter((player) => player.id !== playerId)
  );
  gameContext.setWaitingPlayers((currentWaiting) =>
    currentWaiting.filter((player) => player.id !== playerId)
  );
  gameContext.setGuessedPlayers((currentGuessed) =>
    currentGuessed.filter((player) => player.id !== playerId)
  );
  gameContext.setPartiallyGuessedPlayers((currentPartiallyGuessed) =>
    currentPartiallyGuessed.filter((player) => player.id !== playerId)
  );
  gameContext.setNoCluePlayers((currentNoClue) =>
    currentNoClue.filter((player) => player.id !== playerId)
  );
}

function handlePlayerBuzzedNotificationForPlayer(
  gameContext: GameContextType,
  msg: WebSocketMessage
) {
  logger.debug('[Player] handlePlayerBuzzedNotificationForPlayer called', { msg });
  // Broadcast messages use 'data' instead of 'payload'
  const playerId = msg.data?.playerId;
  const playerName = msg.data?.playerName;

  logger.debug('[Player] Notification data:', { playerId, playerName });

  if (playerId && playerName) {
    logger.debug('[Player] Setting buzzer notification');
    gameContext.setBuzzerNotification({
      playerId,
      playerName,
    });
  } else {
    logger.warn('[Player] Missing playerId or playerName in notification');
  }
}

export function sendPlayerAction(action: string, payload?: Record<string, unknown>) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    logger.error('[PlayerAction] WebSocket is not connected');
    return false;
  }

  try {
    const message = {
      serverAction: 'player-action',
      serverPayload: {
        action,
        payload,
        localTimestamp: Date.now(),
      },
    };
    logger.debug('[PlayerAction] Sending message:', message);
    ws.send(JSON.stringify(message));
    logger.debug('[PlayerAction] Message sent successfully');
    return true;
  } catch (error) {
    logger.error('[PlayerAction] Error sending action:', error);
    return false;
  }
}

export function sendPlayerBuzzedAction(): boolean {
  return sendPlayerAction('player-buzzed');
}

export function sendPlayerNoClueAction(): boolean {
  return sendPlayerAction('player-no-clue');
}

export function disconnectFromGame() {
  // Clear ALL module-level session variables FIRST to prevent auto-reconnection
  // This must happen before closing the WebSocket to ensure the onclose handler
  // sees the cleared variables and doesn't attempt to reconnect
  currentPlayerId = null;
  currentSessionId = null;
  currentPlayerName = null;
  // Reset reconnection state on manual disconnect
  reconnectAttempts = 0;
  hasFailed = false;
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  // Close WebSocket after clearing variables
  if (ws) {
    ws.close();
    ws = null;
  }
}

export function leaveGame(gameContext: GameContextType) {
  // Disconnect and clear module-level state
  disconnectFromGame();

  // Clear stored player data to prevent auto-reconnection
  clearPlayerData();

  // Clear all game context state
  gameContext.setSessionId('');
  gameContext.setCurrentPlayerId('');
  gameContext.setPlayers([]);
  gameContext.setWaitingPlayers([]);
  gameContext.setGuessedPlayers([]);
  gameContext.setPartiallyGuessedPlayers([]);
  gameContext.setNoCluePlayers([]);
  gameContext.setStatus('notStarted');
  gameContext.setWsStatus('closed');
  gameContext.setBuzzerNotification(null);
  gameContext.setPlayerToasts([]);
  gameContext.setLastSong(null);
}

export function isConnected(): boolean {
  return ws !== null && ws.readyState === WebSocket.OPEN;
}
