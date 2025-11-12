import { useEffect, useState } from 'react';
import { Card } from './Card';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const INSTALL_PROMPT_DISMISSED_KEY = 'install-prompt-dismissed';

function isIOS(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function isAndroid(): boolean {
  return /Android/.test(navigator.userAgent);
}

function isMobile(): boolean {
  return isIOS() || isAndroid();
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  const [isAndroidDevice, setIsAndroidDevice] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Don't show if already installed or not mobile
    if (!isMobile() || isStandalone()) {
      return;
    }

    // Check if user has dismissed the prompt
    const dismissed = localStorage.getItem(INSTALL_PROMPT_DISMISSED_KEY);
    if (dismissed === 'true') {
      return;
    }

    // Detect device type
    const ios = isIOS();
    const android = isAndroid();
    setIsIOSDevice(ios);
    setIsAndroidDevice(android);

    // Show prompt after a short delay
    const timer = setTimeout(() => {
      setShowPrompt(true);
    }, 2000);

    // Listen for beforeinstallprompt event (Android/Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      // Android/Chrome - use native install prompt
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setShowPrompt(false);
        localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, 'true');
      }
      setDeferredPrompt(null);
    } else {
      // iOS - just hide the prompt (user needs to use Share button)
      setShowPrompt(false);
      localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, 'true');
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, 'true');
  };

  if (!showPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:max-w-md">
      <Card
        className="bg-white/95 backdrop-blur-lg relative"
        bodyClassName="gap-3 sm:gap-4"
        footer={
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={handleInstall} className="btn btn-sm btn-primary">
              Add to Home Screen
            </button>
          </div>
        }
      >
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-2 right-2 btn btn-xs btn-circle btn-ghost z-10"
          aria-label="Close"
        >
          ✕
        </button>
        <div className="flex items-start gap-3">
          <div className="text-3xl">📱</div>
          <div className="flex-1">
            <h3 className="font-semibold text-base mb-1">Add to Home Screen</h3>
            {isIOSDevice ? (
              <p className="text-sm text-base-content/80">
                Tap the <strong>Share</strong> button at the bottom, then select{' '}
                <strong>"Add to Home Screen"</strong> for a better fullscreen experience!
              </p>
            ) : isAndroidDevice ? (
              <p className="text-sm text-base-content/80">
                Install this app to your home screen for a better fullscreen experience without the
                browser bar!
              </p>
            ) : (
              <p className="text-sm text-base-content/80">
                Add this app to your home screen for a better experience!
              </p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
