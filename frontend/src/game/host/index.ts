import { useCallback } from 'react';
import { WS_URL } from '../../config';
import {
  type GameContextType,
  getGlobalPausePlayer,
  type Player,
  useGameContext,
} from '../context';
import { sendPlayerAction } from '../player';

// WebSocket message types
type WebSocketMessage = {
  action: string;
  payload?: {
    playerId?: string;
    name?: string;
    [key: string]: unknown;
  };
  data?: {
    playerId?: string;
    playerName?: string;
    [key: string]: unknown;
  };
};

type ServerPayload = {
  [key: string]: unknown;
};

// Reference to store websocket connection between function calls
export let ws: WebSocket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;
let hasFailed = false; // Track if we've permanently failed

// Convert to a custom hook
export function useGameInitializer() {
  const gameContext = useGameContext();

  const initGame = useCallback(() => {
    // Check if we've already permanently failed
    if (hasFailed) {
      gameContext.setWsStatus('failed');
      return;
    }

    // Check if we've exceeded max attempts BEFORE trying
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      hasFailed = true;
      gameContext.setWsStatus('failed');
      return;
    }

    // Close existing connection if any
    if (ws) {
      ws.close();
    }

    gameContext.setWsStatus('connecting');
    ws = new WebSocket(WS_URL);

    // Set a timeout to close the connection if it doesn't open within 5 seconds
    const connectionTimeout = setTimeout(() => {
      if (ws && ws.readyState !== WebSocket.OPEN) {
        ws.close();
      }
    }, 5000);

    ws.onopen = () => {
      console.log('[Host] WebSocket opened successfully');
      clearTimeout(connectionTimeout);
      gameContext.setWsStatus('open');
      reconnectAttempts = 0; // Reset on successful connection
      hasFailed = false; // Reset failed flag on success

      if (ws) {
        console.log('[Host] Sending create action');
        ws.send(JSON.stringify({ serverAction: 'create' }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log('[Host] Received message:', msg);

        // Handle messages based on action rather than type
        switch (msg.action) {
          case 'created':
            console.log('Session created with ID:', msg.payload.sessionId);
            gameContext.setSessionId(msg.payload.sessionId);
            break;

          case 'player-joined':
            console.log('[Host] Handling player-joined action:', msg);
            handlePlayerJoined(gameContext, msg);
            break;

          case 'player-buzzed':
            console.log('[Host] Handling player-buzzed action:', msg);
            handlePlayerBuzzed(gameContext, msg);
            break;

          case 'player-guessed-wrong':
            // Note: This is only received when broadcast from another host
            // When the local host marks wrong, it's handled directly in markPlayerGuessedWrong
            // to avoid duplicate processing
            console.log(
              '[Host] Received player-guessed-wrong broadcast (ignoring - already handled locally)'
            );
            // Don't call handlePlayerGuessedWrong here - it's already been handled
            break;

          case 'player-guessed-right':
            handlePlayerGuessedRight(gameContext);
            break;

          case 'player-left':
            handlePlayerLeft(gameContext, msg.payload.playerId);
            break;

          case 'loggedInToSpotify':
            handleLoggedInToSpotify(gameContext);
            break;

          case 'loggedOutOfSpotify':
            handleLoggedOutOfSpotify(gameContext);
            break;

          case 'game-started':
            // Update host's game status when game starts
            gameContext.setStatus('waiting');
            break;

          case 'player-buzzed-notification':
            handlePlayerBuzzedNotification(gameContext, msg);
            break;

          case 'error':
            console.error('Server error:', msg.payload.message);
            break;

          default:
            console.warn('Unknown action:', msg.action);
        }
      } catch (e) {
        console.error('Failed to parse message', e);
      }
    };

    ws.onclose = (event) => {
      console.log('[Host] WebSocket closed', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });
      gameContext.setWsStatus('closed');

      // Increment attempt counter after failure
      reconnectAttempts++;

      // Check if we've reached max attempts
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        hasFailed = true;
        gameContext.setWsStatus('failed');
      } else {
        const delay = 100 * reconnectAttempts;
        setTimeout(() => {
          if (!hasFailed) {
            initGame();
          }
        }, delay);
      }
    };

    ws.onerror = (error) => {
      console.error('[Host] WebSocket error:', error);
      // Don't change status here, onclose will be called next
    };
  }, [gameContext]);

  const endGame = useCallback(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
    reconnectAttempts = 0; // Reset attempts when manually ending
    hasFailed = false; // Reset failed flag
    gameContext.setWsStatus('closed');
    console.log('Game ended and WebSocket connection closed');
  }, [gameContext]);

  return { initGame, endGame };
}

