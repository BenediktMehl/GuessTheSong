/**
 * Plays a buzzer sound using HTML5 Audio API
 * Uses an audio file from the public/sounds directory
 */

// Create a single Audio instance that can be reused
let buzzerAudio: HTMLAudioElement | null = null;

function getBuzzerAudio(): HTMLAudioElement {
  if (!buzzerAudio) {
    buzzerAudio = new Audio('/sounds/buzzer.mp3');
    buzzerAudio.volume = 0.7; // Set volume to 70%
    // Preload the audio for faster playback
    buzzerAudio.preload = 'auto';
  }
  return buzzerAudio;
}

/**
 * Sets the muted state of the buzzer audio
 * @param muted - Whether the audio should be muted
 */
export function setBuzzerSoundMuted(muted: boolean): void {
  const audio = getBuzzerAudio();
  audio.muted = muted;
  // If muting and audio is playing, stop it
  if (muted && !audio.paused) {
    audio.pause();
    audio.currentTime = 0;
  }
}

export function playBuzzerSound(): void {
  try {
    const audio = getBuzzerAudio();

    // Don't play if muted
    if (audio.muted) {
      return;
    }

    // Reset audio to beginning if it's already playing
    if (!audio.paused) {
      audio.pause();
    }
    audio.currentTime = 0;

    // Play the sound
    audio.play().catch((error) => {
      // Silently fail if autoplay is blocked - this is expected in some browsers
      // until user interaction occurs
      console.warn('[Buzzer Sound] Failed to play buzzer sound:', error);
    });
  } catch (error) {
    console.warn('[Buzzer Sound] Failed to play buzzer sound:', error);
    // Silently fail - audio might not be supported
  }
}
