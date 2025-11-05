import './index.css';
import appConfig from '@app-config';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Background } from './Background.tsx';
import { BackendToggle } from './components/BackendToggle.tsx';
import SpotifyOverlay from './components/SpotifyOverlay';
import { GameProvider } from './game/context';
import { App } from './pages/Welcome';
import { SpotifyAuthProvider } from './services/spotify/context';

document.title = appConfig.displayName;

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <SpotifyAuthProvider>
      <GameProvider>
        <Background />
        <SpotifyOverlay />
        {import.meta.env.DEV && <BackendToggle />}
        <div className="relative z-10">
          <App />
        </div>
      </GameProvider>
    </SpotifyAuthProvider>
  </StrictMode>
);
