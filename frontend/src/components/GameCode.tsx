interface GameCodeProps {
    sessionId: string;
    showCopyLink?: boolean;
    onCopy?: () => void;
}

export default function GameCode({ sessionId, showCopyLink = false, onCopy }: GameCodeProps) {
    const inviteLink = `${window.location.origin}/join?id=${sessionId}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(inviteLink);
        if (onCopy) {
            onCopy();
        }
    };

    return (
        <div className="card bg-base-200 shadow-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4 text-center">Game Code</h3>
            <div className="text-center mb-4">
                <span className="text-5xl font-mono font-bold tracking-widest text-primary">
                    {sessionId}
                </span>
            </div>
            
            {showCopyLink && (
                <>
                    <div className="divider">OR</div>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            className="input input-bordered flex-1 text-sm"
                            value={inviteLink}
                            readOnly
                            onFocus={e => e.target.select()}
                        />
                        <button
                            className="btn btn-primary"
                            onClick={handleCopy}
                        >
                            📋
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
