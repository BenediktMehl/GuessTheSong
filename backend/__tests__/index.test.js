const WebSocket = require('ws');

const appConfig = require('../../app-config');

const WS_URL = 'ws://localhost:8080';

function waitForMessage(ws) {
  return new Promise((resolve) => {
    ws.once('message', (msg) => resolve(JSON.parse(msg)));
  });
}

describe(`${appConfig.displayName} WebSocket backend`, () => {
  let host, player1, player2;

  afterEach(() => {
    if (host && host.readyState === WebSocket.OPEN) host.close();
    if (player1 && player1.readyState === WebSocket.OPEN) player1.close();
    if (player2 && player2.readyState === WebSocket.OPEN) player2.close();
  });

  test('Host can create a session', async () => {
    host = new WebSocket(WS_URL);
    await new Promise((res) => host.once('open', res));
    host.send(JSON.stringify({ serverAction: 'create' }));
    const msg = await waitForMessage(host);
    expect(msg.action).toBe('created');
    expect(msg.payload.sessionId).toMatch(/^[A-F0-9]{4}$/);
  });

  test('Player can join a session and host is notified with playerId', async () => {
    // Host creates session
    host = new WebSocket(WS_URL);
    await new Promise((res) => host.once('open', res));
    host.send(JSON.stringify({ serverAction: 'create' }));
    const created = await waitForMessage(host);

    // Player joins
    player1 = new WebSocket(WS_URL);
    await new Promise((res) => player1.once('open', res));
    player1.send(
      JSON.stringify({
        serverAction: 'join',
        serverPayload: {
          sessionId: created.payload.sessionId,
          name: 'Alice',
        },
      })
    );

    const joinMsg = await waitForMessage(player1);
    expect(joinMsg.action).toBe('join-success');
    expect(joinMsg.payload.sessionId).toBe(created.payload.sessionId);
    expect(joinMsg.payload).toHaveProperty('playerId');
    expect(typeof joinMsg.payload.playerId).toBe('string');
    expect(joinMsg.payload).toHaveProperty('players');
    expect(Array.isArray(joinMsg.payload.players)).toBe(true);
    expect(joinMsg.payload.players.length).toBe(1); // Only Alice at this point
    expect(joinMsg.payload.players[0].name).toBe('Alice');

    // Host receives player-joined
    const hostMsg = await waitForMessage(host);
    expect(hostMsg.action).toBe('player-joined');
    expect(hostMsg.payload.name).toBe('Alice');
    expect(hostMsg.payload).toHaveProperty('playerId');
    expect(typeof hostMsg.payload.playerId).toBe('string');
    expect(hostMsg.payload.playerId).toBe(joinMsg.payload.playerId);
  });

  test('Player action is forwarded to host with playerId', async () => {
    // Host creates session
    host = new WebSocket(WS_URL);
    await new Promise((res) => host.once('open', res));
    host.send(JSON.stringify({ serverAction: 'create' }));
    const created = await waitForMessage(host);

    // Player joins
    player1 = new WebSocket(WS_URL);
    await new Promise((res) => player1.once('open', res));
    player1.send(
      JSON.stringify({
        serverAction: 'join',
        serverPayload: {
          sessionId: created.payload.sessionId,
          name: 'Bob',
        },
      })
    );

    const joinMsg = await waitForMessage(player1); // join-success
    await waitForMessage(host); // player-joined

    // Player sends action
    player1.send(
      JSON.stringify({
        serverAction: 'player-action',
        serverPayload: {
          action: 'guessed',
          payload: {
            guess: 'Song A',
            playerId: joinMsg.payload.playerId,
            playerName: 'Bob',
          },
        },
      })
    );

    const hostMsg = await waitForMessage(host);
    expect(hostMsg.action).toBe('guessed');
    expect(hostMsg.payload.guess).toEqual('Song A');
    expect(hostMsg.payload.playerName).toBe('Bob');
    expect(typeof hostMsg.serverTimestamp).toBe('number');
    expect(hostMsg.payload).toHaveProperty('playerId');
    expect(typeof hostMsg.payload.playerId).toBe('string');
    expect(hostMsg.payload.playerId).toBe(joinMsg.payload.playerId);
  });

  test('Player cannot join with duplicate name', async () => {
    // Host creates session
    host = new WebSocket(WS_URL);
    await new Promise((res) => host.once('open', res));
    host.send(JSON.stringify({ serverAction: 'create' }));
    const created = await waitForMessage(host);

    // First player joins successfully
    player1 = new WebSocket(WS_URL);
    await new Promise((res) => player1.once('open', res));
    player1.send(
      JSON.stringify({
        serverAction: 'join',
        serverPayload: {
          sessionId: created.payload.sessionId,
          name: 'DuplicateName',
        },
      })
    );

    const joinMsg1 = await waitForMessage(player1);
    expect(joinMsg1.action).toBe('join-success');
    await waitForMessage(host); // player-joined notification to host

    // Second player tries to join with the same name
    player2 = new WebSocket(WS_URL);
    await new Promise((res) => player2.once('open', res));
    player2.send(
      JSON.stringify({
        serverAction: 'join',
        serverPayload: {
          sessionId: created.payload.sessionId,
          name: 'DuplicateName',
        },
      })
    );

    const joinMsg2 = await waitForMessage(player2);

    // Verify the second player gets rejected
    expect(joinMsg2.action).toBe('join-failed');
    expect(joinMsg2.payload.reason).toBe('A player with this name already exists in the session.');
  });

  test('Player cannot join multiple sessions with same connection', async () => {
    // Create first session
    host = new WebSocket(WS_URL);
    await new Promise((res) => host.once('open', res));
    host.send(JSON.stringify({ serverAction: 'create' }));
    const created = await waitForMessage(host);

    // Player joins first session
    player1 = new WebSocket(WS_URL);
    await new Promise((res) => player1.once('open', res));
    player1.send(
      JSON.stringify({
        serverAction: 'join',
        serverPayload: {
          sessionId: created.payload.sessionId,
          name: 'Player1',
        },
      })
    );

    const joinMsg1 = await waitForMessage(player1);
    expect(joinMsg1.action).toBe('join-success');
    await waitForMessage(host); // player-joined notification

    // Player tries to join another session with same connection
    player1.send(
      JSON.stringify({
        serverAction: 'join',
        serverPayload: {
          sessionId: created.payload.sessionId,
          name: 'AnotherName',
        },
      })
    );

    const joinMsg2 = await waitForMessage(player1);

    // Verify the join attempt is rejected
    expect(joinMsg2.action).toBe('join-failed');
    expect(joinMsg2.payload.reason).toBe('You are already connected to a session as a player.');
  });

  test('Illegal command: join non-existent session', async () => {
    player1 = new WebSocket(WS_URL);
    await new Promise((res) => player1.once('open', res));
    player1.send(
      JSON.stringify({
        serverAction: 'join',
        serverPayload: {
          sessionId: 'ZZZZ',
          name: 'Ghost',
        },
      })
    );

    const msg = await waitForMessage(player1);
    expect(msg.action).toBe('join-failed');
    expect(msg.payload.reason).toBe('Session does not exist.');
  });

  test('Illegal command: invalid JSON', async () => {
    player1 = new WebSocket(WS_URL);
    await new Promise((res) => player1.once('open', res));
    player1.send('not a json');
    const msg = await waitForMessage(player1);
    expect(msg.action).toBe('error');
    expect(msg.payload.message).toMatch(/invalid JSON/i);
  });

  test('Multiple players join, one leaves, another joins, one leaves again', async () => {
    // Host creates session
    host = new WebSocket(WS_URL);
    await new Promise((res) => host.once('open', res));
    host.send(JSON.stringify({ serverAction: 'create' }));
    const created = await waitForMessage(host);
    const sessionId = created.payload.sessionId;

    // Player 1 joins
    player1 = new WebSocket(WS_URL);
    await new Promise((res) => player1.once('open', res));
    player1.send(
      JSON.stringify({
        serverAction: 'join',
        serverPayload: { sessionId, name: 'Player1' },
      })
    );
    await waitForMessage(player1); // join-success
    await waitForMessage(host); // player-joined

    // Player 2 joins
    player2 = new WebSocket(WS_URL);
    await new Promise((res) => player2.once('open', res));
    player2.send(
      JSON.stringify({
        serverAction: 'join',
        serverPayload: { sessionId, name: 'Player2' },
      })
    );
    await waitForMessage(player2); // join-success
    await waitForMessage(host); // player-joined

    // Player 3 joins
    const player3 = new WebSocket(WS_URL);
    await new Promise((res) => player3.once('open', res));
    player3.send(
      JSON.stringify({
        serverAction: 'join',
        serverPayload: { sessionId, name: 'Player3' },
      })
    );
    await waitForMessage(player3); // join-success
    await waitForMessage(host); // player-joined

    // Player 4 joins
    const player4 = new WebSocket(WS_URL);
    await new Promise((res) => player4.once('open', res));
    player4.send(
      JSON.stringify({
        serverAction: 'join',
        serverPayload: { sessionId, name: 'Player4' },
      })
    );
    await waitForMessage(player4); // join-success
    const player4JoinedMsg = await waitForMessage(host); // player-joined
    expect(player4JoinedMsg.action).toBe('player-joined');

    // Player 2 leaves (closes connection)
    player2.close();
    // Note: Host is NOT immediately notified due to 3-minute grace period
    // Wait a bit to ensure disconnect is processed
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Player 5 joins (total should be 5 in session now, though Player2 might reconnect)
    const player5 = new WebSocket(WS_URL);
    await new Promise((res) => player5.once('open', res));
    player5.send(
      JSON.stringify({
        serverAction: 'join',
        serverPayload: { sessionId, name: 'Player5' },
      })
    );
    await waitForMessage(player5); // join-success
    const player5JoinedMsg = await waitForMessage(host); // player-joined
    expect(player5JoinedMsg.action).toBe('player-joined');
    expect(player5JoinedMsg.payload.name).toBe('Player5');

    // Player 4 leaves
    player4.close();
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Now we should have active connections: Player1, Player3, Player5
    // (Player2 and Player4 are in grace period but disconnected)
    // We verify by checking that new players with different names can join
    const player6 = new WebSocket(WS_URL);
    await new Promise((res) => player6.once('open', res));
    player6.send(
      JSON.stringify({
        serverAction: 'join',
        serverPayload: { sessionId, name: 'Player6' },
      })
    );
    const player6JoinMsg = await waitForMessage(player6);
    expect(player6JoinMsg.action).toBe('join-success');
    await waitForMessage(host); // player-joined

    // Verify Player1, Player3, Player5 are still active by checking duplicates
    const duplicateTest1 = new WebSocket(WS_URL);
    await new Promise((res) => duplicateTest1.once('open', res));
    duplicateTest1.send(
      JSON.stringify({
        serverAction: 'join',
        serverPayload: { sessionId, name: 'Player1' },
      })
    );
    const dup1Msg = await waitForMessage(duplicateTest1);
    expect(dup1Msg.action).toBe('join-failed');

    const duplicateTest3 = new WebSocket(WS_URL);
    await new Promise((res) => duplicateTest3.once('open', res));
    duplicateTest3.send(
      JSON.stringify({
        serverAction: 'join',
        serverPayload: { sessionId, name: 'Player3' },
      })
    );
    const dup3Msg = await waitForMessage(duplicateTest3);
    expect(dup3Msg.action).toBe('join-failed');

    const duplicateTest5 = new WebSocket(WS_URL);
    await new Promise((res) => duplicateTest5.once('open', res));
    duplicateTest5.send(
      JSON.stringify({
        serverAction: 'join',
        serverPayload: { sessionId, name: 'Player5' },
      })
    );
    const dup5Msg = await waitForMessage(duplicateTest5);
    expect(dup5Msg.action).toBe('join-failed');

    // Clean up
    player3.close();
    player5.close();
    player6.close();
    duplicateTest1.close();
    duplicateTest3.close();
    duplicateTest5.close();
  });

  test('Players receive complete player list on join', async () => {
    // Host creates session
    host = new WebSocket(WS_URL);
    await new Promise((res) => host.once('open', res));
    host.send(JSON.stringify({ serverAction: 'create' }));
    const created = await waitForMessage(host);
    const sessionId = created.payload.sessionId;

    // Player 1 joins
    player1 = new WebSocket(WS_URL);
    await new Promise((res) => player1.once('open', res));
    player1.send(
      JSON.stringify({
        serverAction: 'join',
        serverPayload: { sessionId, name: 'Player1' },
      })
    );
    const join1Msg = await waitForMessage(player1);
    expect(join1Msg.action).toBe('join-success');
    expect(join1Msg.payload).toHaveProperty('players');
    expect(join1Msg.payload.players.length).toBe(1);
    expect(join1Msg.payload.players[0].name).toBe('Player1');

    await waitForMessage(host); // host notification

    // Player 2 joins - should get list of 2 players
    player2 = new WebSocket(WS_URL);
    await new Promise((res) => player2.once('open', res));
    player2.send(
      JSON.stringify({
        serverAction: 'join',
        serverPayload: { sessionId, name: 'Player2' },
      })
    );

    const join2Msg = await waitForMessage(player2);
    expect(join2Msg.action).toBe('join-success');
    expect(join2Msg.payload).toHaveProperty('players');
    expect(join2Msg.payload.players.length).toBe(2);

    const playerNames = join2Msg.payload.players.map((p) => p.name);
    expect(playerNames).toContain('Player1');
    expect(playerNames).toContain('Player2');
  });
});
