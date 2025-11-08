import type { LastSong } from '../game/context';
import { Card } from './Card';

interface LastSongCardProps {
  lastSong: LastSong;
  waitingPlayersCount: number;
  guessedPlayersCount: number;
}

export function LastSongCard({
  lastSong,
  waitingPlayersCount,
  guessedPlayersCount,
}: LastSongCardProps) {
  // Only show when lastSong exists and all players are reset (back in default list)
  const shouldShow =
    lastSong !== null &&
    lastSong !== undefined &&
    waitingPlayersCount === 0 &&
    guessedPlayersCount === 0;

  if (!shouldShow || !lastSong) {
    return null;
  }

  return (
    <Card className="w-full max-w-md" bodyClassName="text-center py-2 sm:py-4" title="Last Song">
      <div className="flex flex-col gap-1.5 sm:gap-2">
        <div>
          <p className="text-base sm:text-lg font-semibold text-primary">{lastSong.name}</p>
        </div>
        <div>
          <p className="text-xs sm:text-sm text-base-content/70">{lastSong.artists.join(', ')}</p>
        </div>
      </div>
    </Card>
  );
}
