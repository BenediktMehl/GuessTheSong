const WebSocket = require('ws');

const WS_URL = 'ws://localhost:8080';

function waitForMessage(ws) {
  return new Promise(resolve => {
    ws.once('message', msg => resolve(JSON.parse(msg)));
  });
}

describe('GuessTheSong WebSocket backend', () => {
  let host, player1, player2;

  afterEach(() => {
    if (host && host.readyState === WebSocket.OPEN) host.close();
    if (player1 && player1.readyState === WebSocket.OPEN) player1.close();
    if (player2 && player2.readyState === WebSocket.OPEN) player2.close();
  });

  test('Host can create a session', async () => {
    host = new WebSocket(WS_URL);
    await new Promise(res => host.once('open', res));
    host.send(JSON.stringify({ type: 'host', action: 'create' }));
    const msg = await waitForMessage(host);
    expect(msg.type).toBe('host');
    expect(msg.action).toBe('created');
    expect(msg.payload.sessionId).toMatch(/^[A-F0-9]{4}$/);
  });

  test('Player can join a session and host is notified with playerId', async () => {
    // Host creates session
    host = new WebSocket(WS_URL);
    await new Promise(res => host.once('open', res));
    host.send(JSON.stringify({ type: 'host', action: 'create' }));
    const created = await waitForMessage(host);

    // Player joins
    player1 = new WebSocket(WS_URL);
    await new Promise(res => player1.once('open', res));
    player1.send(JSON.stringify({ 
      type: 'player', 
      action: 'join', 
      payload: { 
        sessionId: created.payload.sessionId, 
        name: 'Alice' 
      } 
    }));
    
    const joinMsg = await waitForMessage(player1);
    expect(joinMsg.type).toBe('host');
    expect(joinMsg.action).toBe('join-success');
    expect(joinMsg.payload.sessionId).toBe(created.payload.sessionId);
    expect(joinMsg.payload).toHaveProperty('playerId');
    expect(typeof joinMsg.payload.playerId).toBe('string');

    // Host receives player-joined
    const hostMsg = await waitForMessage(host);
    expect(hostMsg.type).toBe('player-forward');
    expect(hostMsg.action).toBe('player-joined');
    expect(hostMsg.payload.name).toBe('Alice');
    expect(hostMsg.payload).toHaveProperty('playerId');
    expect(typeof hostMsg.payload.playerId).toBe('string');
    expect(hostMsg.payload.playerId).toBe(joinMsg.payload.playerId);
  });

  test('Player action is forwarded to host with playerId', async () => {
    // Host creates session
    host = new WebSocket(WS_URL);
    await new Promise(res => host.once('open', res));
    host.send(JSON.stringify({ type: 'host', action: 'create' }));
    const created = await waitForMessage(host);

    // Player joins
    player1 = new WebSocket(WS_URL);
    await new Promise(res => player1.once('open', res));
    player1.send(JSON.stringify({ 
      type: 'player', 
      action: 'join', 
      payload: { 
        sessionId: created.payload.sessionId, 
        name: 'Bob' 
      } 
    }));
    
    const joinMsg = await waitForMessage(player1); // join-success
    await waitForMessage(host);    // player-joined

    // Player sends action
    player1.send(JSON.stringify({ 
      type: 'player', 
      action: 'guessed', 
      payload: { guess: 'Song A' } 
    }));
    
    const hostMsg = await waitForMessage(host);
    expect(hostMsg.type).toBe('player-forward');
    expect(hostMsg.action).toBe('guessed');
    expect(hostMsg.payload.guess).toEqual('Song A');
    expect(hostMsg.payload.playerName).toBe('Bob');
    expect(typeof hostMsg.payload.serverTimestamp).toBe('number');
    expect(hostMsg.payload).toHaveProperty('playerId');
    expect(typeof hostMsg.payload.playerId).toBe('string');
    expect(hostMsg.payload.playerId).toBe(joinMsg.payload.playerId);
  });

  test('Player cannot join with duplicate name', async () => {
    // Host creates session
    host = new WebSocket(WS_URL);
    await new Promise(res => host.once('open', res));
    host.send(JSON.stringify({ type: 'host', action: 'create' }));
    const created = await waitForMessage(host);

    // First player joins successfully
    player1 = new WebSocket(WS_URL);
    await new Promise(res => player1.once('open', res));
    player1.send(JSON.stringify({ 
      type: 'player', 
      action: 'join', 
      payload: { 
        sessionId: created.payload.sessionId, 
        name: 'DuplicateName' 
      } 
    }));
    
    const joinMsg1 = await waitForMessage(player1);
    expect(joinMsg1.type).toBe('host');
    expect(joinMsg1.action).toBe('join-success');
    await waitForMessage(host); // player-joined notification to host

    // Second player tries to join with the same name
    player2 = new WebSocket(WS_URL);
    await new Promise(res => player2.once('open', res));
    player2.send(JSON.stringify({ 
      type: 'player', 
      action: 'join', 
      payload: { 
        sessionId: created.payload.sessionId, 
        name: 'DuplicateName' 
      } 
    }));
    
    const joinMsg2 = await waitForMessage(player2);
    
    // Verify the second player gets rejected
    expect(joinMsg2.type).toBe('host');
    expect(joinMsg2.action).toBe('join-failed');
    expect(joinMsg2.payload.reason).toBe('A player with this name already exists in the session.');
  });

  test('Player cannot join multiple sessions with same connection', async () => {
    // Create first session
    host = new WebSocket(WS_URL);
    await new Promise(res => host.once('open', res));
    host.send(JSON.stringify({ type: 'host', action: 'create' }));
    const created = await waitForMessage(host);
    
    // Player joins first session
    player1 = new WebSocket(WS_URL);
    await new Promise(res => player1.once('open', res));
    player1.send(JSON.stringify({ 
      type: 'player', 
      action: 'join', 
      payload: { 
        sessionId: created.payload.sessionId, 
        name: 'Player1' 
      } 
    }));
    
    const joinMsg1 = await waitForMessage(player1);
    expect(joinMsg1.type).toBe('host');
    expect(joinMsg1.action).toBe('join-success');
    await waitForMessage(host); // player-joined notification
    
    // Player tries to join another session with same connection
    player1.send(JSON.stringify({ 
      type: 'player', 
      action: 'join', 
      payload: { 
        sessionId: created.payload.sessionId, 
        name: 'AnotherName' 
      } 
    }));
    
    const joinMsg2 = await waitForMessage(player1);
    
    // Verify the join attempt is rejected
    expect(joinMsg2.type).toBe('host');
    expect(joinMsg2.action).toBe('join-failed');
    expect(joinMsg2.payload.reason).toBe('You are already connected to a session as a player.');
  });

  test('Illegal command: join non-existent session', async () => {
    player1 = new WebSocket(WS_URL);
    await new Promise(res => player1.once('open', res));
    player1.send(JSON.stringify({ 
      type: 'player', 
      action: 'join', 
      payload: { 
        sessionId: 'ZZZZ', 
        name: 'Ghost' 
      } 
    }));
    
    const msg = await waitForMessage(player1);
    expect(msg.type).toBe('host');
    expect(msg.action).toBe('join-failed');
    expect(msg.payload.reason).toBe('Session does not exist.');
  });

  test('Illegal command: invalid JSON', async () => {
    player1 = new WebSocket(WS_URL);
    await new Promise(res => player1.once('open', res));
    player1.send('not a json');
    const msg = await waitForMessage(player1);
    expect(msg.type).toBe('host');
    expect(msg.action).toBe('error');
    expect(msg.payload.message).toMatch(/invalid JSON/i);
  });
});