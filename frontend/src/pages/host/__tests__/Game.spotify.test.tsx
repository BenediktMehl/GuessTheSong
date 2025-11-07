import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameProvider } from '../../../game/context';
import Game from '../Game';

// Mock the GameProvider to provide a minimal context
const mockGameContext = {
  players: [],
  waitingPlayers: [],
  guessedPlayers: [],
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
  buzzerNotification: null,
  setBuzzerNotification: vi.fn(),
  pausePlayerCallback: null,
  setPausePlayerCallback: vi.fn(),
  currentPlayerId: '',
  setCurrentPlayerId: vi.fn(),
  setStatus: vi.fn(),
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
  Card: ({
    title,
    children,
    bodyClassName,
    ...props
  }: {
    title?: string;
    children: React.ReactNode;
    bodyClassName?: string;
  }) => (
    <div
      data-testid={title ? `card-${title.toLowerCase().replace(/\s+/g, '-')}` : 'card'}
      {...props}
    >
      {title && <h3>{title}</h3>}
      <div className={bodyClassName}>{children}</div>
    </div>
  ),
}));

interface MockPlayer {
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  addListener: ReturnType<typeof vi.fn>;
  getCurrentState: ReturnType<typeof vi.fn>;
  togglePlay: ReturnType<typeof vi.fn>;
  previousTrack: ReturnType<typeof vi.fn>;
  nextTrack: ReturnType<typeof vi.fn>;
}

interface MockSpotify {
  Player: ReturnType<typeof vi.fn>;
}

interface SpotifyPlaybackState {
  paused: boolean;
  track_window: {
    current_track: {
      id: string;
      name: string;
      uri: string;
      artists: Array<{ name: string }>;
      album: {
        name: string;
        images: Array<{ url: string }>;
      };
      duration_ms: number;
    };
  };
}

