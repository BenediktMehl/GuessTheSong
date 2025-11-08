import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useState,
} from 'react';

export type Player = {
  id: string;
  name: string;
  points: number;
};

export type WsStatus = 'connecting' | 'open' | 'closed' | 'error' | 'failed';

export type GameStatus = 'notStarted' | 'waiting' | 'listening' | 'guessing' | 'finished';

export type BuzzerNotification = {
  playerId: string;
  playerName: string;
} | null;

export type GuessResultNotification = {
  playerId: string;
  playerName: string;
  result: 'correct' | 'partially' | 'wrong';
  nextPlayerName?: string;
} | null;

export type PausePlayerCallback = () => void | Promise<void>;

// Global reference to pause function (set by Host Game component)
let globalPausePlayer: PausePlayerCallback | null = null;

export function setGlobalPausePlayer(callback: PausePlayerCallback | null) {
  globalPausePlayer = callback;
}

export function getGlobalPausePlayer(): PausePlayerCallback | null {
  return globalPausePlayer;
}

export interface GameContextType {
  isHost: boolean;
  players: Player[];
  waitingPlayers: Player[];
  guessedPlayers: Player[];
  partiallyGuessedPlayers: Player[];
  musicHostLoggedIn: boolean;
  status: GameStatus;
  wsStatus: WsStatus;
  sessionId: string;
  currentPlayerId: string;
  buzzerNotification: BuzzerNotification;
  guessResultNotification: GuessResultNotification;
  pausePlayerCallback: PausePlayerCallback | null;
  setIsHost: Dispatch<SetStateAction<boolean>>;
  setPlayers: Dispatch<SetStateAction<Player[]>>;
  setWaitingPlayers: Dispatch<SetStateAction<Player[]>>;
  setGuessedPlayers: Dispatch<SetStateAction<Player[]>>;
  setPartiallyGuessedPlayers: Dispatch<SetStateAction<Player[]>>;
  setMusicHostLoggedIn: Dispatch<SetStateAction<boolean>>;
  setStatus: Dispatch<SetStateAction<GameStatus>>;
  setWsStatus: Dispatch<SetStateAction<WsStatus>>;
  setSessionId: Dispatch<SetStateAction<string>>;
  setCurrentPlayerId: Dispatch<SetStateAction<string>>;
  setBuzzerNotification: Dispatch<SetStateAction<BuzzerNotification>>;
  setGuessResultNotification: Dispatch<SetStateAction<GuessResultNotification>>;
  setPausePlayerCallback: Dispatch<SetStateAction<PausePlayerCallback | null>>;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isHost, setIsHost] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [waitingPlayers, setWaitingPlayers] = useState<Player[]>([]);
  const [guessedPlayers, setGuessedPlayers] = useState<Player[]>([]);
  const [partiallyGuessedPlayers, setPartiallyGuessedPlayers] = useState<Player[]>([]);
  const [musicHostLoggedIn, setMusicHostLoggedIn] = useState(false);
  const [status, setStatus] = useState<GameStatus>('notStarted');
  const [wsStatus, setWsStatus] = useState<WsStatus>('closed');
  const [sessionId, setSessionId] = useState('');
  const [currentPlayerId, setCurrentPlayerId] = useState('');
  const [buzzerNotification, setBuzzerNotification] = useState<BuzzerNotification>(null);
  const [guessResultNotification, setGuessResultNotification] =
    useState<GuessResultNotification>(null);
  const [pausePlayerCallback, setPausePlayerCallback] = useState<PausePlayerCallback | null>(null);

  return (
    <GameContext.Provider
      value={{
        isHost,
        players,
        waitingPlayers,
        guessedPlayers,
        partiallyGuessedPlayers,
        musicHostLoggedIn,
        status,
        wsStatus,
        sessionId,
        currentPlayerId,
        buzzerNotification,
        guessResultNotification,
        pausePlayerCallback,
        setIsHost,
        setPlayers,
        setWaitingPlayers,
        setGuessedPlayers,
        setPartiallyGuessedPlayers,
        setMusicHostLoggedIn,
        setStatus,
        setWsStatus,
        setSessionId,
        setCurrentPlayerId,
        setBuzzerNotification,
        setGuessResultNotification,
        setPausePlayerCallback,
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
