/**
 * Plays a buzzer sound using Web Audio API
 * The sound duration is approximately 600ms (2-3x longer than a typical short buzzer)
 */
export function playBuzzerSound(): void {
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
