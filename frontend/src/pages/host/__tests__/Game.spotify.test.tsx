import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Game from '../Game';
import { GameProvider } from '../../../game/context';

// Mock the GameProvider to provide a minimal context
const mockGameContext = {
  players: [],
  waitingPlayers: [],
  sessionId: 'test-session',
  status: 'waiting' as const,
  isHost: true,
  setIsHost: vi.fn(),
  wsStatus: 'open' as const,
  setWsStatus: vi.fn(),
  setSessionId: vi.fn(),
  setPlayers: vi.fn(),
  setWaitingPlayers: vi.fn(),
  setGuessedPlayers: vi.fn(),
  musicHostLoggedIn: false,
  setMusicHostLoggedIn: vi.fn(),
};

// Mock GameProvider
vi.mock('../../../game/context', async () => {
  const actual = await vi.importActual('../../../game/context');
  return {
    ...actual,
    useGameContext: () => mockGameContext,
  };
});

// Mock PlayersLobby
vi.mock('../../../components/PlayersLobby', () => ({
  default: () => <div data-testid="players-lobby">Players Lobby</div>,
}));

// Mock Card component
vi.mock('../../../components/Card', () => ({
  Card: ({ title, children, bodyClassName, ...props }: { title: string; children: React.ReactNode; bodyClassName?: string }) => (
    <div data-testid={`card-${title.toLowerCase().replace(/\s+/g, '-')}`} {...props}>
      <h3>{title}</h3>
      <div className={bodyClassName}>{children}</div>
    </div>
  ),
}));

