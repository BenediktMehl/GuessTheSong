import appConfig from '@app-config';
import { useCallback, useEffect, useState } from 'react';
import { Card } from '../../components/Card';
import PlayersLobby from '../../components/PlayersLobby';
import { useGameContext } from '../../game/context';
import { sendPlayerBuzzedAction } from '../../game/player';
import { playBuzzerSound } from '../../game/player/buzzerSound';

const BUZZER_SOUND_ENABLED_KEY = 'buzzerSoundEnabled';

export default function Game() {
  const { players, currentPlayerId, waitingPlayers, guessedPlayers } = useGameContext();

  // Calculate notGuessedPlayers (players not in waiting or guessed arrays)
  const waitingPlayerIds = new Set((waitingPlayers || []).map((p) => p.id));
  const guessedPlayerIds = new Set((guessedPlayers || []).map((p) => p.id));
  const notGuessedPlayers = (players || [])
    .filter((p) => !waitingPlayerIds.has(p.id) && !guessedPlayerIds.has(p.id))
    .sort((a, b) => b.points - a.points);

  // Find currentPlayer object from currentPlayerId
  const allPlayers = [...(players || []), ...(waitingPlayers || []), ...(guessedPlayers || [])];
  const currentPlayer = currentPlayerId
    ? allPlayers.find((p) => p.id === currentPlayerId)
    : undefined;
  const { buzzerNotification, setBuzzerNotification } = useGameContext();
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

  // Persist buzzer sound preference to localStorage
  useEffect(() => {
    localStorage.setItem(BUZZER_SOUND_ENABLED_KEY, buzzerSoundEnabled.toString());
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

  // Check if current player has already guessed
  const hasCurrentPlayerGuessed = currentPlayerId
    ? (guessedPlayers || []).some((p) => p.id === currentPlayerId)
    : false;

  // Check if buzzer should be disabled (already buzzed or already guessed)
  const isBuzzerDisabled = isCurrentPlayerInQueue || hasCurrentPlayerGuessed || !currentPlayerId;

  const handleBuzz = useCallback(() => {
    console.log('[Buzzer] handleBuzz called', {
      isCurrentPlayerInQueue,
      hasCurrentPlayerGuessed,
      currentPlayerId,
    });

    // Don't allow buzzing if already in queue or already guessed
    if (isBuzzerDisabled) {
      console.log('[Buzzer] Buzzer blocked:', {
        isCurrentPlayerInQueue,
        hasCurrentPlayerGuessed,
        currentPlayerId,
      });
      return;
    }

    // Play buzzer sound locally if enabled
    if (buzzerSoundEnabled) {
      playBuzzerSound();
    }

    // Send buzz action to host
    console.log('[Buzzer] Sending buzz action...');
    const success = sendPlayerBuzzedAction();
    if (!success) {
      console.error('[Buzzer] Failed to send buzz action');
    } else {
      console.log('[Buzzer] Buzz action sent successfully');
    }
  }, [
    isBuzzerDisabled,
    isCurrentPlayerInQueue,
    hasCurrentPlayerGuessed,
    currentPlayerId,
    buzzerSoundEnabled,
  ]);

  const getGameStateContent = (buzzerColorValue: string) => {
    if (isCurrentPlayerFirst) {
      return {
        title: 'Your Turn!',
        content: (
          <p className="text-lg text-base-content/80">
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
          <p className="text-lg text-base-content/80">
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
          <p className="text-lg text-base-content/80">
            {currentGuesser
              ? `It is ${currentGuesser.name}'s turn to ${appConfig.displayName}.`
              : `Waiting for next player to ${appConfig.displayName}.`}{' '}
            You have already guessed this round.
          </p>
        ),
      };
    }

    return {
      title: 'Ready to Guess',
      content: (
        <p className="text-lg text-base-content/80">
          Press the{' '}
          <span
            className="font-bold text-2xl"
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
    <main className="min-h-screen flex flex-col items-center justify-center p-4 gap-6 relative">
      {/* Buzzer sound toggle button in upper right corner */}
      <button
        type="button"
        onClick={toggleBuzzerSound}
        className="absolute top-4 right-4 btn btn-circle btn-sm bg-base-100/90 hover:bg-base-100 border border-base-300 shadow-lg z-10"
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
            className="w-5 h-5"
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
            className="w-5 h-5 opacity-60"
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

      {showJoinedToast && (
        <div className="toast toast-top toast-center">
          <div className="alert alert-success">
            <span>Successfully joined the game!</span>
          </div>
        </div>
      )}

      {buzzerNotification && (
        <div className="toast toast-top toast-center z-50">
          <div className="alert alert-info shadow-2xl">
            <span>
              <strong>{buzzerNotification.playerName}</strong> hat den Buzzer gedrückt!
            </span>
          </div>
        </div>
      )}

      {/* biome-ignore lint/a11y/noStaticElementInteractions: This div only stops event propagation, not interactive */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: This div only stops event propagation, not interactive */}
      <div
        className="w-full max-w-md flex flex-col gap-6"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <PlayersLobby
          notGuessedPlayers={notGuessedPlayers}
          waitingPlayers={waitingPlayers}
          guessedPlayers={guessedPlayers}
          currentPlayer={currentPlayer}
        />

        <Card className="w-full" bodyClassName="items-center text-center gap-4 py-4">
          <div className="w-full flex flex-col items-center gap-4">
            <div className="w-full">{gameState.content}</div>
            <button
              type="button"
              disabled={isBuzzerDisabled}
              className={`relative w-44 h-44 rounded-full transition-all focus:outline-none focus:ring-4 focus:ring-offset-2 ${
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
                  border: `5px solid ${isBuzzerDisabled ? '#9E9E9E' : buzzerColor || '#FF1744'}`,
                  boxShadow: 'inset 0 3px 6px rgba(0, 0, 0, 0.3)',
                }}
              />
              {/* Shiny dome effect - only show when enabled */}
              {!isBuzzerDisabled && (
                <>
                  <div
                    className="absolute inset-3 rounded-full"
                    style={{
                      background: `radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.2) 40%, transparent 70%)`,
                      boxShadow: 'inset 0 -5px 15px rgba(0, 0, 0, 0.2)',
                    }}
                  />
                  {/* Additional shine highlight */}
                  <div
                    className="absolute top-4 left-6 w-12 h-12 rounded-full opacity-60"
                    style={{
                      background: 'radial-gradient(circle, rgba(255, 255, 255, 0.8), transparent)',
                    }}
                  />
                </>
              )}
            </button>
          </div>
        </Card>
      </div>
    </main>
  );
}
