import type { LastSong } from '../game/context';
import { Card } from './Card';

interface LastSongCardProps {
  lastSong: LastSong;
}

export function LastSongCard({ lastSong }: LastSongCardProps) {
  // Show whenever lastSong exists
  if (!lastSong) {
    return null;
  }

  return (
    <Card
      className="w-full max-w-md !p-2 sm:!p-3 md:!p-3"
      bodyClassName="text-center py-1 sm:py-2"
      title="Last Song"
    >
      <div className="flex flex-col gap-1 sm:gap-1.5">
        <div>
          <p className="text-sm sm:text-base font-semibold text-primary">{lastSong.name}</p>
        </div>
        <div>
          <p className="text-xs text-base-content/70">{lastSong.artists.join(', ')}</p>
        </div>
      </div>
    </Card>
  );
}