describe('Spotify SDK Integration', () => {
  let mockPlayer: any;
  let mockSpotify: any;
  let readyCallback: ((data: { device_id: string }) => void) | null = null;
  let notReadyCallback: ((data: { device_id: string }) => void) | null = null;
  let stateChangeCallback: ((state: any) => void) | null = null;

  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();

    // Setup mock player
    mockPlayer = {
      connect: vi.fn().mockResolvedValue(true),
      disconnect: vi.fn(),
      addListener: vi.fn((event: string, callback: any) => {
        if (event === 'ready') {
          readyCallback = callback;
        } else if (event === 'not_ready') {
          notReadyCallback = callback;
        } else if (event === 'player_state_changed') {
          stateChangeCallback = callback;
        }
        // Note: initialization_error, authentication_error, and account_error listeners
        // are not currently implemented in the Game component, so we don't track them
        return true;
      }),
      getCurrentState: vi.fn().mockResolvedValue(null),
      togglePlay: vi.fn().mockResolvedValue(undefined),
      previousTrack: vi.fn().mockResolvedValue(undefined),
      nextTrack: vi.fn().mockResolvedValue(undefined),
    };

    // Setup mock Spotify SDK
    mockSpotify = {
      Player: vi.fn(function PlayerConstructor() {
        return mockPlayer;
      }),
    };

    // Setup window.Spotify
    (window as any).Spotify = mockSpotify;
    (window as any).onSpotifyWebPlaybackSDKReady = null;

    // Mock document.createElement for script
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'script') {
        const script = originalCreateElement('script');
        // Simulate script loading - call the callback after a short delay
        // Use setTimeout to simulate async script loading
        setTimeout(() => {
          if ((window as any).onSpotifyWebPlaybackSDKReady) {
            (window as any).onSpotifyWebPlaybackSDKReady();
          }
        }, 10);
        return script;
      }
      return originalCreateElement(tagName);
    });
    
    // Store spy for cleanup
    (window as any).__createElementSpy = createElementSpy;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    readyCallback = null;
    notReadyCallback = null;
    stateChangeCallback = null;
    // Clean up window properties
    delete (window as any).__spotifyPlayerInstance;
    delete (window as any).__createElementSpy;
    delete (window as any).Spotify;
    (window as any).onSpotifyWebPlaybackSDKReady = null;
    // Remove any script tags
    const scripts = document.querySelectorAll('script[src="https://sdk.scdn.co/spotify-player.js"]');
    scripts.forEach((script) => script.remove());
  });

  it('should load Spotify SDK script when access token is available', async () => {
    // Arrange
    localStorage.setItem('access_token', 'test-token-123');

    // Act
    render(
      <GameProvider>
        <Game />
      </GameProvider>
    );

    // Assert
    await waitFor(() => {
      const script = document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]');
      expect(script).toBeTruthy();
    });
  });

  it('should not load SDK script when access token is missing', async () => {
    // Arrange
    localStorage.clear();
    const createElementSpy = vi.spyOn(document, 'createElement');

    // Act
    render(
      <GameProvider>
        <Game />
      </GameProvider>
    );

    // Wait a bit to ensure useEffect has run
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Assert - script should not be created
    const scriptCalls = createElementSpy.mock.calls.filter((call) => call[0] === 'script');
    const spotifyScript = scriptCalls.find((call) => {
      const script = createElementSpy.mock.results[createElementSpy.mock.calls.indexOf(call)]?.value;
      return script && (script as HTMLScriptElement).src === 'https://sdk.scdn.co/spotify-player.js';
    });
    expect(spotifyScript).toBeUndefined();
    
    createElementSpy.mockRestore();
  });

  it('should create player instance when SDK is ready', async () => {
    // Arrange
    localStorage.setItem('access_token', 'test-token-123');

    // Act
    render(
      <GameProvider>
        <Game />
      </GameProvider>
    );

    // Assert
    await waitFor(() => {
      expect(mockSpotify.Player).toHaveBeenCalledWith({
        name: 'Guess The Song',
        getOAuthToken: expect.any(Function),
        volume: 0.5,
      });
    });
  });

  it('should provide access token via getOAuthToken callback', async () => {
    // Arrange
    const testToken = 'test-token-456';
    localStorage.setItem('access_token', testToken);
    let tokenProvided: string | null = null;

    // Act
    render(
      <GameProvider>
        <Game />
      </GameProvider>
    );

    await waitFor(() => {
      expect(mockSpotify.Player).toHaveBeenCalled();
    });

    // Get the getOAuthToken callback
    const playerCall = mockSpotify.Player.mock.calls[0];
    const getOAuthToken = playerCall[0].getOAuthToken;
    getOAuthToken((token: string) => {
      tokenProvided = token;
    });

    // Assert
    expect(tokenProvided).toBe(testToken);
  });

  it('should connect player after initialization', async () => {
    // Arrange
    localStorage.setItem('access_token', 'test-token-123');

    // Act
    render(
      <GameProvider>
        <Game />
      </GameProvider>
    );

    // Assert
    await waitFor(
      () => {
        expect(mockPlayer.connect).toHaveBeenCalled();
      },
      { timeout: 2000 }
    );
  });

  it('should register ready event listener', async () => {
    // Arrange
    localStorage.setItem('access_token', 'test-token-123');

    // Act
    render(
      <GameProvider>
        <Game />
      </GameProvider>
    );

    // Wait for SDK to load and player to be initialized
    await waitFor(
      () => {
        expect(mockPlayer.connect).toHaveBeenCalled();
      },
      { timeout: 3000 }
    );

    // Assert
    await waitFor(
      () => {
        expect(mockPlayer.addListener).toHaveBeenCalledWith('ready', expect.any(Function));
      },
      { timeout: 2000 }
    );
  });

  it('should register not_ready event listener', async () => {
    // Arrange
    localStorage.setItem('access_token', 'test-token-123');

    // Act
    render(
      <GameProvider>
        <Game />
      </GameProvider>
    );

    // Wait for SDK to load and player to be initialized
    await waitFor(
      () => {
        expect(mockPlayer.connect).toHaveBeenCalled();
      },
      { timeout: 3000 }
    );

    // Assert
    await waitFor(
      () => {
        expect(mockPlayer.addListener).toHaveBeenCalledWith('not_ready', expect.any(Function));
      },
      { timeout: 2000 }
    );
  });

  it('should register player_state_changed event listener', async () => {
    // Arrange
    localStorage.setItem('access_token', 'test-token-123');

    // Act
    render(
      <GameProvider>
        <Game />
      </GameProvider>
    );

    // Assert
    await waitFor(
      () => {
        expect(mockPlayer.addListener).toHaveBeenCalledWith('player_state_changed', expect.any(Function));
      },
      { timeout: 2000 }
    );
  });

  // Note: These error listeners are not currently registered in the Game component
  // They are part of the SDK but not implemented in the UI yet
  it.skip('should register initialization_error event listener', async () => {
    // This test is skipped because the Game component doesn't currently register this listener
    // The listener exists in the SDK but isn't used in the component yet
  });

  it.skip('should register authentication_error event listener', async () => {
    // This test is skipped because the Game component doesn't currently register this listener
    // The listener exists in the SDK but isn't used in the component yet
  });

  it.skip('should register account_error event listener', async () => {
    // This test is skipped because the Game component doesn't currently register this listener
    // The listener exists in the SDK but isn't used in the component yet
  });

  it('should update track info when player_state_changed event fires', async () => {
    // Arrange
    localStorage.setItem('access_token', 'test-token-123');
    const mockTrack = {
      id: 'track-123',
      name: 'Test Song',
      uri: 'spotify:track:123',
      artists: [{ name: 'Test Artist' }],
      album: {
        name: 'Test Album',
        images: [{ url: 'https://example.com/cover.jpg' }],
      },
      duration_ms: 200000,
    };

    const mockState = {
      paused: false,
      track_window: {
        current_track: mockTrack,
      },
    };

    // Act
    render(
      <GameProvider>
        <Game />
      </GameProvider>
    );

    await waitFor(() => {
      expect(stateChangeCallback).toBeTruthy();
    });

    // Trigger state change
    if (stateChangeCallback) {
      mockPlayer.getCurrentState.mockResolvedValue(mockState);
      stateChangeCallback(mockState);
    }

    // Assert
    await waitFor(() => {
      expect(screen.getByText('Test Song')).toBeInTheDocument();
      expect(screen.getByText('Test Artist')).toBeInTheDocument();
    });
  });

  it('should update pause state when player_state_changed event fires', async () => {
    // Arrange
    localStorage.setItem('access_token', 'test-token-123');
    const mockState = {
      paused: true,
      track_window: {
        current_track: {
          id: 'track-123',
          name: 'Test Song',
          uri: 'spotify:track:123',
          artists: [{ name: 'Test Artist' }],
          album: {
            name: 'Test Album',
            images: [{ url: 'https://example.com/cover.jpg' }],
          },
          duration_ms: 200000,
        },
      },
    };

    // Act
    render(
      <GameProvider>
        <Game />
      </GameProvider>
    );

    await waitFor(() => {
      expect(stateChangeCallback).toBeTruthy();
    });

    if (stateChangeCallback) {
      mockPlayer.getCurrentState.mockResolvedValue(mockState);
      stateChangeCallback(mockState);
    }

    // Assert
    await waitFor(() => {
      const pauseButton = screen.getByText('PLAY');
      expect(pauseButton).toBeInTheDocument();
    });
  });

  it('should call togglePlay when pause/play button is clicked', async () => {
    // Arrange
    localStorage.setItem('access_token', 'test-token-123');
    const mockState = {
      paused: false,
      track_window: {
        current_track: {
          id: 'track-123',
          name: 'Test Song',
          uri: 'spotify:track:123',
          artists: [{ name: 'Test Artist' }],
          album: {
            name: 'Test Album',
            images: [{ url: 'https://example.com/cover.jpg' }],
          },
          duration_ms: 200000,
        },
      },
    };

    // Act
    render(
      <GameProvider>
        <Game />
      </GameProvider>
    );

    await waitFor(() => {
      expect(stateChangeCallback).toBeTruthy();
    });

    // Set player as active
    if (stateChangeCallback) {
      mockPlayer.getCurrentState.mockResolvedValue(mockState);
      stateChangeCallback(mockState);
    }

    await waitFor(() => {
      const pauseButton = screen.getByText('PAUSE');
      expect(pauseButton).toBeInTheDocument();
    });

    const pauseButton = screen.getByText('PAUSE');
    pauseButton.click();

    // Assert
    await waitFor(() => {
      expect(mockPlayer.togglePlay).toHaveBeenCalled();
    });
  });

  it('should call nextTrack when next button is clicked', async () => {
    // Arrange
    localStorage.setItem('access_token', 'test-token-123');
    const mockState = {
      paused: false,
      track_window: {
        current_track: {
          id: 'track-123',
          name: 'Test Song',
          uri: 'spotify:track:123',
          artists: [{ name: 'Test Artist' }],
          album: {
            name: 'Test Album',
            images: [{ url: 'https://example.com/cover.jpg' }],
          },
          duration_ms: 200000,
        },
      },
    };

    // Act
    render(
      <GameProvider>
        <Game />
      </GameProvider>
    );

    await waitFor(() => {
      expect(stateChangeCallback).toBeTruthy();
    });

    if (stateChangeCallback) {
      mockPlayer.getCurrentState.mockResolvedValue(mockState);
      stateChangeCallback(mockState);
    }

    await waitFor(() => {
      const nextButton = screen.getByText('>>');
      expect(nextButton).toBeInTheDocument();
      expect(nextButton).not.toBeDisabled();
    });

    const nextButton = screen.getByText('>>');
    nextButton.click();

    // Assert
    await waitFor(() => {
      expect(mockPlayer.nextTrack).toHaveBeenCalled();
    });
  });

  it('should call previousTrack when previous button is clicked', async () => {
    // Arrange
    localStorage.setItem('access_token', 'test-token-123');
    const mockState = {
      paused: false,
      track_window: {
        current_track: {
          id: 'track-123',
          name: 'Test Song',
          uri: 'spotify:track:123',
          artists: [{ name: 'Test Artist' }],
          album: {
            name: 'Test Album',
            images: [{ url: 'https://example.com/cover.jpg' }],
          },
          duration_ms: 200000,
        },
      },
    };

    // Act
    render(
      <GameProvider>
        <Game />
      </GameProvider>
    );

    await waitFor(() => {
      expect(stateChangeCallback).toBeTruthy();
    });

    if (stateChangeCallback) {
      mockPlayer.getCurrentState.mockResolvedValue(mockState);
      stateChangeCallback(mockState);
    }

    await waitFor(() => {
      const prevButton = screen.getByText('<<');
      expect(prevButton).toBeInTheDocument();
      expect(prevButton).not.toBeDisabled();
    });

    const prevButton = screen.getByText('<<');
    prevButton.click();

    // Assert
    await waitFor(() => {
      expect(mockPlayer.previousTrack).toHaveBeenCalled();
    });
  });


  it('should handle not_ready event', async () => {
    // Arrange
    localStorage.setItem('access_token', 'test-token-123');
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Act
    render(
      <GameProvider>
        <Game />
      </GameProvider>
    );

    // Wait for SDK to load and player to be initialized
    await waitFor(
      () => {
        expect(mockPlayer.connect).toHaveBeenCalled();
      },
      { timeout: 3000 }
    );

    // Wait for not_ready callback to be set up (it's set when addListener is called)
    await waitFor(
      () => {
        expect(notReadyCallback).toBeTruthy();
      },
      { timeout: 2000 }
    );

    // Trigger the not_ready callback
    if (notReadyCallback) {
      notReadyCallback({ device_id: 'test-device-123' });
    }

    // Assert - verify the console log was called
    await waitFor(
      () => {
        expect(consoleSpy).toHaveBeenCalledWith(
          '[Spotify] Device ID has gone offline',
          'test-device-123'
        );
      },
      { timeout: 2000 }
    );

    consoleSpy.mockRestore();
  });

  it('should disconnect player on component unmount', async () => {
    // Arrange
    localStorage.setItem('access_token', 'test-token-123');

    // Act
    const { unmount } = render(
      <GameProvider>
        <Game />
      </GameProvider>
    );

    // Wait for SDK to load and player to be initialized
    await waitFor(
      () => {
        expect(mockPlayer.connect).toHaveBeenCalled();
      },
      { timeout: 3000 }
    );

    // Wait for player to be created and stored
    await waitFor(
      () => {
        expect(mockSpotify.Player).toHaveBeenCalled();
      },
      { timeout: 2000 }
    );

    unmount();

    // Assert - player should be disconnected via cleanup function
    await waitFor(
      () => {
        expect(mockPlayer.disconnect).toHaveBeenCalled();
      },
      { timeout: 2000 }
    );
  });

  it.skip('should handle initialization_error event', async () => {
    // This test is skipped because the Game component doesn't currently register this listener
    // The listener exists in the SDK but isn't used in the component yet
  });

  it.skip('should handle authentication_error event', async () => {
    // This test is skipped because the Game component doesn't currently register this listener
    // The listener exists in the SDK but isn't used in the component yet
  });

  it.skip('should handle account_error event', async () => {
    // This test is skipped because the Game component doesn't currently register this listener
    // The listener exists in the SDK but isn't used in the component yet
  });
});