describe('Spotify SDK Integration', () => {
  let mockPlayer: MockPlayer;
  let mockSpotify: MockSpotify;
  let notReadyCallback: ((data: { device_id: string }) => void) | null = null;
  let stateChangeCallback: ((state: SpotifyPlaybackState) => void) | null = null;

  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();

    // Setup mock player
    mockPlayer = {
      connect: vi.fn().mockResolvedValue(true),
      disconnect: vi.fn(),
      addListener: vi.fn((event: string, callback: unknown) => {
        if (event === 'ready') {
          // Ready callback is tracked internally but not used in tests
          void (callback as (data: { device_id: string }) => void);
        } else if (event === 'not_ready') {
          notReadyCallback = callback as (data: { device_id: string }) => void;
        } else if (event === 'player_state_changed') {
          stateChangeCallback = callback as (state: SpotifyPlaybackState) => void;
        }
        // Error listeners are now implemented in the Game component
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
    // biome-ignore lint/suspicious/noExplicitAny: Spotify SDK types are not available in test environment
    (window as any).Spotify = mockSpotify;
    // biome-ignore lint/suspicious/noExplicitAny: Spotify SDK types are not available in test environment
    (window as any).onSpotifyWebPlaybackSDKReady = null;

    // Mock document.createElement for script
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tagName: string) => {
        if (tagName === 'script') {
          const script = originalCreateElement('script');
          // Simulate script loading - call the callback after a short delay
          // Use setTimeout to simulate async script loading
          setTimeout(() => {
            // biome-ignore lint/suspicious/noExplicitAny: Spotify SDK types are not available in test environment
            if ((window as any).onSpotifyWebPlaybackSDKReady) {
              // biome-ignore lint/suspicious/noExplicitAny: Spotify SDK types are not available in test environment
              (window as any).onSpotifyWebPlaybackSDKReady();
            }
          }, 10);
          return script;
        }
        return originalCreateElement(tagName);
      });

    // Store spy for cleanup
    // biome-ignore lint/suspicious/noExplicitAny: Test helper property
    (window as any).__createElementSpy = createElementSpy;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    notReadyCallback = null;
    stateChangeCallback = null;
    // Clean up window properties
    // biome-ignore lint/suspicious/noExplicitAny: Test cleanup
    delete (window as any).__spotifyPlayerInstance;
    // biome-ignore lint/suspicious/noExplicitAny: Test cleanup
    delete (window as any).__createElementSpy;
    // biome-ignore lint/suspicious/noExplicitAny: Test cleanup
    delete (window as any).Spotify;
    // biome-ignore lint/suspicious/noExplicitAny: Test cleanup
    (window as any).onSpotifyWebPlaybackSDKReady = null;
    // Remove any script tags
    const scripts = document.querySelectorAll(
      'script[src="https://sdk.scdn.co/spotify-player.js"]'
    );
    for (const script of scripts) {
      script.remove();
    }
  });

  it('should load Spotify SDK script when access token is available', async () => {
    // Arrange
    localStorage.setItem('access_token', 'test-token-123');

    // Act
    render(
      <MemoryRouter>
        <GameProvider>
          <Game />
        </GameProvider>
      </MemoryRouter>
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
      <MemoryRouter>
        <GameProvider>
          <Game />
        </GameProvider>
      </MemoryRouter>
    );

    // Wait a bit to ensure useEffect has run
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Assert - script should not be created
    const scriptCalls = createElementSpy.mock.calls.filter((call) => call[0] === 'script');
    const spotifyScript = scriptCalls.find((call) => {
      const script =
        createElementSpy.mock.results[createElementSpy.mock.calls.indexOf(call)]?.value;
      return (
        script && (script as HTMLScriptElement).src === 'https://sdk.scdn.co/spotify-player.js'
      );
    });
    expect(spotifyScript).toBeUndefined();

    // Assert - error message should be displayed
    await waitFor(() => {
      expect(
        screen.getByText(/Something went wrong with the Spotify connection/i)
      ).toBeInTheDocument();
    });

    createElementSpy.mockRestore();
  });

  it('should create player instance when SDK is ready', async () => {
    // Arrange
    localStorage.setItem('access_token', 'test-token-123');

    // Act
    render(
      <MemoryRouter>
        <GameProvider>
          <Game />
        </GameProvider>
      </MemoryRouter>
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
      <MemoryRouter>
        <GameProvider>
          <Game />
        </GameProvider>
      </MemoryRouter>
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
      <MemoryRouter>
        <GameProvider>
          <Game />
        </GameProvider>
      </MemoryRouter>
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
      <MemoryRouter>
        <GameProvider>
          <Game />
        </GameProvider>
      </MemoryRouter>
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
      <MemoryRouter>
        <GameProvider>
          <Game />
        </GameProvider>
      </MemoryRouter>
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
      <MemoryRouter>
        <GameProvider>
          <Game />
        </GameProvider>
      </MemoryRouter>
    );

    // Assert
    await waitFor(
      () => {
        expect(mockPlayer.addListener).toHaveBeenCalledWith(
          'player_state_changed',
          expect.any(Function)
        );
      },
      { timeout: 2000 }
    );
  });

  it('should register initialization_error event listener', async () => {
    // Arrange
    localStorage.setItem('access_token', 'test-token-123');

    // Act
    render(
      <MemoryRouter>
        <GameProvider>
          <Game />
        </GameProvider>
      </MemoryRouter>
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
        expect(mockPlayer.addListener).toHaveBeenCalledWith(
          'initialization_error',
          expect.any(Function)
        );
      },
      { timeout: 2000 }
    );
  });

  it('should register authentication_error event listener', async () => {
    // Arrange
    localStorage.setItem('access_token', 'test-token-123');

    // Act
    render(
      <MemoryRouter>
        <GameProvider>
          <Game />
        </GameProvider>
      </MemoryRouter>
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
        expect(mockPlayer.addListener).toHaveBeenCalledWith(
          'authentication_error',
          expect.any(Function)
        );
      },
      { timeout: 2000 }
    );
  });

  it('should register account_error event listener', async () => {
    // Arrange
    localStorage.setItem('access_token', 'test-token-123');

    // Act
    render(
      <MemoryRouter>
        <GameProvider>
          <Game />
        </GameProvider>
      </MemoryRouter>
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
        expect(mockPlayer.addListener).toHaveBeenCalledWith('account_error', expect.any(Function));
      },
      { timeout: 2000 }
    );
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
      position: 0,
      track_window: {
        current_track: mockTrack,
      },
    };

    // Act
    render(
      <MemoryRouter>
        <GameProvider>
          <Game />
        </GameProvider>
      </MemoryRouter>
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
      position: 0,
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
      <MemoryRouter>
        <GameProvider>
          <Game />
        </GameProvider>
      </MemoryRouter>
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
      position: 0,
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
      <MemoryRouter>
        <GameProvider>
          <Game />
        </GameProvider>
      </MemoryRouter>
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
      position: 0,
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
      <MemoryRouter>
        <GameProvider>
          <Game />
        </GameProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(stateChangeCallback).toBeTruthy();
    });

    if (stateChangeCallback) {
      mockPlayer.getCurrentState.mockResolvedValue(mockState);
      stateChangeCallback(mockState);
    }

    await waitFor(() => {
      const nextButton = screen.getByText('Next');
      expect(nextButton).toBeInTheDocument();
      expect(nextButton).not.toBeDisabled();
    });

    const nextButton = screen.getByText('Next');
    nextButton.click();

    // Assert
    await waitFor(() => {
      expect(mockPlayer.nextTrack).toHaveBeenCalled();
    });
  });

  it('should not show previous track button (removed from UI)', async () => {
    // Arrange
    localStorage.setItem('access_token', 'test-token-123');
    const mockState = {
      paused: false,
      position: 0,
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
      <MemoryRouter>
        <GameProvider>
          <Game />
        </GameProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(stateChangeCallback).toBeTruthy();
    });

    if (stateChangeCallback) {
      mockPlayer.getCurrentState.mockResolvedValue(mockState);
      stateChangeCallback(mockState);
    }

    // Assert - previous button should not exist
    await waitFor(() => {
      const prevButton = screen.queryByText('<<');
      expect(prevButton).not.toBeInTheDocument();
    });
  });

  it('should handle not_ready event', async () => {
    // Arrange
    localStorage.setItem('access_token', 'test-token-123');
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Act
    render(
      <MemoryRouter>
        <GameProvider>
          <Game />
        </GameProvider>
      </MemoryRouter>
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
      <MemoryRouter>
        <GameProvider>
          <Game />
        </GameProvider>
      </MemoryRouter>
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

  it('should handle initialization_error event', async () => {
    // Arrange
    localStorage.setItem('access_token', 'test-token-123');
    let errorCallback: ((error: { message: string }) => void) | null = null;

    // Setup mock to capture error callback
    // biome-ignore lint/suspicious/noExplicitAny: Need to override mock for this specific test
    (mockPlayer as any).addListener = vi.fn((event: string, callback: unknown) => {
      if (event === 'initialization_error') {
        errorCallback = callback as (error: { message: string }) => void;
      }
      return true;
    });

    // Act
    render(
      <MemoryRouter>
        <GameProvider>
          <Game />
        </GameProvider>
      </MemoryRouter>
    );

    // Wait for listener to be registered
    await waitFor(
      () => {
        expect(errorCallback).toBeTruthy();
      },
      { timeout: 3000 }
    );

    // Trigger error
    if (errorCallback) {
      (errorCallback as (error: { message: string }) => void)({ message: 'Initialization failed' });
    }

    // Assert - error message should be displayed
    await waitFor(() => {
      expect(
        screen.getByText(/Something went wrong with the Spotify connection/i)
      ).toBeInTheDocument();
    });
  });

  it('should handle authentication_error event', async () => {
    // Arrange
    localStorage.setItem('access_token', 'test-token-123');
    let errorCallback: ((error: { message: string }) => void) | null = null;

    // Setup mock to capture error callback
    // biome-ignore lint/suspicious/noExplicitAny: Need to override mock for this specific test
    (mockPlayer as any).addListener = vi.fn((event: string, callback: unknown) => {
      if (event === 'authentication_error') {
        errorCallback = callback as (error: { message: string }) => void;
      }
      return true;
    });

    // Act
    render(
      <MemoryRouter>
        <GameProvider>
          <Game />
        </GameProvider>
      </MemoryRouter>
    );

    // Wait for listener to be registered
    await waitFor(
      () => {
        expect(errorCallback).toBeTruthy();
      },
      { timeout: 3000 }
    );

    // Trigger error
    if (errorCallback) {
      (errorCallback as (error: { message: string }) => void)({ message: 'Authentication failed' });
    }

    // Assert - error message should be displayed
    await waitFor(() => {
      expect(
        screen.getByText(/Something went wrong with the Spotify connection/i)
      ).toBeInTheDocument();
    });
  });

  it('should handle account_error event', async () => {
    // Arrange
    localStorage.setItem('access_token', 'test-token-123');
    let errorCallback: ((error: { message: string }) => void) | null = null;

    // Setup mock to capture error callback
    // biome-ignore lint/suspicious/noExplicitAny: Need to override mock for this specific test
    (mockPlayer as any).addListener = vi.fn((event: string, callback: unknown) => {
      if (event === 'account_error') {
        errorCallback = callback as (error: { message: string }) => void;
      }
      return true;
    });

    // Act
    render(
      <MemoryRouter>
        <GameProvider>
          <Game />
        </GameProvider>
      </MemoryRouter>
    );

    // Wait for listener to be registered
    await waitFor(
      () => {
        expect(errorCallback).toBeTruthy();
      },
      { timeout: 3000 }
    );

    // Trigger error
    if (errorCallback) {
      (errorCallback as (error: { message: string }) => void)({ message: 'Account error' });
    }

    // Assert - error message should be displayed
    await waitFor(() => {
      expect(
        screen.getByText(/Something went wrong with the Spotify connection/i)
      ).toBeInTheDocument();
    });
  });
});
