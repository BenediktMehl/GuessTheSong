import { Page, expect } from '@playwright/test';

/**
 * Wait for game code to appear in the UI
 */
export async function waitForGameCode(page: Page): Promise<string> {
  // Wait for game code element to appear
  // Game code is displayed in the GameCode component as a large text element
  // Look for text matching the pattern (4 uppercase hex characters)
  await page.waitForSelector('text=/^[A-F0-9]{4}$/', { timeout: 15000 });

  // Extract game code from the page
  // The game code is displayed in a span with font-mono class
  const gameCodeElement = page.locator('.font-mono').filter({ hasText: /^[A-F0-9]{4}$/ }).first();
  
  // Wait for it to be visible
  await gameCodeElement.waitFor({ state: 'visible', timeout: 10000 });
  
  const gameCode = await gameCodeElement.textContent();

  if (!gameCode || gameCode.trim().length !== 4) {
    throw new Error(`Game code not found or invalid: ${gameCode}`);
  }

  return gameCode.trim().toUpperCase();
}

/**
 * Join game as a player
 */
export async function joinGameAsPlayer(
  page: Page,
  gameCode: string,
  playerName: string
): Promise<void> {
  // Navigate to join page if not already there
  if (!page.url().includes('/join')) {
    await page.goto('/join');
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
  }

  // Wait for game code input with longer timeout and better error handling
  await page.waitForSelector('#game-code', { timeout: 10000, state: 'visible' });

  // Fill in game code
  await page.fill('#game-code', gameCode);

  // Wait for name input to be focused or visible
  await page.waitForSelector('#player-name', { timeout: 5000 });

  // Fill in player name
  await page.fill('#player-name', playerName);

  // Click join button
  await page.click('button:has-text("Join Game")');

  // Wait for navigation to lobby or game page
  // Note: The route is /lobby or /play, not /player/lobby or /player/play
  await page.waitForURL(/\/(lobby|play)/, { timeout: 10000 });
}

/**
 * Click the buzzer button
 */
export async function clickBuzzer(page: Page): Promise<void> {
  // Wait for page to be fully loaded
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // The buzzer button is a large circular button with specific styling
  // It's typically the largest button on the page and has a rounded-full class
  // Look for button with aria-label containing "buzzer" or "guess"
  try {
    // First try to find by aria-label
    const buzzerByLabel = page.locator('button[aria-label*="buzzer" i], button[aria-label*="guess" i]').filter({ hasNot: page.locator('[disabled]') });
    if (await buzzerByLabel.count() > 0) {
      await buzzerByLabel.first().click({ timeout: 5000 });
      return;
    }
  } catch {
    // Continue to other methods
  }

  // Find all non-disabled buttons and get their sizes
  const buttons = page.locator('button:not([disabled])');
  const buttonCount = await buttons.count();
  
  if (buttonCount === 0) {
    throw new Error('No enabled buttons found on page');
  }

  // Find the largest button (the buzzer is typically the largest)
  let largestButton = null;
  let largestSize = 0;

  for (let i = 0; i < buttonCount; i++) {
    const button = buttons.nth(i);
    const box = await button.boundingBox();
    if (box) {
      const size = box.width * box.height;
      if (size > largestSize && box.width > 80 && box.height > 80) {
        largestSize = size;
        largestButton = button;
      }
    }
  }

  if (largestButton) {
    await largestButton.click();
  } else {
    // Fallback: click the first large rounded button
    await page.locator('button.rounded-full:not([disabled])').first().click({ timeout: 5000 });
  }
}

/**
 * Wait for buzzer notification to appear
 */
export async function waitForBuzzerNotification(page: Page, playerName: string): Promise<void> {
  // Wait for notification toast to appear
  // The notification shows: "<strong>{playerName}</strong> pressed the buzzer!"
  // Look for the player name first (might be in a strong tag)
  await page.waitForSelector(`text=${playerName}`, { timeout: 15000 });
  
  // Then verify the notification text is visible
  // The text might be split across elements, so look for either the player name or "buzzer" text
  const notificationVisible = await page.locator(`text=${playerName}`).isVisible().catch(() => false);
  if (!notificationVisible) {
    // Fallback: look for "buzzer" text in the notification area
    await page.waitForSelector('.toast, .alert', { timeout: 5000 });
    const buzzerText = await page.locator('text=/buzzer/i').first().isVisible().catch(() => false);
    if (!buzzerText) {
      throw new Error(`Buzzer notification for ${playerName} not found`);
    }
  }
}

/**
 * Wait for player to appear in the lobby
 */
