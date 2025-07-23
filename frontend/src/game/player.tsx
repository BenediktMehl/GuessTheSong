import type { GameContextType } from './context';

const WS_URL = 'ws://localhost:8080';

// Reference to store websocket connection between function calls
let ws: WebSocket | null = null;

// Store the player's ID after joining
let currentPlayerId: string | null = null;

export function joinGame(gameContext: GameContextType, playerName: string, sessionId: string): Promise<boolean> {
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
                ws.send(JSON.stringify({ 
                    action: 'join', 
                    payload: { 
                        sessionId: sessionId, 
                        name: playerName 
                    }
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

                switch (message.action) {
                    case 'join-success':
                        // Store the player ID for future actions
                        currentPlayerId = message.payload.playerId;
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