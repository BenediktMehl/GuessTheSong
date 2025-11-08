import { BUZZER_SOUNDS } from './buzzerSoundsManifest';

/**
 * Gets a random buzzer sound path from available MP3 files.
 * Returns null if no sounds are available (will fallback to Web Audio API).
 */
export function getRandomBuzzerSound(): string | null {
  if (BUZZER_SOUNDS.length === 0) {
    return null;
  }
  const randomIndex = Math.floor(Math.random() * BUZZER_SOUNDS.length);
  return BUZZER_SOUNDS[randomIndex];
}
