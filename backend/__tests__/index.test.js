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
    host.send(JSON.stringify({ type: 'create', role: 'host' }));
    const msg = await waitForMessage(host);
    expect(msg.type).toBe('created');
    expect(msg.sessionId).toMatch(/^[A-F0-9]{4}$/);
  });

  test('Player can join a session and host is notified with playerId', async () => {
    // Host creates session
    host = new WebSocket(WS_URL);
    await new Promise(res => host.once('open', res));
    host.send(JSON.stringify({ type: 'create', role: 'host' }));
    const created = await waitForMessage(host);

    // Player joins
    player1 = new WebSocket(WS_URL);
    await new Promise(res => player1.once('open', res));
    player1.send(JSON.stringify({ type: 'join', role: 'player', sessionId: created.sessionId, payload: { name: 'Alice' } }));
    const joinMsg = await waitForMessage(player1);
    expect(joinMsg.type).toBe('join-success');
    expect(joinMsg.sessionId).toBe(created.sessionId);
    expect(joinMsg).toHaveProperty('playerId');
    expect(typeof joinMsg.playerId).toBe('string');

    // Host receives player-joined
    const hostMsg = await waitForMessage(host);
    expect(hostMsg.type).toBe('player-joined');
    expect(hostMsg.name).toBe('Alice');
    expect(hostMsg).toHaveProperty('playerId');
    expect(typeof hostMsg.playerId).toBe('string');
    expect(hostMsg.playerId).toBe(joinMsg.playerId);
  });

  test('Player action is forwarded to host with playerId', async () => {
    // Host creates session
    host = new WebSocket(WS_URL);
    await new Promise(res => host.once('open', res));
    host.send(JSON.stringify({ type: 'create', role: 'host' }));
    const created = await waitForMessage(host);

    // Player joins
    player1 = new WebSocket(WS_URL);
    await new Promise(res => player1.once('open', res));
    player1.send(JSON.stringify({ type: 'join', role: 'player', sessionId: created.sessionId, payload: { name: 'Bob' } }));
    const joinMsg = await waitForMessage(player1); // join-success
    await waitForMessage(host);    // player-joined

    // Player sends action
    player1.send(JSON.stringify({ type: 'player-action', payload: { guess: 'Song A' } }));
    const hostMsg = await waitForMessage(host);
    expect(hostMsg.type).toBe('player-action');
    expect(hostMsg.payload).toEqual({ guess: 'Song A' });
    expect(hostMsg.name).toBe('Bob');
    expect(typeof hostMsg.serverTimestamp).toBe('number');
    expect(hostMsg).toHaveProperty('playerId');
    expect(typeof hostMsg.playerId).toBe('string');
    expect(hostMsg.playerId).toBe(joinMsg.playerId);
  });

  test('Illegal command: join non-existent session', async () => {
    player1 = new WebSocket(WS_URL);
    await new Promise(res => player1.once('open', res));
    player1.send(JSON.stringify({ type: 'join', role: 'player', sessionId: 'ZZZZ', payload: { name: 'Ghost' } }));
    const msg = await waitForMessage(player1);
    expect(msg.type).toBe('join-failed');
    expect(msg.reason).toBe('Session does not exist.');
  });

  test('Illegal command: invalid JSON', async () => {
    player1 = new WebSocket(WS_URL);
    await new Promise(res => player1.once('open', res));
    player1.send('not a json');
    const msg = await waitForMessage(player1);
    expect(msg.type).toBe('error');
    expect(msg.message).toMatch(/invalid JSON/i);
  });
});