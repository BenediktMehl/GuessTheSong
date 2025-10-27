import { useSpotifyAuth } from './SpotifyAuthContext';


export default function Overlay() {
    const { profile, isLoggedIn, logout } = useSpotifyAuth();

    if (!isLoggedIn || !profile) return null;

    const handleLogout = () => {
        if (window.confirm('Are you sure you want to logout from Spotify?')) {
            logout();
        }
    };

    return (
        <div
            className="fixed top-4 right-4 z-50 flex items-center rounded-full shadow-xl px-3 py-1 gap-2 border border-gray-500 cursor-pointer transition-colors"
            style={{ backgroundColor: 'rgba(128, 128, 128, 0.2)' }}
            onClick={handleLogout}
            title="Logout from Spotify"
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(64, 64, 64, 0.4)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(128, 128, 128, 0.2)')}
        >
            <span className="font-medium text-base text-gray">{profile.display_name}</span>
            <img
                src={profile.images?.[0]?.url}
                alt="Spotify profile"
                className="w-8 h-8 rounded-full border border-gray-500"
                referrerPolicy="no-referrer"
            />
        </div>
    );
}