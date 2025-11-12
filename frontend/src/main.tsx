import './index.css';
import appConfig from '@app-config';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Background } from './Background.tsx';
import { DevFloating } from './components/DevFloating.tsx';
import { GameProvider } from './game/context';
import { App } from './pages/Welcome';

// Unregister any existing service workers to prevent redirect loops
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister().then((success) => {
        if (success) {
          console.log('Service worker unregistered successfully');
        }
      });
    }
  });
}

document.title = appConfig.displayName;

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <GameProvider>
      <Background />
      {import.meta.env.DEV && <DevFloating />}
      <div className="relative z-10">
        <App />
      </div>
      {/* Vercel Speed Insights (no-op in dev) */}
      <SpeedInsights />
    </GameProvider>
  </StrictMode>
);