export function loggedInToSpotify(): boolean {
  return sendPlayerAction('loggedInToSpotify');
}

export function loggedOutOfSpotify(): boolean {
  return sendPlayerAction('loggedOutOfSpotify');
}

export function startGame(gameContext: GameContextType): boolean {
  // Broadcast game-started action to all players
  const success = sendHostAction({
    action: 'game-started',
    payload: {},
  });

  if (success) {
    // Update host's game status to 'waiting' only on successful broadcast
    gameContext.setStatus('waiting');
  }

  return success;
}

function handlePlayerLeft(gameContext: GameContextType, playerId: string) {
  gameContext.setPlayers((currentPlayers) =>
    currentPlayers.filter((player) => player.id !== playerId)
  );
  gameContext.setWaitingPlayers((currentWaitingPlayers) =>
    currentWaitingPlayers.filter((player) => player.id !== playerId)
  );
  gameContext.setGuessedPlayers((currentGuessedPlayers) =>
    currentGuessedPlayers.filter((player) => player.id !== playerId)
  );
}

export function playerJoined(gameContext: GameContextType, newPlayer: Player) {
  console.log('playerJoined called with:', newPlayer);
  console.log('Current players before update:', gameContext.players);

  const newPlayers = [...gameContext.players, newPlayer];
  console.log('Setting new players list:', newPlayers);
  gameContext.setPlayers(newPlayers);
  sendPlayersChangedAction(newPlayers);
}

function handlePlayerJoined(gameContext: GameContextType, msg: WebSocketMessage) {
  console.log('[Host] handlePlayerJoined called', { msg, currentPlayers: gameContext.players });

  const playerId = msg.payload?.playerId;
  const playerName = msg.payload?.name;

  if (!playerId || !playerName) {
    console.error('[Host] Invalid player data: missing playerId or name', msg.payload);
    return;
  }

  const newPlayer: Player = {
    id: playerId,
    name: playerName,
    points: 0,
  };
  console.log('[Host] Adding new player:', newPlayer);

  // Use functional update to ensure we're working with the latest state
  gameContext.setPlayers((currentPlayers) => {
    console.log('[Host] Current players in setState:', currentPlayers);
    console.log('[Host] Current players length:', currentPlayers.length);

    // Check if player already exists
    if (currentPlayers.some((p) => p.id === newPlayer.id)) {
      console.log('[Host] Player already exists, skipping');
      return currentPlayers;
    }

    const updatedPlayers = [...currentPlayers, newPlayer];
    console.log('[Host] Updated players list:', updatedPlayers);
    console.log('[Host] Updated players length:', updatedPlayers.length);

    // Send the update to other clients
    sendPlayersChangedAction(updatedPlayers);

    return updatedPlayers;
  });
}

