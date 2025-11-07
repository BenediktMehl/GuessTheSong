/**
 * Plays a buzzer sound using Web Audio API
 * Creates a harsh, buzzy sound typical of game show buzzers
 */
export function playBuzzerSound(): void {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      console.warn('Web Audio API not supported');
      return;
    }

    const audioContext = new AudioContextClass();

    // Function to create and play the buzzer sound
    const createBuzzerSound = () => {
      // Create a harsh buzzer sound using multiple oscillators with distortion
      const oscillator1 = audioContext.createOscillator();
      const oscillator2 = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      const compressor = audioContext.createDynamicsCompressor();

      // Configure oscillators for a buzzy sound
      oscillator1.type = 'square';
      oscillator1.frequency.setValueAtTime(150, audioContext.currentTime);
      oscillator1.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.1);

      oscillator2.type = 'sawtooth';
      oscillator2.frequency.setValueAtTime(300, audioContext.currentTime);
      oscillator2.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.1);

      // Create gain envelope for sharp attack and quick decay
      const now = audioContext.currentTime;
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.3, now + 0.01); // Quick attack
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15); // Quick decay

      // Configure compressor for more punch
      compressor.threshold.setValueAtTime(-24, now);
      compressor.knee.setValueAtTime(30, now);
      compressor.ratio.setValueAtTime(12, now);
      compressor.attack.setValueAtTime(0.003, now);
      compressor.release.setValueAtTime(0.25, now);

      // Connect: oscillators -> gain -> compressor -> destination
      oscillator1.connect(gainNode);
      oscillator2.connect(gainNode);
      gainNode.connect(compressor);
      compressor.connect(audioContext.destination);

      // Start and stop the sound
      oscillator1.start(now);
      oscillator2.start(now);
      oscillator1.stop(now + 0.15);
      oscillator2.stop(now + 0.15);

      // Clean up after sound finishes
      setTimeout(() => {
        try {
          oscillator1.disconnect();
          oscillator2.disconnect();
          gainNode.disconnect();
          compressor.disconnect();
        } catch (_error) {
          // Ignore cleanup errors
        }
      }, 200);
    };

    // Resume audio context if it's suspended (required by some browsers)
    // Since this is triggered by user interaction, it should typically be ready
    if (audioContext.state === 'suspended') {
      audioContext
        .resume()
        .then(() => {
          createBuzzerSound();
        })
        .catch((error) => {
          console.warn('Could not resume audio context:', error);
        });
    } else {
      createBuzzerSound();
    }
  } catch (error) {
    // Silently fail if audio context is not available
    console.warn('Could not play buzzer sound:', error);
  }
}
