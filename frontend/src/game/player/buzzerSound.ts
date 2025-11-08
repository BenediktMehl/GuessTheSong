import { getRandomBuzzerSound } from '../../utils/buzzerSounds';

// Store the selected buzzer sound for this player's session
let selectedBuzzerSound: string | null = null;
let audioElement: HTMLAudioElement | null = null;

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
        console.warn('[Buzzer Sound] Failed to load MP3 file, will fallback to Web Audio API');
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
 * Plays a buzzer sound using the selected MP3 file (if available),
 * or falls back to Web Audio API if no MP3 files are available or if playback fails.
 */
export function playBuzzerSound(): void {
  // Try to play MP3 file if one was selected
  if (selectedBuzzerSound && audioElement) {
    // Don't play if muted
    if (audioElement.muted) {
      return;
    }

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
            // Fallback to Web Audio API if MP3 playback fails
            console.warn(
              '[Buzzer Sound] Failed to play MP3, falling back to Web Audio API:',
              error
            );
            playWebAudioBuzzerSound();
          });
      }
      return;
    } catch (error) {
      // Fallback to Web Audio API if MP3 playback fails
      console.warn('[Buzzer Sound] Error playing MP3, falling back to Web Audio API:', error);
      playWebAudioBuzzerSound();
      return;
    }
  }

  // Fallback to Web Audio API if no MP3 file is available
  playWebAudioBuzzerSound();
}

/**
 * Sets the muted state of the buzzer audio
 * @param muted - Whether the audio should be muted
 */
export function setBuzzerSoundMuted(muted: boolean): void {
  if (audioElement) {
    audioElement.muted = muted;
    // If muting and audio is playing, stop it
    if (muted && !audioElement.paused) {
      audioElement.pause();
      audioElement.currentTime = 0;
    }
  }
}

/**
 * Plays a buzzer sound using Web Audio API
 * The sound duration is approximately 600ms (2-3x longer than a typical short buzzer)
 * This is used as a fallback when no MP3 files are available or when MP3 playback fails.
 */
function playWebAudioBuzzerSound(): void {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      console.warn('[Buzzer Sound] Web Audio API not supported');
      return;
    }

    const audioContext = new AudioContextClass();

    // Function to play the actual sound
    const playSound = () => {
      // Create oscillator for the buzzer tone
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      // Connect oscillator to gain node, then to destination
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Configure buzzer sound characteristics
      // Start with a high frequency (800Hz) and drop to lower frequency (400Hz) for a classic buzzer effect
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.6);

      // Set oscillator type to 'sawtooth' for a harsh buzzer sound
      oscillator.type = 'sawtooth';

      // Configure volume envelope (attack, sustain, release)
      const now = audioContext.currentTime;
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.3, now + 0.05); // Quick attack (50ms)
      gainNode.gain.setValueAtTime(0.3, now + 0.5); // Sustain for most of the duration
      gainNode.gain.linearRampToValueAtTime(0, now + 0.6); // Quick release (100ms)

      // Play the sound for 600ms (2-3x longer than typical 200-300ms buzzer)
      oscillator.start(now);
      oscillator.stop(now + 0.6);

      // Clean up after sound finishes
      oscillator.onended = () => {
        audioContext.close().catch((error) => {
          console.warn('[Buzzer Sound] Failed to close audio context:', error);
        });
      };
    };

    // Resume audio context if it's suspended (required for some browsers)
    if (audioContext.state === 'suspended') {
      audioContext
        .resume()
        .then(() => {
          playSound();
        })
        .catch((error) => {
          console.warn('[Buzzer Sound] Failed to resume audio context:', error);
        });
    } else {
      playSound();
    }
  } catch (error) {
    console.warn('[Buzzer Sound] Failed to play buzzer sound:', error);
    // Silently fail - audio might not be supported or user interaction required
  }
}
