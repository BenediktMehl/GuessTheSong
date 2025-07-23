import React, { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { handleSpotifyLogin, handleSpotifyLoginCallback } from './spotifyAuth'


export default function SpotifyLoginCallback() {
    const location = useLocation()
    const [isLoggedInSpotify, setIsLoggedInSpotify] = useState<boolean | null>(null)
    const hasHandled = useRef(false);


    useEffect(() => {
        if (hasHandled.current) return;
        hasHandled.current = true;

        handleSpotifyLoginCallback().then(isLoggedIn => {
            console.log("Spotify login callback handled, isLoggedIn:", isLoggedIn)
            setIsLoggedInSpotify(isLoggedIn)
            if(isLoggedIn) {
                window.location.href = '/menu'
            }
        })
    }, [location.search])

    return (
        <main className="min-h-screen flex items-center justify-center">
            <div className="card w-full max-w-md bg-base-100 shadow-xl">
                <div className="card-body items-center text-center">
                    {isLoggedInSpotify ? (
                       <p>Now redirecting to game</p>
                    ) : (
                        <>
                            <h2 className="card-title text-2xl mb-2">Spotify Login not Successful</h2>
                            <p className="text-error">Something went wrong. Please try logging in again.</p>
                            <button
                                className="btn btn-outline btn-success mb-4"
                                onClick={handleSpotifyLogin}
                            >
                                Log in with Spotify
                            </button>
                        </>
                    )}
                </div>
            </div>
        </main>
    )
}