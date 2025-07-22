import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { Background } from './pages/Types/Background.tsx'
import { GameProvider } from './game/context';
import Overlay from './pages/Roles/MusicHost/Overlay';
import { SpotifyAuthProvider } from './pages/Roles/MusicHost/SpotifyAuthContext.tsx'


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SpotifyAuthProvider>
      <GameProvider>
        <Background />
        <Overlay />
        <div className="relative z-10">
          <App />
        </div>
      </GameProvider>
    </SpotifyAuthProvider>
  </StrictMode>,
)

