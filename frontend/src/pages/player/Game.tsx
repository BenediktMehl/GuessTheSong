import appConfig from '@app-config';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/Card';
import { LastSongCard } from '../../components/LastSongCard';
import PlayersLobby from '../../components/PlayersLobby';
import { PlayerToastComponent } from '../../components/PlayerToast';
import { useGameContext } from '../../game/context';
import { leaveGame, sendPlayerBuzzedAction, sendPlayerNoClueAction } from '../../game/player';
import {
  initializeBuzzerSound,
  playBuzzerSound,
  setBuzzerSoundMuted,
} from '../../game/player/buzzerSound';
import logger from '../../utils/logger';

const BUZZER_SOUND_ENABLED_KEY = 'buzzerSoundEnabled';

export default function Game() {
  const gameContext = useGameContext();
  const {
    players,
    currentPlayerId,
    waitingPlayers,
    guessedPlayers,
    partiallyGuessedPlayers,
    noCluePlayers,
    buzzerNotification,
    setBuzzerNotification,
    playerToast,
    setPlayerToast,
    lastSong,
  } = gameContext;
  const navigate = useNavigate();

  // Calculate notGuessedPlayers (players not in waiting, guessed, partially guessed, or no clue arrays)
  const waitingPlayerIds = new Set((waitingPlayers || []).map((p) => p.id));
  const guessedPlayerIds = new Set((guessedPlayers || []).map((p) => p.id));
  const partiallyGuessedPlayerIds = new Set((partiallyGuessedPlayers || []).map((p) => p.id));
  const noCluePlayerIds = new Set((noCluePlayers || []).map((p) => p.id));
  const notGuessedPlayers = (players || [])
    .filter(
      (p) =>
        !waitingPlayerIds.has(p.id) &&
        !guessedPlayerIds.has(p.id) &&
        !partiallyGuessedPlayerIds.has(p.id) &&
        !noCluePlayerIds.has(p.id)
    )
    .sort((a, b) => b.points - a.points);

  // Find currentPlayer object from currentPlayerId
  const allPlayers = [
    ...(players || []),
    ...(waitingPlayers || []),
    ...(guessedPlayers || []),
    ...(partiallyGuessedPlayers || []),
    ...(noCluePlayers || []),
  ];
  const currentPlayer = currentPlayerId
    ? allPlayers.find((p) => p.id === currentPlayerId)
    : undefined;
  const [showJoinedToast, setShowJoinedToast] = useState(true);
  const [buzzerColor, setBuzzerColor] = useState<string>('');

  // Buzzer sound enabled state (default to true, stored in localStorage)
  const [buzzerSoundEnabled, setBuzzerSoundEnabled] = useState<boolean>(() => {
    const stored = localStorage.getItem(BUZZER_SOUND_ENABLED_KEY);
    return stored === null ? true : stored === 'true';
  });

  // Generate a random color for the buzzer on mount
  useEffect(() => {
    const colors = [
      '#FF1744', // Bright Red
      '#00E676', // Bright Green
      '#00B0FF', // Bright Blue
      '#FFD600', // Bright Yellow
      '#D500F9', // Bright Purple
      '#FF6D00', // Bright Orange
      '#00E5FF', // Bright Cyan
      '#FF4081', // Bright Pink
      '#64FFDA', // Bright Turquoise
      '#FFEA00', // Bright Lemon
    ];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    setBuzzerColor(randomColor);
  }, []);

  // Initialize buzzer sound selection on mount (similar to buzzer color)
  useEffect(() => {
    initializeBuzzerSound();
  }, []);

  // Persist buzzer sound preference to localStorage and sync with audio object
  useEffect(() => {
    localStorage.setItem(BUZZER_SOUND_ENABLED_KEY, buzzerSoundEnabled.toString());
    // Sync mute state with audio object (muted when sound is disabled)
    setBuzzerSoundMuted(!buzzerSoundEnabled);
  }, [buzzerSoundEnabled]);

  // Toggle buzzer sound
  const toggleBuzzerSound = useCallback(() => {
    setBuzzerSoundEnabled((prev) => !prev);
  }, []);

  useEffect(() => {
    if (showJoinedToast) {
      const timer = setTimeout(() => setShowJoinedToast(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [showJoinedToast]);

  // Auto-dismiss buzzer notification after 3 seconds
  useEffect(() => {
    if (buzzerNotification) {
      const timer = setTimeout(() => {
        setBuzzerNotification(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [buzzerNotification, setBuzzerNotification]);

  // Check if current player is in the waiting queue
  const currentPlayerInQueue = currentPlayerId
    ? (waitingPlayers || []).findIndex((p) => p.id === currentPlayerId)
    : -1;
  const isCurrentPlayerFirst = currentPlayerInQueue === 0;
  const isCurrentPlayerInQueue = currentPlayerInQueue >= 0;
  const queuePosition = currentPlayerInQueue >= 0 ? currentPlayerInQueue + 1 : null;

  // Check if current player has already guessed (either fully or partially)
  const hasCurrentPlayerGuessed = currentPlayerId
    ? (guessedPlayers || []).some((p) => p.id === currentPlayerId) ||
      (partiallyGuessedPlayers || []).some((p) => p.id === currentPlayerId)
    : false;

  // Check if current player is in no clue list
  const isCurrentPlayerNoClue = currentPlayerId
    ? (noCluePlayers || []).some((p) => p.id === currentPlayerId)
    : false;

  // Check if buzzer should be disabled (already buzzed, already guessed, or no clue)
  const isBuzzerDisabled =
    isCurrentPlayerInQueue || hasCurrentPlayerGuessed || isCurrentPlayerNoClue || !currentPlayerId;

  const handleBuzz = useCallback(() => {
    logger.debug('[Buzzer] handleBuzz called', {
      isCurrentPlayerInQueue,
      hasCurrentPlayerGuessed,
      isCurrentPlayerNoClue,
      currentPlayerId,
    });

    // Don't allow buzzing if already in queue, already guessed, or no clue
    if (isBuzzerDisabled) {
      logger.debug('[Buzzer] Buzzer blocked:', {
        isCurrentPlayerInQueue,
        hasCurrentPlayerGuessed,
        isCurrentPlayerNoClue,
        currentPlayerId,
      });
      return;
    }

    // Play buzzer sound locally if enabled
    if (buzzerSoundEnabled) {
      playBuzzerSound();
    }

    // Send buzz action to host
    logger.debug('[Buzzer] Sending buzz action...');
    const success = sendPlayerBuzzedAction();
    if (!success) {
      logger.error('[Buzzer] Failed to send buzz action');
    } else {
      logger.debug('[Buzzer] Buzz action sent successfully');
    }
  }, [
    isBuzzerDisabled,
    isCurrentPlayerInQueue,
    hasCurrentPlayerGuessed,
    isCurrentPlayerNoClue,
    currentPlayerId,
    buzzerSoundEnabled,
  ]);

  const handleNoClue = useCallback(() => {
    logger.debug('[NoClue] handleNoClue called', {
      isCurrentPlayerInQueue,
      hasCurrentPlayerGuessed,
      isCurrentPlayerNoClue,
      currentPlayerId,
    });

    // Don't allow if already in queue, already guessed, or already no clue
    if (
      isCurrentPlayerInQueue ||
      hasCurrentPlayerGuessed ||
      isCurrentPlayerNoClue ||
      !currentPlayerId
    ) {
      logger.debug('[NoClue] No clue button blocked:', {
        isCurrentPlayerInQueue,
        hasCurrentPlayerGuessed,
        isCurrentPlayerNoClue,
        currentPlayerId,
      });
      return;
    }

    // Send no clue action to host
    logger.debug('[NoClue] Sending no clue action...');
    const success = sendPlayerNoClueAction();
    if (!success) {
      logger.error('[NoClue] Failed to send no clue action');
    } else {
      logger.debug('[NoClue] No clue action sent successfully');
    }
  }, [isCurrentPlayerInQueue, hasCurrentPlayerGuessed, isCurrentPlayerNoClue, currentPlayerId]);

  const getGameStateContent = (buzzerColorValue: string) => {
    if (isCurrentPlayerFirst) {
      return {
        title: 'Your Turn!',
        content: (
          <p className="text-sm sm:text-base md:text-lg text-base-content/80">
            It is now your turn to{' '}
            <span className="font-bold" style={{ color: buzzerColorValue || '#FF6B6B' }}>
              {appConfig.displayName}
            </span>
          </p>
        ),
      };
    }

    if (isCurrentPlayerInQueue && queuePosition !== null && queuePosition > 1) {
      const playersAhead = queuePosition - 1;
      const currentGuesser = (waitingPlayers || [])[0];
      return {
        title: 'Waiting for Your Turn',
        content: (
          <p className="text-sm sm:text-base md:text-lg text-base-content/80">
            It is {currentGuesser?.name || 'someone'}'s turn to {appConfig.displayName}. It is your
            turn after {playersAhead > 1 ? `${playersAhead} players` : 'him/her'}!
          </p>
        ),
      };
    }

    if (hasCurrentPlayerGuessed) {
      const currentGuesser = (waitingPlayers || [])[0];
      return {
        title: 'Already Guessed',
        content: (
          <p className="text-sm sm:text-base md:text-lg text-base-content/80">
            {currentGuesser
              ? `It is ${currentGuesser.name}'s turn to ${appConfig.displayName}.`
              : `Waiting for next player to ${appConfig.displayName}.`}{' '}
            You have already guessed this round.
          </p>
        ),
      };
    }

    if (isCurrentPlayerNoClue) {
      const currentGuesser = (waitingPlayers || [])[0];
      return {
        title: 'No Clue',
        content: (
          <p className="text-sm sm:text-base md:text-lg text-base-content/80">
            {currentGuesser
              ? `It is ${currentGuesser.name}'s turn to ${appConfig.displayName}.`
              : `Waiting for next player to ${appConfig.displayName}.`}{' '}
            You have opted out of guessing this round.
          </p>
        ),
      };
    }

    return {
      title: 'Ready to Guess',
      content: (
        <p className="text-sm sm:text-base md:text-lg text-base-content/80">
          Press the{' '}
          <span
            className="font-bold text-lg sm:text-xl md:text-2xl"
            style={{
              color: buzzerColorValue || '#FF1744',
              textShadow:
                '0 0 2px rgba(128, 128, 128, 0.8), 0 0 4px rgba(128, 128, 128, 0.6), 0 0 6px rgba(128, 128, 128, 0.4)',
            }}
          >
            buzzer
          </span>{' '}
          to guess the current song
        </p>
      ),
    };
  };

  const gameState = getGameStateContent(buzzerColor);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-2 sm:p-4 gap-3 sm:gap-6 relative">
      {/* Buzzer sound toggle button in upper right corner */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleBuzzerSound();
        }}
        className="absolute top-2 right-2 sm:top-4 sm:right-4 btn btn-circle btn-xs sm:btn-sm bg-base-100/90 hover:bg-base-100 border border-base-300 shadow-lg z-50 pointer-events-auto"
        aria-label={buzzerSoundEnabled ? 'Disable buzzer sound' : 'Enable buzzer sound'}
        title={buzzerSoundEnabled ? 'Disable buzzer sound' : 'Enable buzzer sound'}
      >
        {buzzerSoundEnabled ? (
          // Speaker icon (sound enabled)
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
            className="w-4 h-4 sm:w-5 sm:h-5"
            aria-hidden="true"
          >
            <title>Speaker icon</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z"
            />
          </svg>
        ) : (
          // Speaker muted icon (sound disabled)
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
            className="w-4 h-4 sm:w-5 sm:h-5 opacity-60"
            aria-hidden="true"
          >
            <title>Speaker muted icon</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 3l18 18"
              style={{ opacity: 0.75 }}
            />
          </svg>
        )}
      </button>

      {(showJoinedToast || buzzerNotification || playerToast) && (
        <div className="toast toast-top toast-center z-50">
          {showJoinedToast && (
            <div className="alert alert-success shadow-2xl">
              <span>Successfully joined the game!</span>
            </div>
          )}
          {buzzerNotification && (
            <div className="alert alert-info shadow-2xl">
              <span>
                <strong>{buzzerNotification.playerName}</strong> pressed the buzzer!
              </span>
            </div>
          )}
          <PlayerToastComponent toast={playerToast} onDismiss={() => setPlayerToast(null)} />
        </div>
      )}

      {/* biome-ignore lint/a11y/noStaticElementInteractions: This div only stops event propagation, not interactive */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: This div only stops event propagation, not interactive */}
      <div
        className="w-full max-w-md flex flex-col gap-3 sm:gap-6"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <LastSongCard lastSong={lastSong} />

        <PlayersLobby
          notGuessedPlayers={notGuessedPlayers}
          waitingPlayers={waitingPlayers}
          guessedPlayers={guessedPlayers}
          partiallyGuessedPlayers={partiallyGuessedPlayers}
          noCluePlayers={noCluePlayers}
          currentPlayer={currentPlayer}
        />

        <Card
          className="w-full"
          bodyClassName="items-center text-center gap-2 sm:gap-4 py-2 sm:py-4"
        >
          <div className="w-full flex flex-col items-center gap-2 sm:gap-4">
            <div className="w-full">{gameState.content}</div>
            <button
              type="button"
              disabled={isBuzzerDisabled}
              className={`relative w-32 h-32 sm:w-44 sm:h-44 rounded-full transition-all focus:outline-none focus:ring-4 focus:ring-offset-2 ${
                isBuzzerDisabled
                  ? 'cursor-not-allowed opacity-50'
                  : 'cursor-pointer hover:scale-105 active:scale-95'
              }`}
              onClick={handleBuzz}
              onTouchStart={handleBuzz}
              style={{
                background: isBuzzerDisabled
                  ? `radial-gradient(circle at 30% 30%, #9E9E9Eff, #757575 50%, #616161dd)`
                  : `radial-gradient(circle at 30% 30%, ${buzzerColor || '#FF1744'}ff, ${buzzerColor || '#FF1744'} 50%, ${buzzerColor || '#FF1744'}dd)`,
                boxShadow: isBuzzerDisabled
                  ? `
                      0 10px 20px -5px rgba(0, 0, 0, 0.3),
                      0 0 0 4px rgba(0, 0, 0, 0.1),
                      inset 0 -5px 10px -5px rgba(0, 0, 0, 0.3),
                      inset 0 5px 12px -5px rgba(255, 255, 255, 0.2)
                    `
                  : `
                      0 20px 40px -5px rgba(0, 0, 0, 0.5),
                      0 0 0 4px rgba(0, 0, 0, 0.15),
                      inset 0 -10px 20px -5px rgba(0, 0, 0, 0.4),
                      inset 0 10px 25px -5px rgba(255, 255, 255, 0.4),
                      inset 0 0 30px rgba(255, 255, 255, 0.2)
                    `,
              }}
              aria-label={
                isBuzzerDisabled
                  ? 'Buzzer already pressed'
                  : 'Press to buzz and guess the current song'
              }
            >
              {/* Outer ring */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  border: `4px solid ${isBuzzerDisabled ? '#9E9E9E' : buzzerColor || '#FF1744'}`,
                  boxShadow: 'inset 0 3px 6px rgba(0, 0, 0, 0.3)',
                }}
              />
              {/* Shiny dome effect - only show when enabled */}
              {!isBuzzerDisabled && (
                <>
                  <div
                    className="absolute inset-2 sm:inset-3 rounded-full"
                    style={{
                      background: `radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.2) 40%, transparent 70%)`,
                      boxShadow: 'inset 0 -5px 15px rgba(0, 0, 0, 0.2)',
                    }}
                  />
                  {/* Additional shine highlight */}
                  <div
                    className="absolute top-3 left-4 sm:top-4 sm:left-6 w-8 h-8 sm:w-12 sm:h-12 rounded-full opacity-60"
                    style={{
                      background: 'radial-gradient(circle, rgba(255, 255, 255, 0.8), transparent)',
                    }}
                  />
                </>
              )}
            </button>
            <button
              type="button"
              disabled={
                isCurrentPlayerInQueue ||
                hasCurrentPlayerGuessed ||
                isCurrentPlayerNoClue ||
                !currentPlayerId
              }
              className="btn btn-sm btn-outline btn-warning"
              onClick={handleNoClue}
              aria-label={
                isCurrentPlayerNoClue ? 'Already opted out' : 'Opt out of guessing this round'
              }
            >
              No clue
            </button>
          </div>
        </Card>

        <button
          type="button"
          onClick={() => {
            leaveGame(gameContext);
            navigate('/join');
          }}
          className="btn btn-sm btn-outline btn-error"
        >
          Leave Lobby
        </button>
      </div>
    </main>
  );
}
