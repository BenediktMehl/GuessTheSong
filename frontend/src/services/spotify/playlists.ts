/**
 * Default playlist IDs that are available for selection
 * Developers can add more playlist IDs here to provide a nice preselection for users
 */
export const DEFAULT_PLAYLISTS = [
  {
    id: '1jHJldEedIdF8D49kPEiPR',
    name: 'Erkennst du den Song?',
  },
] as const;

export const DEFAULT_PLAYLIST_ID = DEFAULT_PLAYLISTS[0].id;
