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
  if (!page.url().includes('/player/join')) {
    await page.goto('/player/join');
  }

  // Wait for game code input
  await page.waitForSelector('#game-code', { timeout: 5000 });

  // Fill in game code
  await page.fill('#game-code', gameCode);

  // Wait for name input to be focused or visible
  await page.waitForSelector('#player-name', { timeout: 5000 });

  // Fill in player name
  await page.fill('#player-name', playerName);

  // Click join button
  await page.click('button:has-text("Join Game")');

  // Wait for navigation to lobby or game page
  await page.waitForURL(/\/player\/(lobby|play)/, { timeout: 10000 });
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
  // Wait for notification toast to appear with player name
  await page.waitForSelector(`text=${playerName}`, { timeout: 10000 });
  // The notification should say something like "{playerName} pressed the buzzer!"
  await expect(page.locator('text=/pressed the buzzer/i')).toBeVisible({ timeout: 5000 });
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
  await page.waitForURL(/\/host\/game/, { timeout: 15000 });
}

/**
 * Verify song is playing (check UI state)
 */
export async function verifySongPlaying(page: Page): Promise<boolean> {
  // Check if song is playing by looking for:
  // 1. Track name displayed (song info visible)
  // 2. Pause button visible (indicates song is playing, not paused)
  // 3. Player state shows playing
  
  try {
    // Wait for either track name or pause button to appear
    await page.waitForSelector('button:has-text("PAUSE"), text=/Test Song/i, text=/Song/i', { 
      timeout: 10000 
    });
    
    // Check if pause button is visible (indicates song is playing)
    const pauseButton = page.locator('button:has-text("PAUSE")');
    const pauseVisible = await pauseButton.isVisible().catch(() => false);
    
    if (pauseVisible) {
      return true;
    }
    
    // Alternative: check if track name is visible (song info is displayed)
    const trackVisible = await page.locator('text=/Test Song/i, text=/Song/i').first().isVisible().catch(() => false);
    return trackVisible;
  } catch {
    // Song might not be playing yet
    return false;
  }
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

