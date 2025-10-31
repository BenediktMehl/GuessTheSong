import type { GameContextType } from './context';
import { WS_URL } from '../config';

// Reference to store websocket connection between function calls
let ws: WebSocket | null = null;

// Store the player's ID and session info for reconnection
let currentPlayerId: string | null = null;
let currentSessionId: string | null = null;
let currentPlayerName: string | null = null;
let reconnectAttempts = 0;
let reconnectTimeout: number | null = null;
const MAX_RECONNECT_ATTEMPTS = 3;

function attemptReconnect(gameContext: GameContextType) {
    if (!currentSessionId || !currentPlayerName || !currentPlayerId) {
        console.log('Cannot reconnect: missing session info');
        return;
    }
    
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.log('Max reconnect attempts reached');
        gameContext.setWsStatus('failed');
        return;
    }
    
    reconnectAttempts++;
    console.log(`Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}...`);
    
    reconnectTimeout = window.setTimeout(() => {
        joinGame(gameContext, currentPlayerName!, currentSessionId!, currentPlayerId || undefined);
    }, 2000 * reconnectAttempts); // Exponential backoff
}

export function joinGame(gameContext: GameContextType, playerName: string, sessionId: string, playerId?: string): Promise<boolean> {
    console.log(gameContext, "currentPlayerId:", currentPlayerId, "reconnecting with:", playerId);
    
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
                resolve(false);
            }
        }, 5000);

        ws.onopen = () => {
            clearTimeout(timeout);
            if (ws) {
                const payload: any = { 
                    sessionId: sessionId, 
                    name: playerName
                };
                
                // Include playerId for reconnection
                if (playerId) {
                    payload.playerId = playerId;
                }
                
                ws.send(JSON.stringify({ 
                    serverAction: 'join', 
                    serverPayload: payload
                }));
                console.log('Joining game with session ID:', sessionId, playerId ? '(reconnecting)' : '(new)');
            } else {
                console.error("WebSocket is not initialized");
                resolve(false);
            }
        };

        ws.onclose = () => {
            console.log('WebSocket connection closed');
            gameContext.setWsStatus('closed');
            
            // Attempt to reconnect if we have session info
            if (currentSessionId && currentPlayerId) {
                attemptReconnect(gameContext);
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            resolve(false);
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                console.log('Received message:', message);

                switch (message.action) {
                    case 'join-success':
                        currentPlayerId = message.payload.playerId;
                        reconnectAttempts = 0; // Reset on successful connection
                        if (reconnectTimeout) {
                            clearTimeout(reconnectTimeout);
                            reconnectTimeout = null;
                        }
                        gameContext.setSessionId(sessionId);
                        gameContext.setWsStatus('open');
                        gameContext.setCurrentPlayerId(message.payload.playerId);
                        resolve(true);
                        break;

                    case 'join-failed':
                        console.error('Failed to join game:', message.payload.reason);
                        resolve(false);
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

export function sendPlayerAction(action: string, payload?: any) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.error('WebSocket is not connected');
        return false;
    }

    try {
        ws.send(JSON.stringify({
            action: 'player-action',
            payload: {
                action,
                payload,
                localTimestamp: Date.now()
            }
        }));
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
}

export function isConnected(): boolean {
    return ws !== null && ws.readyState === WebSocket.OPEN;
}