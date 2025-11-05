import { useState } from 'react';
import { useSpotifyAuth } from './SpotifyAuthContext';

export default function Overlay() {
  const { profile, isLoggedIn, logout } = useSpotifyAuth();
  const [isHovered, setIsHovered] = useState(false);

  if (!isLoggedIn || !profile) return null;

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout from Spotify?')) {
      logout();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleLogout();
    }
  };

  const backgroundColor = isHovered ? 'rgba(64, 64, 64, 0.4)' : 'rgba(128, 128, 128, 0.2)';

  return (
    <button
      type="button"
      className="fixed top-4 right-4 z-50 flex items-center rounded-full shadow-xl px-3 py-1 gap-2 border border-gray-500 cursor-pointer transition-colors"
      style={{ backgroundColor }}
      onClick={handleLogout}
      onKeyDown={handleKeyDown}
      title="Logout from Spotify"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span className="font-medium text-base text-gray">{profile.display_name}</span>
      <img
        src={profile.images?.[0]?.url}
        alt="Spotify profile"
        className="w-8 h-8 rounded-full border border-gray-500"
        referrerPolicy="no-referrer"
      />
    </button>
  );
}
