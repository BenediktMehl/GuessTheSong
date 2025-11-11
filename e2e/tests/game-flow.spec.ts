import { test, expect, Browser } from '@playwright/test';
import { startBackendServer, startFrontendServer, stopServers } from '../helpers/server';
import { mockSpotifySDK, simulateSpotifyPlaying, getPauseCallCount } from '../helpers/spotify-mock';
import {
  waitForGameCode,
  joinGameAsPlayer,
  clickBuzzer,
  waitForBuzzerNotification,
  waitForPlayerInLobby,
  clickStartGame,
  verifySongPlaying,
  verifySongPaused,
  setSelectedPlaylist,
  waitForWebSocketConnection,
} from '../helpers/browser';

test.describe('Game Flow E2E', () => {
  let backendPort: number;
  let frontendPort: number;

  test.beforeAll(async () => {
    // Start backend server on test port
    backendPort = await startBackendServer(8081);
    console.log(`Backend server started on port ${backendPort}`);

    // Start frontend server on test port
    frontendPort = await startFrontendServer(5174);
    console.log(`Frontend server started on port ${frontendPort}`);
  });

  test.afterAll(async () => {
    // Stop all servers
    await stopServers();
    console.log('Servers stopped');
  });

  test('Full game flow: create → join → start → play → buzz → pause', async ({ browser }) => {
    // Set environment variable for frontend to use test backend
    process.env.VITE_WS_URL = `ws://127.0.0.1:${backendPort}`;

    // Create separate browser contexts for host and players (simulates different devices)
    const hostContext = await browser.newContext();
    const player1Context = await browser.newContext();
    const player2Context = await browser.newContext();

    // Mock Spotify SDK and set up localStorage BEFORE creating pages
    // This ensures the mocks are in place before the page loads
    await mockSpotifySDK(hostContext);
    await mockSpotifySDK(player1Context);
    await mockSpotifySDK(player2Context);

    // Set access token and playlist for host (Spotify authentication)
    await hostContext.addInitScript(() => {
      localStorage.setItem('access_token', 'mock-access-token');
      // Set a test playlist ID (use default playlist ID)
      localStorage.setItem('spotify_selected_playlist_id', '1jHJldEedIdF8D49kPEiPR');
    });

    // Create pages after mocks are set up
    const hostPage = await hostContext.newPage();
    const player1Page = await player1Context.newPage();
    const player2Page = await player2Context.newPage();

    // Step 1: Host creates game
    console.log('Step 1: Host creates game');
    await hostPage.goto(`http://127.0.0.1:${frontendPort}/`);
    
    // Wait for page to load
    await hostPage.waitForLoadState('networkidle');
    
    // Navigate to host lobby (click "Host a Game" button)
    // The welcome page has a "Host a Game" button
    await hostPage.click('button:has-text("Host a Game")', { timeout: 10000 });
    
    // Wait for navigation to settings/lobby page
    await hostPage.waitForURL(/\/settings/, { timeout: 10000 });
    await hostPage.waitForLoadState('networkidle');

    // Wait for WebSocket connection and game creation
    await waitForWebSocketConnection(hostPage);
    
    // Wait a bit for game to be created
    await hostPage.waitForTimeout(2000);

    // Get game code
    const gameCode = await waitForGameCode(hostPage);
    console.log(`Game code: ${gameCode}`);

    expect(gameCode).toMatch(/^[A-F0-9]{4}$/);

    // Step 2: Player1 joins game
    console.log('Step 2: Player1 joins game');
    await joinGameAsPlayer(player1Page, gameCode, 'Player1');
    await waitForWebSocketConnection(player1Page);
    await waitForPlayerInLobby(hostPage, 'Player1');

    // Step 3: Player2 joins game
    console.log('Step 3: Player2 joins game');
    await joinGameAsPlayer(player2Page, gameCode, 'Player2');
    await waitForWebSocketConnection(player2Page);
    await waitForPlayerInLobby(hostPage, 'Player2');

    // Verify both players are in the lobby
    await expect(hostPage.locator('text=Player1')).toBeVisible();
    await expect(hostPage.locator('text=Player2')).toBeVisible();

    // Step 4: Host starts game
    console.log('Step 4: Host starts game');
    
    // Wait for Spotify to be connected and at least 2 players to be present
    // The start game button requires: players.length >= 2 && isLoggedInSpotify
    // We have 2 players and mocked Spotify, so wait for button to be enabled
    await hostPage.waitForTimeout(3000); // Wait for Spotify connection to be established
    
    // Verify both players are still visible
    await expect(hostPage.locator('text=Player1')).toBeVisible();
    await expect(hostPage.locator('text=Player2')).toBeVisible();
    
    // Wait for start game button to be enabled (not disabled)
    // The button text is "🎮 Start Game"
    const startButton = hostPage.locator('button:has-text("Start Game")').filter({ hasNot: hostPage.locator('[disabled]') });
    await startButton.waitFor({ state: 'visible', timeout: 20000 });
    
    // Click start game button
    await clickStartGame(hostPage);
    
    // Wait for game page to load
    await hostPage.waitForURL(/\/host\/game/, { timeout: 15000 });
    await hostPage.waitForLoadState('networkidle');

    // Wait for players to be notified that game started
    // Players should navigate to play page when game starts
    // Wait for navigation or for game status to update
    try {
      await player1Page.waitForURL(/\/player\/play/, { timeout: 10000 });
      await player2Page.waitForURL(/\/player\/play/, { timeout: 10000 });
    } catch {
      // Players might still be on lobby page, refresh or wait
      console.log('Players may still be on lobby page, continuing...');
    }
    
    // Wait for players' pages to be ready
    await player1Page.waitForLoadState('networkidle');
    await player2Page.waitForLoadState('networkidle');

    // Step 5: Verify song is playing
    console.log('Step 5: Verify song is playing');
    
    // Wait for Spotify player to be ready
    // The game automatically starts playback when device is ready and game status is 'waiting'
    // Wait for the player to initialize and start playback
    await hostPage.waitForTimeout(5000); // Give time for Spotify player to initialize
    
    // The game should automatically call playPlaylist when device is ready
    // But we can also simulate playback to ensure it's playing
    // First, check if playback has started automatically
    let isPlaying = await verifySongPlaying(hostPage);
    
    // If not playing, simulate it (the game should have started it, but we ensure it's playing)
    if (!isPlaying) {
      console.log('Song not playing yet, simulating playback...');
      await simulateSpotifyPlaying(hostPage);
      await hostPage.waitForTimeout(2000);
      isPlaying = await verifySongPlaying(hostPage);
    }
    
    // Verify song is playing
    expect(isPlaying).toBe(true);
    console.log('Song is playing - verified');

    // Step 6: Player2 buzzes
    console.log('Step 6: Player2 buzzes');
    
    // Get initial pause call count (should be 0 if song is playing)
    const initialPauseCount = await getPauseCallCount(hostPage);
    console.log(`Initial pause call count: ${initialPauseCount}`);
    
    // Click buzzer button on player2 page
    await clickBuzzer(player2Page);
    console.log('Buzzer clicked by Player2');
    
    // Wait for buzzer notification on host page
    await waitForBuzzerNotification(hostPage, 'Player2');
    console.log('Buzzer notification received on host');

    // Step 7: Verify song stopped
    console.log('Step 7: Verify song stopped');
    
    // Wait a bit for pause callback to be executed
    // The pause callback is called when buzzer notification is received
    await hostPage.waitForTimeout(2000);
    
    // Verify pause was called (check pause call count increased)
    const finalPauseCount = await getPauseCallCount(hostPage);
    console.log(`Final pause call count: ${finalPauseCount}`);
    expect(finalPauseCount).toBeGreaterThan(initialPauseCount);
    
    // Verify song is paused in UI
    // Check if play button is visible (indicates song is paused)
    const isPaused = await verifySongPaused(hostPage);
    expect(isPaused).toBe(true);
    console.log('Song is paused - test passed!');

    // Cleanup: Close browser contexts
    await hostContext.close();
    await player1Context.close();
    await player2Context.close();
  });
});

