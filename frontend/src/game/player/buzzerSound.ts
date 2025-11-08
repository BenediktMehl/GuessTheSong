import { getRandomBuzzerSound } from '../../utils/buzzerSounds';

// Store the selected buzzer sound for this player's session
let selectedBuzzerSound: string | null = null;
let audioElement: HTMLAudioElement | null = null;
// Global mute state (independent of audioElement)
let isMuted: boolean = false;

/**
 * Initializes the buzzer sound by randomly selecting an MP3 file (if available).
 * This should be called when the player's game component mounts.
 * Similar to how buzzer colors are randomly selected.
 */
export function initializeBuzzerSound(): void {
  selectedBuzzerSound = getRandomBuzzerSound();

  // Preload the audio if a sound file was selected
  if (selectedBuzzerSound) {
    try {
      audioElement = new Audio(selectedBuzzerSound);
      audioElement.preload = 'auto';
      // Handle potential loading errors
      audioElement.addEventListener('error', () => {
        console.warn('[Buzzer Sound] Failed to load MP3 file');
        selectedBuzzerSound = null;
        audioElement = null;
      });
    } catch (error) {
      console.warn('[Buzzer Sound] Failed to create audio element:', error);
      selectedBuzzerSound = null;
      audioElement = null;
    }
  }
}

/**
 * Plays a buzzer sound using the selected MP3 file (if available).
 * Fails silently if MP3 is not available or if playback fails.
 */
export function playBuzzerSound(): void {
  // Don't play if muted
  if (isMuted) {
    return;
  }

  // Try to play MP3 file if one was selected
  if (selectedBuzzerSound && audioElement && audioElement.muted === false) {
    try {
      // Reset the audio to the beginning in case it's still playing
      if (!audioElement.paused) {
        audioElement.pause();
      }
      audioElement.currentTime = 0;

      // Play the audio
      const playPromise = audioElement.play();

      // Handle play promise rejection (e.g., autoplay policies)
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            // Audio is playing successfully
          })
          .catch((error) => {
            // Fail silently if MP3 playback fails
            console.warn('[Buzzer Sound] Failed to play MP3:', error);
          });
      }
      return;
    } catch (error) {
      // Fail silently if MP3 playback fails
      console.warn('[Buzzer Sound] Error playing MP3:', error);
      return;
    }
  }
}

/**
 * Sets the muted state of the buzzer audio
 * @param muted - Whether the audio should be muted
 */
export function setBuzzerSoundMuted(muted: boolean): void {
  // Update global mute state
  isMuted = muted;

  // Also update audioElement if it exists
  if (audioElement) {
    audioElement.muted = muted;
    // If muting and audio is playing, stop it
    if (muted && !audioElement.paused) {
      audioElement.pause();
      audioElement.currentTime = 0;
    }
  }
}
