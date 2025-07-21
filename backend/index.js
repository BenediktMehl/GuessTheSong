// backend/index.js
// Minimal WebSocket server for GuessTheSong

const WebSocket = require('ws');

const PORT = process.env.PORT || 3001;
const wss = new WebSocket.Server({ port: PORT });

console.log(`WebSocket server running on ws://localhost:${PORT}`);

// In-memory room and player management (MVP, not for production)
const rooms = {};

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      return;
    }

    // Basic protocol: { type, room, payload }
    switch (data.type) {
      case 'create_room':
        const roomCode = Math.random().toString(36).substr(2, 6).toUpperCase();
        rooms[roomCode] = { host: ws, players: [] };
        ws.roomCode = roomCode;
        ws.isHost = true;
        ws.send(JSON.stringify({ type: 'room_created', room: roomCode }));
        break;

      case 'join_room':
        if (rooms[data.room]) {
          rooms[data.room].players.push(ws);
          ws.roomCode = data.room;
          ws.isHost = false;
          ws.send(JSON.stringify({ type: 'joined_room', room: data.room }));
          // Notify host of new player
          rooms[data.room].host.send(JSON.stringify({ type: 'player_joined' }));
        } else {
          ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
        }
        break;

      case 'broadcast':
        // Host or player can broadcast to all in room
        if (ws.roomCode && rooms[ws.roomCode]) {
          const recipients = [rooms[ws.roomCode].host, ...rooms[ws.roomCode].players];
          recipients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: 'broadcast', payload: data.payload }));
            }
          });
        }
        break;

      // Add more message types as needed for game logic

      default:
        ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
    }
  });

  ws.on('close', () => {
    // Remove from room/player lists on disconnect
    if (ws.roomCode && rooms[ws.roomCode]) {
      if (ws.isHost) {
        // End game for all players
        rooms[ws.roomCode].players.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'room_closed' }));
          }
        });
        delete rooms[ws.roomCode];
      } else {
        rooms[ws.roomCode].players = rooms[ws.roomCode].players.filter(client => client !== ws);
        if (rooms[ws.roomCode].host.readyState === WebSocket.OPEN) {
          rooms[ws.roomCode].host.send(JSON.stringify({ type: 'player_left' }));
        }
      }
    }
  });
});