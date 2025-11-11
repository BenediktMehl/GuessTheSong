import { Page, BrowserContext } from '@playwright/test';

/**
 * Mock Spotify Web Playback SDK and API in the browser
 * Can be called with either a Page or BrowserContext
 */
export async function mockSpotifySDK(pageOrContext: Page | BrowserContext): Promise<void> {
  // Get the context (either directly or from the page)
  const context = 'pages' in pageOrContext ? pageOrContext : (pageOrContext as Page).context();
  
  // Use addInitScript on the context to ensure it runs before page loads
  await context.addInitScript(() => {
    // Mock localStorage access token
    if (!localStorage.getItem('access_token')) {
      localStorage.setItem('access_token', 'mock-access-token');
    }

    // Mock window.Spotify
    (window as any).Spotify = {
      Player: class MockSpotifyPlayer {
        private deviceId: string;
        private listeners: Map<string, Array<(data: any) => void>> = new Map();
        private isPaused = true;
        private isPlaying = false;
        public currentTrack: any = null;
        private position = 0;

        constructor(options: {
          name: string;
          getOAuthToken: (callback: (token: string) => void) => void;
          volume?: number;
        }) {
          this.deviceId = `mock-device-${Date.now()}`;
          // Store reference to this instance for external control
          (window as any).__mockSpotifyPlayer = this;
          (window as any).__mockSpotifyPlayerInstance = this;

          // Store getOAuthToken callback
          if (options.getOAuthToken) {
            options.getOAuthToken('mock-access-token');
          }
        }

        async connect(): Promise<boolean> {
          // Simulate connection delay
          await new Promise((resolve) => setTimeout(resolve, 50));
          // Trigger ready event immediately after connection
          // Use both sync and async to ensure listeners get the event
          const readyListeners = this.listeners.get('ready') || [];
          readyListeners.forEach((listener) => {
            try {
              listener({ device_id: this.deviceId });
            } catch (e) {
              // Ignore errors in listeners
            }
          });
          // Also trigger asynchronously for any listeners that were added after
          setTimeout(() => {
            readyListeners.forEach((listener) => {
              try {
                listener({ device_id: this.deviceId });
              } catch (e) {
                // Ignore errors in listeners
              }
            });
          }, 100);
          return true;
        }

        disconnect(): void {
          // Cleanup
          this.listeners.clear();
        }

        addListener(event: string, callback: (data: any) => void): boolean {
          if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
          }
          this.listeners.get(event)?.push(callback);
          return true;
        }

        async getCurrentState(): Promise<any> {
          if (!this.currentTrack) {
            return Promise.resolve(null);
          }
          return Promise.resolve({
            paused: this.isPaused,
            position: this.position,
            track_window: {
              current_track: this.currentTrack,
            },
          });
        }

        async togglePlay(): Promise<void> {
          const wasPlaying = !this.isPaused;
          this.isPaused = !this.isPaused;
          this.isPlaying = !this.isPaused;

          // Track when togglePlay is called while playing (which pauses it)
          // Increment count if we were playing and now we're paused
          if (wasPlaying && this.isPaused) {
            (window as any).__mockSpotifyPauseCallCount =
              ((window as any).__mockSpotifyPauseCallCount || 0) + 1;
          }

          // Trigger state change event immediately and asynchronously
          const state = this.currentTrack ? {
            paused: this.isPaused,
            position: this.position,
            track_window: {
              current_track: this.currentTrack,
            },
          } : null;

          // Trigger synchronously first
          if (state) {
            const stateChangeListeners = this.listeners.get('player_state_changed') || [];
            stateChangeListeners.forEach((listener) => {
              try {
                listener(state);
              } catch (e) {
                // Ignore errors in listeners
              }
            });
          }

          // Also trigger asynchronously
          setTimeout(() => {
            if (state) {
              const stateChangeListeners = this.listeners.get('player_state_changed') || [];
              stateChangeListeners.forEach((listener) => {
                try {
                  listener(state);
                } catch (e) {
                  // Ignore errors in listeners
                }
              });
            }
          }, 50);
        }

        async previousTrack(): Promise<void> {
          // Not used in tests
        }

        async nextTrack(): Promise<void> {
          // Not used in tests
        }

        async setVolume(volume: number): Promise<void> {
          // Not used in tests
        }

        // Methods to control mock player from tests
        setPlaying(playing: boolean): void {
          this.isPaused = !playing;
          this.isPlaying = playing;
          // Trigger state change event immediately and asynchronously
          // This ensures the UI gets updated
          const stateChangeListeners = this.listeners.get('player_state_changed') || [];
          const state = this.currentTrack ? {
            paused: this.isPaused,
            position: this.position,
            track_window: {
              current_track: this.currentTrack,
            },
          } : null;
          
          // Trigger synchronously first (some listeners might need immediate update)
          if (state) {
            stateChangeListeners.forEach((listener) => {
              try {
                listener(state);
              } catch (e) {
                // Ignore errors in listeners
              }
            });
          }
          
          // Also trigger asynchronously to ensure all listeners get it
          setTimeout(() => {
            if (state) {
              stateChangeListeners.forEach((listener) => {
                try {
                  listener(state);
                } catch (e) {
                  // Ignore errors in listeners
                }
              });
            }
          }, 50);
        }

        setTrack(track: any): void {
          this.currentTrack = track;
          // Trigger state change event immediately when track is set
          // This ensures the UI gets updated with the new track
          const stateChangeListeners = this.listeners.get('player_state_changed') || [];
          const state = {
            paused: this.isPaused,
            position: this.position,
            track_window: {
              current_track: this.currentTrack,
            },
          };
          
          // Trigger synchronously first
          stateChangeListeners.forEach((listener) => {
            try {
              listener(state);
            } catch (e) {
              // Ignore errors in listeners
            }
          });
          
          // Also trigger asynchronously to ensure all listeners get it
          setTimeout(() => {
            stateChangeListeners.forEach((listener) => {
              try {
                listener(state);
              } catch (e) {
                // Ignore errors in listeners
              }
            });
          }, 50);
        }

        getPauseCallCount(): number {
          return (window as any).__mockSpotifyPauseCallCount || 0;
        }

        getDeviceId(): string {
          return this.deviceId;
        }
      },
    };

    // Mock onSpotifyWebPlaybackSDKReady callback
    // The SDK script checks for this and calls it when ready
    (window as any).onSpotifyWebPlaybackSDKReady = () => {
      // SDK is ready - this is called when the script loads
      // In our mock, we call this immediately since we're not loading the real script
    };

    // Prevent the real Spotify SDK script from loading by intercepting script creation
    const originalCreateElement = document.createElement.bind(document);
    document.createElement = function(tagName: string, options?: ElementCreationOptions) {
      if (tagName === 'script') {
        const script = originalCreateElement(tagName, options) as HTMLScriptElement;
        // Intercept script src assignment
        let scriptSrc: string | null = null;
        Object.defineProperty(script, 'src', {
          get: () => scriptSrc,
          set: (value: string) => {
            scriptSrc = value;
            // If it's the Spotify SDK script, don't load it and trigger the ready callback
            if (value === 'https://sdk.scdn.co/spotify-player.js') {
              // Simulate script loading by calling the ready callback after a short delay
              setTimeout(() => {
                if ((window as any).onSpotifyWebPlaybackSDKReady) {
                  (window as any).onSpotifyWebPlaybackSDKReady();
                }
              }, 100);
              // Don't actually set the src to prevent loading
              return;
            }
            // For other scripts, set src normally
            script.setAttribute('src', value);
          },
        });
        return script;
      }
      return originalCreateElement(tagName, options);
    };

    // Mock Spotify API endpoints
    const originalFetch = window.fetch;
    (window as any).fetch = async (url: string | URL, options?: RequestInit) => {
      const urlString = typeof url === 'string' ? url : url.toString();

      // Mock Spotify API endpoints
      if (urlString.startsWith('https://api.spotify.com/v1/me/playlists')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: 'test-playlist-id',
                name: 'Test Playlist',
                description: 'Test Playlist Description',
                images: [{ url: 'https://via.placeholder.com/300' }],
                owner: { display_name: 'Test User' },
              },
            ],
            next: null,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      if (urlString.startsWith('https://api.spotify.com/v1/playlists/') && urlString.includes('/tracks')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                track: {
                  id: 'test-track-123',
                  name: 'Test Song',
                  uri: 'spotify:track:test-track-123',
                  artists: [{ name: 'Test Artist' }],
                  album: {
                    name: 'Test Album',
                    images: [{ url: 'https://via.placeholder.com/300' }],
                  },
                  duration_ms: 200000,
                },
              },
            ],
            next: null,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      if (urlString.startsWith('https://api.spotify.com/v1/me/player/play')) {
        // Mock play endpoint (used by playPlaylist and other play functions)
        const player = (window as any).__mockSpotifyPlayer;
        if (player) {
          // Set a default track if none is set (playlist playback or direct play)
          if (!player.currentTrack) {
            const defaultTrack = {
              id: 'test-track-123',
              name: 'Test Song',
              uri: 'spotify:track:test-track-123',
              artists: [{ name: 'Test Artist' }],
              album: {
                name: 'Test Album',
                images: [{ url: 'https://via.placeholder.com/300' }],
              },
              duration_ms: 200000,
            };
            player.setTrack(defaultTrack);
          }
          // Set playing state and trigger state change event
          player.setPlaying(true);
        }
        return new Response(null, { status: 204 });
      }

      if (urlString.startsWith('https://api.spotify.com/v1/me/player/pause')) {
        // Mock pause endpoint
        const player = (window as any).__mockSpotifyPlayer;
        if (player) {
          player.setPlaying(false);
          (window as any).__mockSpotifyPauseCallCount =
            ((window as any).__mockSpotifyPauseCallCount || 0) + 1;
        }
        return new Response(null, { status: 204 });
      }

      if (urlString.startsWith('https://api.spotify.com/v1/me/player') && options?.method === 'PUT') {
        // Mock player transfer endpoint
        return new Response(null, { status: 204 });
      }

      if (urlString.startsWith('https://api.spotify.com/v1/me/player/repeat')) {
        // Mock repeat mode endpoint
        return new Response(null, { status: 204 });
      }

      if (urlString.startsWith('https://api.spotify.com/v1/me/player/seek')) {
        // Mock seek endpoint
        return new Response(null, { status: 204 });
      }

      if (urlString.startsWith('https://api.spotify.com/v1/me/player/next')) {
        // Mock next track endpoint
        const player = (window as any).__mockSpotifyPlayer;
        if (player) {
          player.setTrack({
            id: 'test-track-456',
            name: 'Next Test Song',
            uri: 'spotify:track:test-track-456',
            artists: [{ name: 'Next Test Artist' }],
            album: {
              name: 'Next Test Album',
              images: [{ url: 'https://via.placeholder.com/300' }],
            },
            duration_ms: 180000,
          });
        }
        return new Response(null, { status: 204 });
      }

      if (urlString.startsWith('https://api.spotify.com/v1/me/player/shuffle')) {
        // Mock shuffle endpoint
        return new Response(null, { status: 204 });
      }

      // Fall back to original fetch for other requests
      return originalFetch(url, options);
    };
  });
}

