import { useCallback } from 'react';
import { WS_URL } from '../config';
import { type GameContextType, type Player, useGameContext } from './context';
import { sendPlayerAction } from './player';

// WebSocket message types
type WebSocketMessage = {
  action: string;
  payload: {
    playerId?: string;
    name?: string;
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
      clearTimeout(connectionTimeout);
      gameContext.setWsStatus('open');
      reconnectAttempts = 0; // Reset on successful connection
      hasFailed = false; // Reset failed flag on success

      if (ws) {
        ws.send(JSON.stringify({ serverAction: 'create' }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log('Received message:', msg);

        // Handle messages based on action rather than type
        switch (msg.action) {
          case 'created':
            console.log('Session created with ID:', msg.payload.sessionId);
            gameContext.setSessionId(msg.payload.sessionId);
            break;

          case 'player-joined':
            handlePlayerJoined(gameContext, msg);
            break;

          case 'player-buzzed':
            handlePlayerBuzzed(gameContext, msg);
            break;

          case 'player-guessed-wrong':
            handlePlayerGuessedWrong(gameContext);
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

    ws.onclose = () => {
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

    ws.onerror = () => {
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
  console.log('Adding new player:', newPlayer);

  // Use functional update to ensure we're working with the latest state
  gameContext.setPlayers((currentPlayers) => {
    console.log('Current players in setState:', currentPlayers);
    console.log('Current players length:', currentPlayers.length);

    const updatedPlayers = [...currentPlayers, newPlayer];
    console.log('Updated players list:', updatedPlayers);
    console.log('Updated players length:', updatedPlayers.length);

    // Send the update to other clients
    sendPlayersChangedAction(updatedPlayers);

    return updatedPlayers;
  });
}

function handlePlayerBuzzed(gameContext: GameContextType, msg: WebSocketMessage) {
  const waitingPlayerId = msg.payload.playerId;
  const waitingPlayer = gameContext.players.find((player) => player.id === waitingPlayerId);
  if (!waitingPlayer) {
    console.error(`Player with ID ${waitingPlayerId} not found`);
    return;
  }

  gameContext.setWaitingPlayers((currentWaitingPlayers) => {
    const newWaitingPlayers = [...currentWaitingPlayers, waitingPlayer];
    sendWaitingPlayersChangedAction(newWaitingPlayers);
    return newWaitingPlayers;
  });
}

function handlePlayerGuessedWrong(gameContext: GameContextType) {
  gameContext.setWaitingPlayers((currentWaitingPlayers) => {
    const firstWaitingPlayer = currentWaitingPlayers[0];

    gameContext.setGuessedPlayers((currentGuessedPlayers) => {
      const newGuessedPlayers = [...currentGuessedPlayers, firstWaitingPlayer];
      sendGuessedPlayersChangedAction(newGuessedPlayers);
      return newGuessedPlayers;
    });

    const newWaitingPlayers = currentWaitingPlayers.slice(1);
    sendWaitingPlayersChangedAction(newWaitingPlayers);
    return newWaitingPlayers;
  });
}

function handlePlayerGuessedRight(gameContext: GameContextType) {
  gameContext.setWaitingPlayers((currentWaitingPlayers) => {
    const firstWaitingPlayer = currentWaitingPlayers[0];

    // Update the player's points
    gameContext.setPlayers((currentPlayers) => {
      const updatedPlayers = currentPlayers.map((player) =>
        player.id === firstWaitingPlayer.id ? { ...player, points: player.points + 1 } : player
      );
      sendPlayersChangedAction(updatedPlayers);
      return updatedPlayers;
    });

    sendWaitingPlayersChangedAction([]);
    sendGuessedPlayersChangedAction([]);

    return [];
  });

  gameContext.setGuessedPlayers([]);
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
