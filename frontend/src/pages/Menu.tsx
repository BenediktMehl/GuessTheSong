import React, { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getSpotifyProfile, handleSpotifyLogin, handleSpotifyLoginCallback, handleSpotifyLogout } from '../util/spotify'


export default function Menu() {
    const location = useLocation()
    const [isLoggedInSpotify, setIsLoggedInSpotify] = useState<boolean | null>(null)
    const [inviteLink, setInviteLink] = useState<string | null>(null)
    const [userProfile, setUserProfile] = useState<any>(null)
    const [showCopiedToast, setShowCopiedToast] = useState(false);

    useEffect(() => {
        getSpotifyProfile().then(profile => {
            setUserProfile(profile)
        })

        const codeParam = "placeHolder"
        if (codeParam) {
            // In a real app, you would exchange the code for a token and create a real invite link
            setInviteLink(`${window.location.origin}/join?invite=${encodeURIComponent(codeParam)}`)
        }
    }, [location.search])

    return (
        <main className="min-h-screen flex items-center justify-center bg-base-200">
            <div className="card w-full max-w-md bg-base-100 shadow-xl">
                <div className="card-body items-center text-center">
                    <h2 className="card-title text-2xl mb-2">Game Menu</h2>
                    {userProfile ? (
                        <div className="mb-4 flex flex-col items-center">
                            {userProfile.images[0]?.url && (
                                <img
                                    src={userProfile.images[0]?.url}
                                    alt="User Avatar"
                                    className="w-16 h-16 rounded-full mb-2"
                                />
                            )}
                            <p className="text-lg">Logged in with spotify user:</p>
                            <p className="text-lg font-semibold">{userProfile.display_name}</p>
                            <button
                                onClick={handleSpotifyLogout}
                                className="btn btn-sm btn-outline btn-error mt-2"
                            >
                                Logout
                            </button>
                        </div>
                    ) : (
                        <p className="text-lg font-semibold">Loading user profile...</p>
                    )}
                    <p className="mb-2">Share this invite link with your friends:</p>
                    {inviteLink && (
                        <>
                        <div className="mb-4 horizontal flex items-center gap-2">
                            <input
                                type="text"
                                className="input input-bordered w-full"
                                value={inviteLink}
                                readOnly
                                onFocus={e => e.target.select()}
                            />
                            <button
                                className="btn btn-primary"
                                onClick={() => {
                                    navigator.clipboard.writeText(inviteLink)
                                    setShowCopiedToast(true)
                                    setTimeout(() => setShowCopiedToast(false), 2000)
                                }}
                            >
                                Copy
                            </button>
                        </div>
                        {showCopiedToast && (
                            <div className="toast toast-top toast-center">
                                <div className="alert alert-success">
                                    <span>Invite link copied to clipboard!</span>
                                </div>
                            </div>
                        )}
                        </>
                    )}
                    <a href="/host" className="btn btn-success">Start Game</a>
                </div>
            </div>
        </main >
    )
}