import type { GameContextType } from './context';

const WS_URL = 'ws://localhost:8080'; // Adjust if needed

// Reference to store websocket connection between function calls
let ws: WebSocket | null = null;
let sessionId: string = '';

export function initGame(gameContext: GameContextType) {
    const { 
        addPlayer,
        addToWaitingPlayers,
        addToGuessedPlayers,
        setReferee,
        setGameHost,
        setMusicHost,
        setWsStatus,
        setStatus,
        removePlayer
    } = gameContext;

    
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        if (ws) {
            ws.send(JSON.stringify({ type: 'create', role: 'host' }));
            setWsStatus('open');
        } else {
            console.error("WebSocket is not initialized");
        }
    };

    ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'created') {
                sessionId = msg.sessionId;
                console.log('Session created with ID:', sessionId);
            }
            
            if (msg.type === 'player-joined') {
                const newPlayer = {
                    id: msg.id,
                    name: msg.name,
                    points: 0,
                };
                
                addPlayer(newPlayer);
                console.log('Player joined:', msg.name);
            }
            
            if (msg.type === 'player-left') {
                removePlayer(msg.id);
                console.log('Player left:', msg.name);
            }
            
            if (msg.type === 'player-action') {
                // Handle player action (e.g., guess, etc.)
                console.log('Player action:', msg.name, msg.payload);
            }
        } catch (e) {
            console.error('Failed to parse message', e);
        }
    };

    ws.onclose = () => {
        setWsStatus('closed');
        console.log('WebSocket connection closed');
    };

    ws.onerror = () => {
        setWsStatus('error');
        console.error('WebSocket error occurred');
    };
    
    return sessionId;
}

export function endGame(gameContext: GameContextType) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
    }
    gameContext.setWsStatus('closed');
    console.log('Game ended and WebSocket connection closed');
}

export function getSessionId() {
    return sessionId;
}