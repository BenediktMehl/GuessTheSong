import { useGameContext, type GameContextType } from './context';
import { useCallback } from 'react';

const WS_URL = 'ws://localhost:8080';

// Reference to store websocket connection between function calls
let ws: WebSocket | null = null;

// Convert to a custom hook
export function useGameInitializer() {
    const gameContext = useGameContext();
    const { 
        setWsStatus,
        setSessionId,
        addPlayer,
        removePlayer,
        // ...other context values you need
    } = gameContext;
    
    // Return an init function that can be called from event handlers
    const initGame = useCallback(() => {
        // Close existing connection if any
        if (ws) {
            ws.close();
        }
        
        ws = new WebSocket(WS_URL);

        ws.onopen = () => {
            console.log("WebSocket connection opened");
            setWsStatus('open');
            
            if (ws) {
                const createMsg = { type: 'create' };
                console.log("Sending create message:", createMsg);
                ws.send(JSON.stringify(createMsg));
            }
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                console.log('Received message:', msg);
                
                if (msg.type === 'created') {
                    console.log('Session created with ID:', msg.sessionId);
                    setSessionId(msg.sessionId);
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
    }, [setWsStatus, setSessionId, addPlayer, removePlayer]); // Add all context values used

    const endGame = useCallback(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.close();
        }
        gameContext.setWsStatus('closed');
        console.log('Game ended and WebSocket connection closed');
    }, [gameContext]);

    return { initGame, endGame };
}