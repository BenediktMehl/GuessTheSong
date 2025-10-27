import { createContext, useContext, useState, type ReactNode } from 'react';
import { getSpotifyProfile, handleSpotifyLogout, spotifyIsLoggedIn } from './spotifyAuth';

type SpotifyProfile = {
    display_name: string;
    images?: { url: string }[];
};

type SpotifyAuthContextType = {
    profile: SpotifyProfile | null;
    isLoggedIn: boolean;
    logout: () => Promise<void>;
    refreshProfile: () => Promise<void>;
};

const SpotifyAuthContext = createContext<SpotifyAuthContextType | undefined>(undefined);

export const SpotifyAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [profile, setProfile] = useState<SpotifyProfile | null>(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    const refreshProfile = async () => {
        if (await spotifyIsLoggedIn()) {
            const data = await getSpotifyProfile();
            setProfile(data);
            setIsLoggedIn(true);
        } else {
            setProfile(null);
            setIsLoggedIn(false);
        }
    };

    const logout = async () => {
        await handleSpotifyLogout();
        setProfile(null);
        setIsLoggedIn(false);
    };

    return (
        <SpotifyAuthContext.Provider value={{ profile, isLoggedIn, logout, refreshProfile }}>
            {children}
        </SpotifyAuthContext.Provider>
    );
};

export const useSpotifyAuth = () => {
    const context = useContext(SpotifyAuthContext);
    if (!context) throw new Error('useSpotifyAuth must be used within a SpotifyAuthProvider');
    return context;
};