/**
 * Simulate Spotify playback starting (song playing)
 */
export async function simulateSpotifyPlaying(
  page: Page,
  track?: {
    id: string;
    name: string;
    uri: string;
    artists: Array<{ name: string }>;
    album: { name: string; images: Array<{ url: string }> };
    duration_ms: number;
  }
): Promise<void> {
  const mockTrack = track || {
    id: 'test-track-123',
    name: 'Test Song',
    uri: 'spotify:track:test-track-123',
    artists: [{ name: 'Test Artist' }],
    album: {
      name: 'Test Album',
      images: [{ url: 'https://via.placeholder.com/300' }],
    },
    duration_ms: 200000,
  };

  await page.evaluate(
    ({ track }) => {
      const player = (window as any).__mockSpotifyPlayer;
      if (player) {
        player.setTrack(track);
        player.setPlaying(true);
      }
    },
    { track: mockTrack }
  );
}

/**
 * Get the pause call count from the mock Spotify player
 */
export async function getPauseCallCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const player = (window as any).__mockSpotifyPlayer;
    if (player) {
      return player.getPauseCallCount();
    }
    return (window as any).__mockSpotifyPauseCallCount || 0;
  });
}

/**
 * Verify that Spotify playback was paused
 */
export async function verifySpotifyPaused(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    const player = (window as any).__mockSpotifyPlayer;
    if (player) {
      const state = await player.getCurrentState();
      return state && state.paused === true;
    }
    return false;
  });
}
