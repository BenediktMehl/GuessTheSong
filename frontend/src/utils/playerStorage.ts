const STORAGE_KEY = 'guessTheSong_playerData';

export interface PlayerData {
  playerId: string;
  sessionId: string;
  playerName: string;
}

export function savePlayerData(playerId: string, sessionId: string, playerName: string): void {
  try {
    const data: PlayerData = {
      playerId,
      sessionId: sessionId.toUpperCase(),
      playerName,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save player data to localStorage:', error);
  }
}

export function getPlayerData(): PlayerData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }
    const data = JSON.parse(stored) as PlayerData;
    // Validate that all required fields are present
    if (data.playerId && data.sessionId && data.playerName) {
      return data;
    }
    return null;
  } catch (error) {
    console.error('Failed to read player data from localStorage:', error);
    return null;
  }
}

export function clearPlayerData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear player data from localStorage:', error);
  }
}