export async function waitForPlayerInLobby(page: Page, playerName: string): Promise<void> {
  // Wait for player name to appear in the players list
  await page.waitForSelector(`text=${playerName}`, { timeout: 10000 });
}

/**
 * Click the start game button
 */
export async function clickStartGame(page: Page): Promise<void> {
  // Wait for start game button to be visible and enabled
  // The button text is "🎮 Start Game" and requires at least 2 players and Spotify login
  await page.waitForSelector('button:has-text("Start Game")', { 
    timeout: 15000,
    state: 'visible'
  });
  
  // Wait for button to be enabled (requires at least 2 players and Spotify connected)
  // The button is disabled if players.length < 2 or !isLoggedInSpotify
  const startButton = page.locator('button:has-text("Start Game")').filter({ hasNot: page.locator('[disabled]') });
  
  // Wait for button to be enabled
  await startButton.waitFor({ state: 'visible', timeout: 15000 });
  
  // Click the start game button
  await startButton.click();

  // Wait for navigation to game page
  // The route is /hostgame, not /host/game
  await page.waitForURL(/\/hostgame/, { timeout: 15000 });
}

/**
 * Verify song is playing (check player state directly and UI)
 */
export async function verifySongPlaying(page: Page): Promise<boolean> {
  // First check the mock player state directly (more reliable)
  const playerState = await page.evaluate(async () => {
    const player = (window as any).__mockSpotifyPlayer;
    if (player) {
      try {
        const state = await player.getCurrentState();
        if (state && !state.paused && state.track_window?.current_track) {
          return {
            playing: true,
            trackName: state.track_window.current_track.name,
            paused: state.paused,
          };
        }
      } catch (e) {
        // Error getting state
      }
    }
    return { playing: false, trackName: null, paused: true };
  });

  // If mock player says it's playing, check UI
  if (playerState.playing && !playerState.paused) {
    try {
      // Wait for UI to update - look for PAUSE button (song is playing) or track info
      await page.waitForSelector('button:has-text("PAUSE"), button:has-text("PLAY")', { 
        timeout: 5000 
      });
      
      // Check if PAUSE button is visible (indicates playing)
      const pauseButton = page.locator('button:has-text("PAUSE")');
      const pauseVisible = await pauseButton.isVisible().catch(() => false);
      
      if (pauseVisible) {
        return true;
      }
      
      // Also check if track name is visible (alternative indicator)
      if (playerState.trackName) {
        const trackVisible = await page.locator(`text=/${playerState.trackName}/i`).first().isVisible().catch(() => false);
        if (trackVisible) {
          return true;
        }
      }
      
      // If player state says playing but UI doesn't show it yet, give it a moment
      // The UI might be updating asynchronously
      await page.waitForTimeout(1000);
      const pauseButtonAfterWait = page.locator('button:has-text("PAUSE")');
      return await pauseButtonAfterWait.isVisible().catch(() => false);
    } catch {
      // UI check failed, but player state says playing
      // Trust the player state if it's clearly playing
      return playerState.playing && !playerState.paused;
    }
  }
  
  // Player state says not playing
  return false;
}

/**
 * Verify song is paused (check UI state)
 */
export async function verifySongPaused(page: Page): Promise<boolean> {
  // Check if play button is visible (indicates song is paused)
  // The button text changes from "PAUSE" to "PLAY" when paused
  try {
    // Wait for play button to appear (song was paused)
    await page.waitForSelector('button:has-text("PLAY")', { timeout: 10000 });
    const playButton = page.locator('button:has-text("PLAY")');
    const isVisible = await playButton.isVisible().catch(() => false);
    return isVisible;
  } catch {
    // Play button might not be visible yet, check if pause button is gone
    const pauseButton = page.locator('button:has-text("PAUSE")');
    const pauseVisible = await pauseButton.isVisible().catch(() => true);
    return !pauseVisible; // If pause button is not visible, song is likely paused
  }
}

/**
 * Set selected playlist in localStorage (for host)
 */
export async function setSelectedPlaylist(page: Page, playlistId: string): Promise<void> {
  await page.addInitScript(
    (id) => {
      localStorage.setItem('spotify_selected_playlist_id', id);
    },
    playlistId
  );
}

/**
 * Wait for WebSocket connection to be established
 */
export async function waitForWebSocketConnection(page: Page): Promise<void> {
  // Wait for page to load and WebSocket to connect
  // This is indicated by the UI being ready (no loading states)
  await page.waitForLoadState('networkidle', { timeout: 10000 });
}

