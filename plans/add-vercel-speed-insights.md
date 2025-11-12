---
name: Add Vercel Speed Insights
type: feat
state: todo
version: 1
---

## Goal

Integrate Vercel Speed Insights into the frontend to collect web vitals and performance metrics for the deployed PWA at www.guess-my-song.de.

## Tasks

Add the official `@vercel/speed-insights` package and wire the React component so the tracking script is injected on production builds. Ensure no runtime or type errors and document how to verify in Vercel.

### 1. Add dependency
- Install `@vercel/speed-insights` in the `frontend/` package
- Commit updated `package.json` and lockfile

### 2. Wire component
- Import `{ SpeedInsights }` from `@vercel/speed-insights/react`
- Render `<SpeedInsights />` once in `frontend/src/main.tsx` inside `<StrictMode>` but outside feature components

### 3. Validate locally
- Type-check: `npx tsc --noEmit --project frontend/tsconfig.app.json`
- Run tests: `cd frontend && npm test -- --run` (happy-dom/jsdom)
- Lint: `cd frontend && npm run check` (note: existing Tailwind conflict must be resolved separately)

## Steps

- [x] Install `@vercel/speed-insights` in `frontend/`
- [x] Import and add `<SpeedInsights />` in `frontend/src/main.tsx`
- [x] Run typecheck and tests locally
- [x] Run Biome check (expect failure until Tailwind conflict is resolved)
- [ ] Deploy to Vercel and confirm `/_vercel/speed-insights/script.js` is present and data appears in Speed Insights dashboard

## Review Feedback Addressed

1. Component placement: Kept `<SpeedInsights />` at the root render so it runs across all routes and layouts.
2. Framework import: Used `@vercel/speed-insights/react` as recommended for React/Vite apps (not the Next.js import).

## Notes

- Speed Insights does not collect data in development mode; verify on a Vercel deployment.
- Ensure Speed Insights is enabled in the Vercel dashboard for the project; new `/_vercel/speed-insights/*` routes appear after deployment.
- This change is isolated and safe; no public API behavior changes.
- Follow-up: resolve `frontend/tailwind.config.ts` merge conflicts to get Biome green again.
