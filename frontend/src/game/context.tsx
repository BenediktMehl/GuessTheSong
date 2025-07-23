import React, { createContext, useContext, useState, type JSX, type ReactNode } from 'react';

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
    sessionId: string
  ) => void;
  removePlayer: (playerId: string) => void;
  setPlayers: (players: Player[]) => void;
  setWaitingPlayers: (waitingPlayers: Player[]) => void;
  setGuessedPlayers: (guessedPlayers: Player[]) => void;
  setReferee: (referee: Player) => void;
  setGameHost: (gameHost: Player) => void;
  setMusicHost: (musicHost: Player) => void;
  setStatus: (status: GameStatus) => void;
  setWsStatus: (wsStatus: WsStatus) => void;
  setSessionId: (sessionId: string) => void; // Add this setter
  addPlayer: (player: Player) => void;
  addToWaitingPlayers: (waitingPlayer: Player) => void;
  addToGuessedPlayers: (guessedPlayer: Player) => void;
  guessingPlayerGuessed: () => void;
}
// Individual default constants for each game state attribute
export const DEFAULT_I_AM: Player | null = null;
const DEFAULT_PLAYERS: Player[] = [];
const DEFAULT_WAITING_PLAYERS: Player[] = [];
const DEFAULT_GUESSED_PLAYERS: Player[] = [];
const DEFAULT_REFEREE: Player | null = null;
const DEFAULT_GAME_HOST: Player | null = null;
const DEFAULT_MUSIC_HOST: Player | null = null;
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
    newSessionId: string
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
  }; 

  const removePlayer = (playerId: string) => {
    setPlayers(players.filter(player => player.id !== playerId));
    setWaitingPlayers(waitingPlayers.filter(player => player.id !== playerId));
    setGuessedPlayers(guessedPlayers.filter(player => player.id !== playerId));
    setReferee(referee?.id === playerId ? null : referee);
    setGameHost(gameHost?.id === playerId ? null : gameHost);
    setMusicHost(musicHost?.id === playerId ? null : musicHost);
    if (iAm?.id === playerId) {
      setIAm(null);
    }
  };

  const addPlayer = (player: Player) => {
    setPlayers(prevPlayers => [...prevPlayers, player]);
  };

  const addToWaitingPlayers = (waitingPlayer: Player) => {
    setWaitingPlayers(prevWaitingPlayers => [...prevWaitingPlayers, waitingPlayer]);
  };

  const addToGuessedPlayers = (guessedPlayer: Player) => {
    setGuessedPlayers(prevGuessedPlayers => [...prevGuessedPlayers, guessedPlayer]);
  };

  const guessingPlayerGuessed = () => {
    setGuessedPlayers(prevGuessedPlayers => [
      ...prevGuessedPlayers,
      waitingPlayers[0]
    ]);
    setWaitingPlayers(prevWaitingPlayers => prevWaitingPlayers.slice(1));
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
        status,
        wsStatus,
        sessionId,
        setIAm,
        setGameState,
        removePlayer,
        setPlayers,
        setWaitingPlayers,
        setGuessedPlayers,
        setReferee,
        setGameHost,
        setMusicHost,
        setStatus,
        setWsStatus,
        setSessionId,
        addPlayer,
        addToWaitingPlayers,
        addToGuessedPlayers,
        guessingPlayerGuessed
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