function handlePlayerBuzzed(gameContext: GameContextType, msg: WebSocketMessage) {
  console.log('[Host] handlePlayerBuzzed called', { msg, players: gameContext.players });

  const waitingPlayerId = msg.payload?.playerId;
  const waitingPlayerName = msg.payload?.playerName; // Player name is now included in the message
  console.log('[Host] Waiting player ID:', waitingPlayerId, 'Name:', waitingPlayerName);

  if (!waitingPlayerId || typeof waitingPlayerId !== 'string') {
    console.error('[Host] No playerId in message payload:', msg);
    return;
  }

  // Try to find player in context first
  let waitingPlayer: Player | undefined = gameContext.players.find(
    (player) => player.id === waitingPlayerId
  );

  // If player not found in context, create a temporary player object from the message
  if (!waitingPlayer) {
    console.warn(
      `[Host] Player with ID ${waitingPlayerId} not found in context. Creating from message.`
    );
    if (waitingPlayerName && typeof waitingPlayerName === 'string') {
      const newPlayer: Player = {
        id: waitingPlayerId,
        name: waitingPlayerName,
        points: 0,
      };
      waitingPlayer = newPlayer;
      // Also add to players list if we have the name
      gameContext.setPlayers((currentPlayers) => {
        if (currentPlayers.some((p) => p.id === waitingPlayerId)) {
          return currentPlayers;
        }
        return [...currentPlayers, newPlayer];
      });
    } else {
      console.error(
        `[Host] Cannot create player object - missing player name. Available players:`,
        gameContext.players
      );
      return;
    }
  }

  if (!waitingPlayer) {
    console.error('[Host] Failed to get or create waiting player');
    return;
  }

  console.log('[Host] Found/created player:', waitingPlayer);

  // Pause the song - try both context callback and global function
  const pauseFunction = gameContext.pausePlayerCallback || getGlobalPausePlayer();
  if (pauseFunction) {
    console.log('[Host] Pausing playback - function available');
    const pauseResult = pauseFunction();
    if (pauseResult instanceof Promise) {
      pauseResult.catch((error: unknown) => {
        console.error('[Host] Error pausing playback:', error);
      });
    }
  } else {
    console.warn('[Host] Pause function not available!', {
      hasContextCallback: !!gameContext.pausePlayerCallback,
      hasGlobalFunction: !!getGlobalPausePlayer(),
      player: gameContext.players.length,
    });
  }

  // Show notification for host
  gameContext.setBuzzerNotification({
    playerId: waitingPlayer.id,
    playerName: waitingPlayer.name,
  });
  console.log('[Host] Notification set for host');

  // Broadcast notification to all players
  const broadcastSuccess = sendBuzzerNotificationAction(waitingPlayer.id, waitingPlayer.name);
  console.log('[Host] Broadcast notification sent:', broadcastSuccess);

  // At this point, waitingPlayer is guaranteed to be defined
  const finalWaitingPlayer = waitingPlayer;

  gameContext.setWaitingPlayers((currentWaitingPlayers) => {
    // Check if player is already in waiting list
    if (currentWaitingPlayers.some((p) => p.id === finalWaitingPlayer.id)) {
      console.log('[Host] Player already in waiting list');
      return currentWaitingPlayers;
    }

    // Get the player with current points from the main players list
    // This ensures we have the most up-to-date points when adding to waiting list
    const playerWithCurrentPoints = gameContext.players.find((p) => p.id === finalWaitingPlayer.id);
    const playerToAdd = playerWithCurrentPoints || finalWaitingPlayer;

    const newWaitingPlayers = [...currentWaitingPlayers, playerToAdd];
    console.log(
      '[Host] Updating waiting players:',
      newWaitingPlayers.map((p) => ({ name: p.name, points: p.points }))
    );
    sendWaitingPlayersChangedAction(newWaitingPlayers);
    return newWaitingPlayers;
  });
}

function handlePlayerGuessedWrong(gameContext: GameContextType) {
  gameContext.setWaitingPlayers((currentWaitingPlayers) => {
    const firstWaitingPlayer = currentWaitingPlayers[0];

    if (!firstWaitingPlayer) {
      console.warn('[Host] No player in waiting list to move to guessed');
      return currentWaitingPlayers;
    }

    // Get the player with current points from the main players list
    // This ensures we have the most up-to-date points
    const playerWithCurrentPoints = gameContext.players.find((p) => p.id === firstWaitingPlayer.id);
    const playerToAdd = playerWithCurrentPoints || firstWaitingPlayer;

    gameContext.setGuessedPlayers((currentGuessedPlayers) => {
      // Check if player is already in guessed list to prevent duplicates
      if (currentGuessedPlayers.some((p) => p.id === playerToAdd.id)) {
        console.warn('[Host] Player already in guessed list, skipping', playerToAdd);
        return currentGuessedPlayers;
      }

      const newGuessedPlayers = [...currentGuessedPlayers, playerToAdd];
      console.log(
        '[Host] Moving player to guessed list:',
        playerToAdd.name,
        'with',
        playerToAdd.points,
        'points'
      );
      sendGuessedPlayersChangedAction(newGuessedPlayers);
      return newGuessedPlayers;
    });

    const newWaitingPlayers = currentWaitingPlayers.slice(1);
    console.log('[Host] Remaining waiting players:', newWaitingPlayers.length);
    sendWaitingPlayersChangedAction(newWaitingPlayers);
    return newWaitingPlayers;
  });
}

