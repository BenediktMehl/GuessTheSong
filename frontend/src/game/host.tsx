import { useGameContext, type GameContextType, type Player } from './context';
import { useCallback } from 'react';
import { WS_URL } from '../config';
import { sendPlayerAction } from './player';

// Reference to store websocket connection between function calls
let ws: WebSocket | null = null;

// Convert to a custom hook
export function useGameInitializer() {
    const gameContext = useGameContext();

    const initGame = useCallback(() => {
        // Close existing connection if any
        if (ws) {
            ws.close();
        }

        ws = new WebSocket(WS_URL);

        ws.onopen = () => {
            console.log("WebSocket connection opened");
            gameContext.setWsStatus('open');

            if (ws) {
                const createMsg = { serverAction: 'create' };
                console.log("Sending create message:", createMsg);
                ws.send(JSON.stringify(createMsg));
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
            console.log('WebSocket connection closed');
        };

        ws.onerror = () => {
            gameContext.setWsStatus('error');
            console.error('WebSocket error occurred');
        };
    }, []);

    const endGame = useCallback(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.close();
        }
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

function handlePlayerLeft(gameContext: GameContextType, playerId: string) {
    const { players, waitingPlayers, guessedPlayers } = gameContext;
    const { setPlayers, setWaitingPlayers, setGuessedPlayers } = gameContext;
    setPlayers(players.filter(player => player.id !== playerId));
    setWaitingPlayers(waitingPlayers.filter(player => player.id !== playerId));
    setGuessedPlayers(guessedPlayers.filter(player => player.id !== playerId));
};

export function playerJoined(gameContext: GameContextType, newPlayer: Player) {
    const { players, setPlayers } = gameContext;
    const newPlayers = [...players, newPlayer]
    setPlayers(newPlayers);
    sendPlayersChangedAction(newPlayers);
}

function handlePlayerJoined(gameContext: GameContextType, msg: any) {
    const newPlayer = {
        id: msg.payload.playerId,
        name: msg.payload.name,
        points: 0,
    };
    playerJoined(gameContext, newPlayer);
};

function handlePlayerBuzzed(gameContext: GameContextType, msg: any) {
    const waitingPlayerId = msg.payload.playerId;
    const waitingPlayer = gameContext.players.find(player => player.id === waitingPlayerId);
    if (!waitingPlayer) {
        console.error(`Player with ID ${waitingPlayerId} not found`);
        return;
    }
    const { waitingPlayers, setWaitingPlayers } = gameContext;
    const newWaitingPlayers = [...waitingPlayers, waitingPlayer];
    setWaitingPlayers(newWaitingPlayers);
    sendWaitingPlayersChangedAction(newWaitingPlayers);
};


function handlePlayerGuessedWrong(gameContext: GameContextType) {
    const { waitingPlayers, guessedPlayers, setWaitingPlayers, setGuessedPlayers } = gameContext;
    const firstWaitingPlayer = waitingPlayers[0];
    const newGuessedPlayers = [...guessedPlayers, firstWaitingPlayer];
    setGuessedPlayers(newGuessedPlayers);
    const newWaitingPlayers = waitingPlayers.slice(1);
    setWaitingPlayers(newWaitingPlayers);
    sendWaitingPlayersChangedAction(newWaitingPlayers);
    sendGuessedPlayersChangedAction(newGuessedPlayers);
};

function handlePlayerGuessedRight(gameContext: GameContextType) {
    const { players, waitingPlayers, setWaitingPlayers, setGuessedPlayers } = gameContext;
    const firstWaitingPlayer = waitingPlayers[0];
    setGuessedPlayers([]);
    setWaitingPlayers([]);
    sendWaitingPlayersChangedAction([]);
    sendGuessedPlayersChangedAction([]);

    firstWaitingPlayer.points += 1;
    sendPlayersChangedAction(players)
};

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

function sendHostAction(serverPayload: any) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.error('WebSocket is not connected');
        return false;
    }
    try {
        ws.send(JSON.stringify({
            serverAction: 'broadcast',
            serverPayload
        }));
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
            isLoggedIn
        }
    });
}

export function sendRefereeChangedAction(newRefereeId: string) {
    return sendHostAction({
        action: 'refereeChanged',
        data: {
            refereeId: newRefereeId
        }
    });
}

function sendPlayersChangedAction(players: Player[]) {
    return sendHostAction({
        action: 'playersChanged',
        data: {
            players
        }
    });
}

function sendWaitingPlayersChangedAction(buzzedPlayers: Player[]) {
    return sendHostAction({
        action: 'waitingPlayersChanged',
        data: {
            buzzedPlayers
        }
    });
}

function sendGuessedPlayersChangedAction(guessedPlayers: Player[]) {
    return sendHostAction({
        action: 'guessedPlayersChanged',
        data: {
            guessedPlayers
        }
    });
}


