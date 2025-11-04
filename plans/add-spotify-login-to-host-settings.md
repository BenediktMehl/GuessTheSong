# Plan: Add Spotify Login to Host Settings

## Goal
Enable the game host to log into Spotify directly from the Host Settings page, allowing them to access Spotify features without switching roles or pages.

## Motivation
Currently, only the Music Host role has Spotify login. Hosts need a seamless way to authenticate with Spotify from the settings UI, improving usability and reducing friction.

## Tasks & Steps

- [ ] Analyze current Host Settings UI and Spotify OAuth integration
- [ ] Design and add a Spotify login button to Host Settings (frontend/src/pages/Roles/GameHost/Settings.tsx)
- [ ] Connect the button to the existing Spotify OAuth flow (frontend/src/pages/Roles/MusicHost/spotifyAuth.ts)
- [ ] Ensure login state is reflected in the UI (show logged-in status, error handling)
- [ ] Test the login flow end-to-end
- [ ] Update documentation (README, UI help text)

## Acceptance Criteria
- Host Settings page displays a Spotify login button
- Clicking the button initiates the Spotify OAuth flow
- Successful login updates UI to show host is authenticated
- No regression in Music Host Spotify login
- Documentation is updated

## Resources
- `frontend/src/pages/Roles/GameHost/Settings.tsx`
- `frontend/src/pages/Roles/MusicHost/spotifyAuth.ts`
- Spotify API docs
- Project README
