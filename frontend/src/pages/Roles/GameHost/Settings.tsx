import { useState } from "react";

export default function Settings() {
    const [showCopiedToast, setShowCopiedToast] = useState(false);

    const inviteLink = "asdfasdf"

    return (
        <main className="min-h-screen flex flex-col items-center justify-center">
            <h2 className="text-2xl mb-2 text-center">Settings</h2>
            <p className="mb-2 text-center">Share this invite link with your friends:</p>
            {inviteLink && (
                <>
                    <div className="mb-4 flex items-center gap-2 w-full max-w-md justify-center">
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
            <a href="/hostgame" className="btn btn-success mt-4">Start Game</a>
        </main >
    )
}