type BackendOfflineProps = {
  showButtons?: boolean;
  onReload?: () => void;
  onBack?: () => void;
  className?: string;
};

export function BackendOffline({
  showButtons = true,
  onReload,
  onBack,
  className,
}: BackendOfflineProps) {
  const defaultReload = () => window.location.reload();

  return (
    <div className={`alert alert-error max-w-md flex flex-col gap-2 sm:gap-3 ${className || ''}`}>
      <div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="stroke-current shrink-0 h-5 w-5 sm:h-6 sm:w-6 inline mr-2"
          fill="none"
          viewBox="0 0 24 24"
          role="img"
          aria-label="Error"
        >
          <title>Error</title>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className="font-semibold text-sm sm:text-base">
          At the moment the backend is not running.
        </span>
      </div>
      <p className="text-xs sm:text-sm">
        This is just a private project. Please visit{' '}
        <a
          href="https://github.com/BenediktMehl/GuessTheSong"
          target="_blank"
          rel="noopener noreferrer"
          className="link link-primary underline"
        >
          GitHub repository
        </a>{' '}
        for more information and options to support.
      </p>
      {showButtons && (
        <div className="flex flex-col sm:flex-row gap-2 w-full">
          {onReload && (
            <button
              type="button"
              onClick={onReload}
              className="btn btn-outline btn-sm flex-1 whitespace-nowrap"
            >
              🔄 Reload
            </button>
          )}
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="btn btn-outline btn-sm flex-1 whitespace-nowrap"
            >
              ← Back
            </button>
          )}
          {!onReload && !onBack && (
            <button
              type="button"
              onClick={defaultReload}
              className="btn btn-outline btn-sm flex-1 whitespace-nowrap"
            >
              🔄 Reload
            </button>
          )}
        </div>
      )}
    </div>
  );
}