function handlePlayerGuessedRight(gameContext: GameContextType) {
  gameContext.setWaitingPlayers((currentWaitingPlayers) => {
    const firstWaitingPlayer = currentWaitingPlayers[0];

    if (!firstWaitingPlayer) {
      console.warn('[Host] No player in waiting list for right guess');
      // Still reset lists even if no player
      sendWaitingPlayersChangedAction([]);
      sendGuessedPlayersChangedAction([]);
      return [];
    }

    // Update the player's points in main players list FIRST
    // This ensures points are updated before we reset the lists
    gameContext.setPlayers((currentPlayers) => {
      const updatedPlayers = currentPlayers.map((player) =>
        player.id === firstWaitingPlayer.id ? { ...player, points: player.points + 1 } : player
      );
      console.log(
        '[Host] Updated player points after right guess:',
        updatedPlayers.find((p) => p.id === firstWaitingPlayer.id)
      );
      sendPlayersChangedAction(updatedPlayers);
      return updatedPlayers;
    });

    // Reset all lists - all players can buzz again for next song
    sendWaitingPlayersChangedAction([]);
    sendGuessedPlayersChangedAction([]);

    return [];
  });

  // Ensure guessed players list is also cleared
  gameContext.setGuessedPlayers([]);

  console.log('[Host] All players reset after right guess - ready for next song');
}

// Reset all players to default state (clear waiting and guessed lists)
export function resetAllPlayersForNewRound(gameContext: GameContextType) {
  console.log('[Host] Resetting all players for new round');
  console.log('[Host] Current state before reset:', {
    waitingCount: gameContext.waitingPlayers.length,
    guessedCount: gameContext.guessedPlayers.length,
    totalPlayers: gameContext.players.length,
  });

  // Clear lists locally
  gameContext.setWaitingPlayers([]);
  gameContext.setGuessedPlayers([]);

  // Broadcast to all players so they also reset their lists
  sendWaitingPlayersChangedAction([]);
  sendGuessedPlayersChangedAction([]);

  console.log('[Host] All players reset - waiting and guessed lists cleared');
}

// Export functions for the host UI to call
export function markPlayerGuessedRight(
  gameContext: GameContextType,
  onNextSong?: () => void
): boolean {
  const firstWaitingPlayer = gameContext.waitingPlayers[0];
  if (!firstWaitingPlayer) {
    console.error('[Host] No player waiting to guess');
    return false;
  }

  // Update state first (points and reset lists)
  handlePlayerGuessedRight(gameContext);

  // Broadcast to players
  const success = sendHostAction({
    action: 'player-guessed-right',
    payload: {
      playerId: firstWaitingPlayer.id,
    },
  });

  if (success) {
    // Play next song after state is updated
    if (onNextSong) {
      // Small delay to ensure state updates are processed
      setTimeout(() => {
        onNextSong();
      }, 100);
    }
  }

  return success;
}

