import { useEffect } from 'react';
import type { PlayerToast } from '../game/context';

interface PlayerToastProps {
  toast: PlayerToast;
  onDismiss: () => void;
}

export function PlayerToastComponent({ toast, onDismiss }: PlayerToastProps) {
  useEffect(() => {
    if (!toast) {
      return;
    }

    const duration = toast.duration ?? 3000;
    const timer = setTimeout(() => {
      onDismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) {
    return null;
  }

  // Map toast type to DaisyUI alert class
  const alertClass = {
    success: 'alert-success',
    warning: 'alert-warning',
    error: 'alert-error',
    info: 'alert-info',
  }[toast.type];

  return (
    <div className="toast toast-top toast-center z-[60]">
      <div className={`alert ${alertClass} shadow-2xl`}>
        <span>{toast.message}</span>
      </div>
    </div>
  );
}

