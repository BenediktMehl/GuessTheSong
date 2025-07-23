import type { GameContextType, Player, GameStatus } from './context';

const WS_URL = 'ws://localhost:8080';

// Reference to store websocket connection between function calls
let ws: WebSocket | null = null;

// Store the player's ID after joining
let currentPlayerId: string | null = null;

export function joinGame(gameContext: GameContextType, playerName: string, sessionId: string): Promise<boolean> {
    return new Promise((resolve) => {
        const { 
            setGameState,
            setPlayers,
            setWaitingPlayers,
            setGuessedPlayers 
        } = gameContext;
        
        // Close existing connection if any
        if (ws) {
            ws.close();
        }
        
        ws = new WebSocket(WS_URL);

        // Set a timeout in case connection fails
        const timeout = setTimeout(() => {
            if (ws?.readyState !== WebSocket.OPEN) {
                resolve(false);
            }
        }, 5000);

        ws.onopen = () => {
            clearTimeout(timeout);
            if (ws) {
                ws.send(JSON.stringify({ 
                    type: 'join', 
                    payload: { name: playerName }, 
                    sessionId 
                }));
                console.log('Joining game with session ID:', sessionId);
            } else {
                console.error("WebSocket is not initialized");
                resolve(false);
            }
        };

        ws.onclose = () => {
            console.log('WebSocket connection closed');
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            resolve(false);
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                console.log('Received message:', message);

                switch (message.type) {
                    case 'join-success':
                        // Store the player ID for future actions
                        currentPlayerId = message.playerId;
                        resolve(true);
                        break;

                    case 'join-failed':
                        console.error('Failed to join game:', message.reason);
                        resolve(false);
                        break;

                    case 'update':
                        // Handle game state updates from the host
                        const { 
                            players, 
                            waitingPlayers, 
                            guessedPlayers, 
                            referee, 
                            gameHost, 
                            musicHost, 
                            status, 
                            wsStatus, 
                            sessionId: updatedSessionId 
                        } = message.payload;

                        // Update the full game state
                        if (setGameState) {
                            setGameState(
                                players || [],
                                waitingPlayers || [],
                                guessedPlayers || [],
                                referee || null,
                                gameHost || null,
                                musicHost || null,
                                status || 'notStartet',
                                wsStatus || 'open',
                                updatedSessionId || sessionId
                            );
                        } else {
                            // Update individual state parts if setGameState is not available
                            if (players && setPlayers) setPlayers(players);
                            if (waitingPlayers && setWaitingPlayers) setWaitingPlayers(waitingPlayers);
                            if (guessedPlayers && setGuessedPlayers) setGuessedPlayers(guessedPlayers);
                        }
                        break;

                    case 'session-closed':
                        console.log('Game session closed:', message.reason);
                        alert(`The game session has ended: ${message.reason}`);
                        // Redirect to home or show appropriate UI
                        window.location.href = '/';
                        break;

                    case 'error':
                        console.error('Server error:', message.message);
                        break;

                    default:
                        console.log('Unknown message type:', message.type);
                }
            } catch (error) {
                console.error('Error processing message:', error);
            }
        };
    });
}

export function sendPlayerAction(action: string, data?: any) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.error('WebSocket is not connected');
        return false;
    }

    try {
        ws.send(JSON.stringify({
            type: 'player-action',
            payload: {
                action,
                data,
                playerId: currentPlayerId,
                timestamp: Date.now()
            }
        }));
        return true;
    } catch (error) {
        console.error('Error sending action:', error);
        return false;
    }
}

export function submitGuess(songGuess: string) {
    return sendPlayerAction('guess', { songGuess });
}

export function requestMusicHostRole() {
    return sendPlayerAction('requestRole', { role: 'musicHost' });
}

export function requestRefereeRole() {
    return sendPlayerAction('requestRole', { role: 'referee' });
}

export function voteToSkip() {
    return sendPlayerAction('voteSkip');
}

export function playerReady() {
    return sendPlayerAction('ready');
}

export function disconnectFromGame() {
    if (ws) {
        ws.close();
        ws = null;
        currentPlayerId = null;
    }
}

// Check if the player is currently connected
export function isConnected(): boolean {
    return ws !== null && ws.readyState === WebSocket.OPEN;
}

// Get the current player ID
export function getPlayerId(): string | null {
    return currentPlayerId;
}
