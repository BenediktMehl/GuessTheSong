import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Game from '../Game';

// Mock app config to avoid external dependencies
vi.mock('@app-config', () => ({
  default: { displayName: 'Guess The Song' },
}));

// Mock useNavigate to avoid actual navigation
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

// Mock PlayersLobby test id to simplify queries if needed
vi.mock('../../../components/PlayersLobby', async (_importOriginal) => {
  return {
    __esModule: true,
    // Provide the actual component untouched to keep types simple
    default: (await import('../../../components/PlayersLobby')).default,
  };
});

// Mock game context
vi.mock('../../../game/context', async () => {
  const React = await import('react');
  const mockedContextValue = {
    players: [
      { id: 'p1', name: 'Alice', points: 5 },
      { id: 'p2', name: 'Bob', points: 3 },
    ],
    currentPlayerId: 'p2',
    waitingPlayers: [
      // Stale entry (points would be 0 if coming from server-side queue object)
      { id: 'p1', name: 'Alice', points: 0 },
      { id: 'p2', name: 'Bob', points: 0 },
    ],
    guessedPlayers: [],
    partiallyGuessedPlayers: [],
    noCluePlayers: [],
    buzzerNotification: null,
    setBuzzerNotification: () => {},
    playerToast: null,
    setPlayerToast: () => {},
    lastSong: null,
  };

  const Ctx = React.createContext(mockedContextValue);
  return {
    __esModule: true,
    useGameContext: () => React.useContext(Ctx),
    GameProvider: ({ children }: { children: React.ReactNode }) => (
      <Ctx.Provider value={mockedContextValue}>{children}</Ctx.Provider>
    ),
  };
});

describe('Player points display', () => {
  it('should show correct points for players in Now guessing', () => {
    render(<Game />);

    // The first waiting player is in "Now guessing" section
    const nowGuessingHeader = screen.getByText('Now guessing');
    const section = nowGuessingHeader.closest('div');
    expect(section).toBeTruthy();

    // Within the Now guessing section, ensure Alice shows 5 points (canonical from players list)
    const listItem = screen.getByText('Alice').closest('li');
    expect(listItem).toBeTruthy();

    const pointsBadge = within(listItem as HTMLElement).getByText('5');
    expect(pointsBadge).toBeInTheDocument();
  });
});