export function markPlayerGuessedWrong(
  gameContext: GameContextType,
  onResumeSong?: () => void,
  onNextSong?: () => void
): boolean {
  const firstWaitingPlayer = gameContext.waitingPlayers[0];
  if (!firstWaitingPlayer) {
    console.error('[Host] No player waiting to guess');
    return false;
  }

  // Calculate state BEFORE update to determine what to do
  // After wrong guess: current player moves to guessed, next waiting player becomes first
  const remainingWaitingAfterUpdate = gameContext.waitingPlayers.length - 1; // One less after moving first to guessed

  // Calculate players who can still guess AFTER this wrong guess
  // Exclude: current waiting player (will be moved to guessed), current guessed players, and other waiting players
  const currentWaitingPlayerIds = new Set(gameContext.waitingPlayers.map((p) => p.id));
  const guessedPlayerIds = new Set(gameContext.guessedPlayers.map((p) => p.id));
  // After moving first waiting player to guessed, who can still guess?
  const notGuessedPlayersAfterUpdate = gameContext.players.filter(
    (p) =>
      p.id !== firstWaitingPlayer.id &&
      !guessedPlayerIds.has(p.id) &&
      !currentWaitingPlayerIds.has(p.id)
  );

  // Check if this is the last player (all will have guessed wrong after this)
  const isLastPlayer =
    remainingWaitingAfterUpdate === 0 && notGuessedPlayersAfterUpdate.length === 0;

  if (isLastPlayer) {
    // This is the last player - don't move to guessedPlayers, just reset everything for next song
    console.log('[Host] Last player guessed wrong - resetting all players for next song');

    // Remove player from waiting list without adding to guessed list
    gameContext.setWaitingPlayers((currentWaitingPlayers) => {
      const newWaitingPlayers = currentWaitingPlayers.slice(1);
      sendWaitingPlayersChangedAction(newWaitingPlayers);
      return newWaitingPlayers;
    });

    // Reset all players (this clears both waiting and guessed lists)
    resetAllPlayersForNewRound(gameContext);

    // Broadcast the wrong guess action (for consistency, but players will be reset anyway)
    const success = sendHostAction({
      action: 'player-guessed-wrong',
      payload: {
        playerId: firstWaitingPlayer.id,
      },
    });

    if (success && onNextSong) {
      // Small delay to ensure reset is processed
      setTimeout(() => {
        onNextSong();
      }, 100);
    }

    return success;
  }

  // Normal case: There are still players who can guess
  // Update state first (before broadcasting)
  console.log('[Host] Marking player as guessed wrong:', firstWaitingPlayer.name);
  handlePlayerGuessedWrong(gameContext);

  // Broadcast to players (they will update their state via the broadcast)
  const success = sendHostAction({
    action: 'player-guessed-wrong',
    payload: {
      playerId: firstWaitingPlayer.id,
    },
  });

  if (success) {
    // Determine what to do based on remaining players
    if (remainingWaitingAfterUpdate > 0) {
      // There are more players in the waiting queue
      // Keep song paused - next player can guess immediately
      console.log('[Host] Next player in queue, keeping song paused');
      // Don't resume - song should stay paused for next player
    } else if (notGuessedPlayersAfterUpdate.length > 0) {
      // No more players in queue, but there are players who can still guess
      // Resume song so new players can buzz
      console.log('[Host] No players in queue, but players can still guess - resuming song');
      if (onResumeSong) {
        onResumeSong();
      }
    }
  }

  return success;
}

function handleLoggedInToSpotify(gameContext: GameContextType) {
  // Host ist immer der Music Host
  if (gameContext.isHost && !gameContext.musicHostLoggedIn) {
    gameContext.setMusicHostLoggedIn(true);
    console.log(`Host logged in to Spotify`);
  }
}

function handleLoggedOutOfSpotify(gameContext: GameContextType) {
  // Host ist immer der Music Host
  if (gameContext.isHost && gameContext.musicHostLoggedIn) {
    gameContext.setMusicHostLoggedIn(false);
    console.log(`Host logged out of Spotify`);
  }
}

function handlePlayerBuzzedNotification(gameContext: GameContextType, msg: WebSocketMessage) {
  // Broadcast messages use 'data' instead of 'payload'
  const playerId = msg.data?.playerId;
  const playerName = msg.data?.playerName;

  if (playerId && playerName) {
    gameContext.setBuzzerNotification({
      playerId,
      playerName,
    });
  }
}

//------------ SENDING ACTIONS ------------//

function sendHostAction(serverPayload: ServerPayload) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.error('WebSocket is not connected');
    return false;
  }
  try {
    ws.send(
      JSON.stringify({
        serverAction: 'broadcast',
        serverPayload,
      })
    );
    return true;
  } catch (error) {
    console.error('Error sending host action:', error);
    return false;
  }
}

export function sendMusicHostChangedAction(newMusicHostId: string, isLoggedIn: boolean) {
  return sendHostAction({
    action: 'musicHostChanged',
    data: {
      musicHostId: newMusicHostId,
      isLoggedIn,
    },
  });
}

export function sendRefereeChangedAction(newRefereeId: string) {
  return sendHostAction({
    action: 'refereeChanged',
    data: {
      refereeId: newRefereeId,
    },
  });
}

function sendPlayersChangedAction(players: Player[]) {
  return sendHostAction({
    action: 'playersChanged',
    data: {
      players,
    },
  });
}

function sendWaitingPlayersChangedAction(buzzedPlayers: Player[]) {
  return sendHostAction({
    action: 'waitingPlayersChanged',
    data: {
      buzzedPlayers,
    },
  });
}

function sendGuessedPlayersChangedAction(guessedPlayers: Player[]) {
  return sendHostAction({
    action: 'guessedPlayersChanged',
    data: {
      guessedPlayers,
    },
  });
}

function sendBuzzerNotificationAction(playerId: string, playerName: string) {
  return sendHostAction({
    action: 'player-buzzed-notification',
    data: {
      playerId,
      playerName,
    },
  });
}
