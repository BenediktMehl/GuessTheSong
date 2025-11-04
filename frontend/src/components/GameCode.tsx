import appConfig from "@app-config";
import { Card } from "./Card";
interface GameCodeProps {
    sessionId: string;
    showCopyLink?: boolean;
    onCopy?: () => void;
    onCopyError?: () => void;
}

export default function GameCode({ sessionId, showCopyLink = false, onCopy, onCopyError }: GameCodeProps) {
    const inviteLink = `${window.location.origin}/join?id=${sessionId}`;
    const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

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
                title: `Join my ${appConfig.displayName} game!`,
                text: `Join my game with code: ${sessionId}`,
                url: inviteLink
            });
        } catch (err) {
            // User cancelled or share not supported
            console.log('Share cancelled or not supported:', err);
        }
    };

    return (
        <Card title="Game Code" className="w-full max-w-md" bodyClassName="gap-3">
            <div className="text-center">
                <span className="text-3xl md:text-4xl font-mono font-bold tracking-widest text-primary">
                    {sessionId}
                </span>
            </div>

            {showCopyLink && (
                <>
                    <div className="divider my-1 text-xs">OR</div>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            className="input input-bordered input-sm flex-1 text-xs bg-white/70"
                            value={inviteLink}
                            readOnly
                            onFocus={e => e.target.select()}
                        />
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={handleCopy}
                            title="Copy link"
                        >
                            📋
                        </button>
                        {canShare && (
                            <button
                                className="btn btn-success btn-sm"
                                onClick={handleShare}
                                title="Share link"
                            >
                                🔗
                            </button>
                        )}
                    </div>
                </>
            )}
        </Card>
    );
}
