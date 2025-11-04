# Copilot Instructions for GuessTheSong

## Project Overview
- **GuessTheSong** is a real-time, multiplayer music quiz game powered by Spotify.
- Monorepo structure:
  - `frontend/`: React PWA (TypeScript)
  - `backend/`: Node.js WebSocket server (TypeScript)

## Architecture & Data Flow
- **Frontend**: Handles UI, game logic, and Spotify integration for music playback/auth.
- **Backend**: Manages game state, player sessions, and real-time signaling via WebSockets.
- **Game Flow**: Players join via code, guess songs, scores tracked server-side, music streamed via Spotify API.
- **Plans**: All new features/fixes start with a plan in `plans/` (see `template.md`).

## Frontend UI 
- The App is a Progressive Web App (PWA) built with React and TypeScript.
- The UI is optimized for mobile devices, with responsive design principles.
- There is no need to scroll horizontally; all content fits within the viewport width.
- The Theme is colorful and engaging, using a palette that complements the music quiz theme.
- The components are a rounded, have shadows, and use smooth animations for transitions and interactions.
- Components have a white, slightly elevated card-like appearance against a the colorful, moving gradient background.
- Components are slightly transparent, allowing the dynamic background to subtly show through, but the shadow ensures readability.

## Developer Workflow
- **Install dependencies**: `npm install` (root, then each package)
- **Run frontend**: `cd frontend && npm run dev`
- **Run backend**: `cd backend && npm start`
- **Tests**:
  - Frontend: `cd frontend && npm test` (Vitest)
  - Backend: `cd backend && npm test` (Jest)
- **Formatting**: BiomeJS auto-formats TypeScript; Husky/lint-staged enforce style on commit.
- **Branching**: Use `<type>/<name>` (e.g., `feature/add-dark-mode`), always rebase on `main`.
- **Commits**: Conventional format (see `agents.md` for details).

## Patterns & Conventions
- **TDD**: Write failing test, minimum code to pass, refactor, commit.
- **Test Naming**: Always start with `should...` and use Arrange-Act-Assert comments.
- **Code Quality**: DRY, SOLID, expressive naming, fix warnings, prefer immutability.
- **Structural vs Behavioral**: Separate refactors from features/fixes; commit structural changes first.
- **Plans**: Every significant change starts with a plan in `plans/`.

## Integration Points
- **Spotify**: Frontend handles OAuth, playback, and API calls (see `src/pages/Roles/MusicHost/spotifyAuth.ts`).
- **WebSocket**: Backend and frontend communicate via WebSocket for game state and events.

## Key Files & Directories
- `frontend/src/pages/Roles/MusicHost/`: Spotify integration
- `backend/index.js`: Main server entry
- `plans/`: Planning docs for all features/fixes
- `agents.md`: Coding agent guidelines

## CI/CD
- GitHub Actions workflows in `.github/workflows/` (not detailed here)

## Example Workflow
1. Create a plan in `plans/`.
2. Branch from `main` using correct naming.
3. Implement feature/fix with TDD.
4. Run all tests and format code.
5. Commit using conventional format.
6. Open PR, ensure all tests pass.

---
For more details, see `agents.md` and `README.md`. Update this file as project conventions evolve.
