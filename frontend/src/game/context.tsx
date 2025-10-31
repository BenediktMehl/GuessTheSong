import { createContext, useContext, useState, type ReactNode } from 'react';

export type Player = {
  id: string;
  name: string;
  points: number;
};

export type WsStatus = 'connecting' | 'open' | 'closed' | 'error' | 'failed';

export type GameStatus = 'notStarted' | 'waiting' | 'listening' | 'guessing' | 'finished';

export interface GameContextType {
  isHost: boolean;
  players: Player[];
  waitingPlayers: Player[];
  guessedPlayers: Player[];
  musicHostLoggedIn: boolean;
  status: GameStatus;
  wsStatus: WsStatus;
  sessionId: string;
  currentPlayerId: string;
  setIsHost: (isHost: boolean) => void;
  setPlayers: (players: Player[]) => void;
  setWaitingPlayers: (waitingPlayers: Player[]) => void;
  setGuessedPlayers: (guessedPlayers: Player[]) => void;
  setMusicHostLoggedIn: (isLoggedIn: boolean) => void;
  setStatus: (status: GameStatus) => void;
  setWsStatus: (wsStatus: WsStatus) => void;
  setSessionId: (sessionId: string) => void;
  setCurrentPlayerId: (playerId: string) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isHost, setIsHost] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [waitingPlayers, setWaitingPlayers] = useState<Player[]>([]);
  const [guessedPlayers, setGuessedPlayers] = useState<Player[]>([]);
  const [musicHostLoggedIn, setMusicHostLoggedIn] = useState(false);
  const [status, setStatus] = useState<GameStatus>('notStarted');
  const [wsStatus, setWsStatus] = useState<WsStatus>('closed');
  const [sessionId, setSessionId] = useState('');
  const [currentPlayerId, setCurrentPlayerId] = useState('');

  return (
    <GameContext.Provider
      value={{
        isHost,
        players,
        waitingPlayers,
        guessedPlayers,
        musicHostLoggedIn,
        status,
        wsStatus,
        sessionId,
        currentPlayerId,
        setIsHost,
        setPlayers,
        setWaitingPlayers,
        setGuessedPlayers,
        setMusicHostLoggedIn,
        setStatus,
        setWsStatus,
        setSessionId,
        setCurrentPlayerId,
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
