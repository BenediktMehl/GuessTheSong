import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Background } from './Background.tsx'
import { GameProvider } from './game/context';
import Overlay from './pages/Roles/MusicHost/Overlay';
import { SpotifyAuthProvider } from './pages/Roles/MusicHost/SpotifyAuthContext.tsx'
import { App } from './Welcome.tsx';
import { BackendToggle } from './components/BackendToggle.tsx';


createRoot(document.getElementById('root')!).render(
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
  </StrictMode>,
)

