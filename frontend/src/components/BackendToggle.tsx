import { useEffect, useState } from 'react';

const BACKEND_TOGGLE_KEY = 'dev-backend-toggle';

export function BackendToggle() {
  const [useLocalBackend, setUseLocalBackend] = useState(() => {
    const saved = localStorage.getItem(BACKEND_TOGGLE_KEY);
    return saved === 'local';
  });

  useEffect(() => {
    localStorage.setItem(BACKEND_TOGGLE_KEY, useLocalBackend ? 'local' : 'pi');
    // Trigger event for config.ts to listen to
    window.dispatchEvent(new CustomEvent('backend-toggle-changed', { 
      detail: { useLocalBackend } 
    }));
  }, [useLocalBackend]);

  const handleToggle = () => {
    const newValue = !useLocalBackend;
    setUseLocalBackend(newValue);
    // Force reload to apply new backend
    window.location.reload();
  };

  return (
    <div className="fixed top-4 left-4 z-[9999] bg-base-200 rounded-lg shadow-lg p-3 border-2 border-primary">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold">Backend:</span>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className={`text-xs ${!useLocalBackend ? 'font-bold' : 'opacity-60'}`}>
            Pi
          </span>
          <input
            type="checkbox"
            className="toggle toggle-primary toggle-sm"
            checked={useLocalBackend}
            onChange={handleToggle}
          />
          <span className={`text-xs ${useLocalBackend ? 'font-bold' : 'opacity-60'}`}>
            Local
          </span>
        </label>
      </div>
    </div>
  );
}
