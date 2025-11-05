import './index.css';
import appConfig from '@app-config';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Background } from './Background.tsx';
import { BackendToggle } from './components/BackendToggle.tsx';
import { GameProvider } from './game/context';
import Overlay from './pages/Roles/MusicHost/Overlay';
import { SpotifyAuthProvider } from './pages/Roles/MusicHost/SpotifyAuthContext.tsx';
import { App } from './Welcome.tsx';

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
        <Overlay />
        {import.meta.env.DEV && <BackendToggle />}
        <div className="relative z-10">
          <App />
        </div>
      </GameProvider>
    </SpotifyAuthProvider>
  </StrictMode>
);
