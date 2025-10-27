import { createContext, useContext, useState, type JSX, type ReactNode } from 'react';

export type Player = {
  id: string;
  name: string;
  points: number;
};

export type WsStatus = 'connecting' | 'open' | 'closed' | 'error';

export type GameStatus = 'notStarted' | 'waiting' | 'listening' | 'guessing' | 'finished';

export interface GameContextType {
  iAm: Player | null;
  players: Player[];
  waitingPlayers: Player[];
  guessedPlayers: Player[];
  referee: Player | null;
  gameHost: Player | null;
  musicHost: Player | null;
  musicHostLoggedIn: boolean;
  status: GameStatus;
  wsStatus: WsStatus;
  sessionId: string;
  setIAm: (player: Player | null) => void;
  setGameState: (
    players: Player[],
    waitingPlayers: Player[],
    guessedPlayers: Player[],
    referee: Player | null,
    gameHost: Player | null,
    musicHost: Player | null,
    status: GameStatus,
    wsStatus: WsStatus,
    sessionId: string,
    musicHostLoggedIn: boolean
  ) => void;
  setPlayers: (players: Player[]) => void;
  setWaitingPlayers: (waitingPlayers: Player[]) => void;
  setGuessedPlayers: (guessedPlayers: Player[]) => void;
  setReferee: (referee: Player | null) => void;
  setGameHost: (gameHost: Player) => void;
  setMusicHost: (musicHost: Player| null) => void;
  setMusicHostLoggedIn: (isLoggedIn: boolean) => void;
  setStatus: (status: GameStatus) => void;
  setWsStatus: (wsStatus: WsStatus) => void;
  setSessionId: (sessionId: string) => void;
}

// Individual default constants for each game state attribute
export const DEFAULT_I_AM: Player | null = null;
const DEFAULT_PLAYERS: Player[] = [];
const DEFAULT_WAITING_PLAYERS: Player[] = [];
const DEFAULT_GUESSED_PLAYERS: Player[] = [];
const DEFAULT_REFEREE: Player | null = null;
const DEFAULT_GAME_HOST: Player | null = null;
const DEFAULT_MUSIC_HOST: Player | null = null;
const DEFAULT_MUSIC_HOST_LOGGED_IN: boolean = false; // New default value
const DEFAULT_STATUS: GameStatus = 'notStarted';
const DEFAULT_WS_STATUS: WsStatus = 'closed';
const DEFAULT_SESSION_ID: string = '';

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }): JSX.Element => {
  const [iAm, setIAm] = useState<Player | null>(DEFAULT_I_AM);
  const [players, setPlayers] = useState<Player[]>(DEFAULT_PLAYERS);
  const [waitingPlayers, setWaitingPlayers] = useState<Player[]>(DEFAULT_WAITING_PLAYERS);
  const [guessedPlayers, setGuessedPlayers] = useState<Player[]>(DEFAULT_GUESSED_PLAYERS);
  const [referee, setReferee] = useState<Player | null>(DEFAULT_REFEREE);
  const [gameHost, setGameHost] = useState<Player | null>(DEFAULT_GAME_HOST);
  const [musicHost, setMusicHost] = useState<Player | null>(DEFAULT_MUSIC_HOST);
  const [musicHostLoggedIn, setMusicHostLoggedIn] = useState<boolean>(DEFAULT_MUSIC_HOST_LOGGED_IN); // New state
  const [status, setStatus] = useState<GameStatus>(DEFAULT_STATUS);
  const [wsStatus, setWsStatus] = useState<WsStatus>(DEFAULT_WS_STATUS);
  const [sessionId, setSessionId] = useState<string>(DEFAULT_SESSION_ID);

  const setGameState = (
    newPlayers: Player[],
    newWaitingPlayers: Player[],
    newGuessedPlayers: Player[],
    newReferee: Player | null,
    newGameHost: Player | null,
    newMusicHost: Player | null,
    newStatus: GameStatus,
    newWsStatus: WsStatus,
    newSessionId: string,
    newMusicHostLoggedIn: boolean
  ) => {
    setPlayers(newPlayers);
    setWaitingPlayers(newWaitingPlayers);
    setGuessedPlayers(newGuessedPlayers);
    setReferee(newReferee);
    setGameHost(newGameHost);
    setMusicHost(newMusicHost);
    setStatus(newStatus);
    setWsStatus(newWsStatus);
    setSessionId(newSessionId);
    setMusicHostLoggedIn(newMusicHostLoggedIn);
  };

  return (
    <GameContext.Provider
      value={{
        iAm,
        players,
        waitingPlayers,
        guessedPlayers,
        referee,
        gameHost,
        musicHost,
        musicHostLoggedIn,
        status,
        wsStatus,
        sessionId,
        setIAm,
        setGameState,
        setPlayers,
        setWaitingPlayers,
        setGuessedPlayers,
        setReferee,
        setGameHost,
        setMusicHost,
        setMusicHostLoggedIn,
        setStatus,
        setWsStatus,
        setSessionId,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export const useGameContext = (): GameContextType => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGameContext must be used within a GameProvider');
  }
  return context;
};