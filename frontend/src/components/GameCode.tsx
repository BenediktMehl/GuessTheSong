interface GameCodeProps {
    sessionId: string;
    showCopyLink?: boolean;
    onCopy?: () => void;
    onCopyError?: () => void;
}

export default function GameCode({ sessionId, showCopyLink = false, onCopy, onCopyError }: GameCodeProps) {
    const inviteLink = `${window.location.origin}/join?id=${sessionId}`;
    const canShare = typeof navigator !== 'undefined' && navigator.share;

    const handleCopy = async () => {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(inviteLink);
                if (onCopy) {
                    onCopy();
                }
            } else {
                // Kein Clipboard API verfügbar
                if (onCopyError) {
                    onCopyError();
                }
            }
        } catch (err) {
            console.error('Copy failed:', err);
            if (onCopyError) {
                onCopyError();
            }
        }
    };

    const handleShare = async () => {
        try {
            await navigator.share({
                title: 'Join my GuessTheSong game!',
                text: `Join my game with code: ${sessionId}`,
                url: inviteLink
            });
        } catch (err) {
            // User cancelled or share not supported
            console.log('Share cancelled or not supported:', err);
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
                            title="Copy link"
                        >
                            📋
                        </button>
                        {canShare && (
                            <button
                                className="btn btn-success"
                                onClick={handleShare}
                                title="Share link"
                            >
                                🔗
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
