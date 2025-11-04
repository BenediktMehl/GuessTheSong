---
name: Flexible App Naming
type: refactor
state: todo
version: v1
---

## Goal

Enable renaming the product (e.g. "GuessTheSong") by editing a single source-of-truth file that defines the display label and any derived variants (slug, camelCase, etc.), ensuring both frontend and backend (plus configs/docs) reflect the chosen name.

## Tasks

Define a cohesive approach to centralise app naming, update all code paths to use the new source, and prevent regressions when the name changes.

### 1. Audit existing references
- Use search to catalogue every occurrence of "GuessTheSong", "Guess the song", and "guess-the-song" (including case variants) across frontend, backend, docs, package metadata, and CI files.
- Categorise each reference: display string, identifier (camelCase/PascalCase), slug/URL, environment variable, or third-party requirement.
- Note any strings that must remain unchanged (e.g. domain names) to avoid accidental regressions.

### 2. Design the naming config
- Decide on a canonical config location (e.g. `app.config.ts` or `app-config.json`) at repo root to share between packages.
- Define required fields (displayName, shortName, slug, camelCaseId) and derive secondary forms where feasible to reduce manual duplication.
- Document expectations (naming constraints, localisation support if future-proofing) within the config file comments or adjacent README.

### 3. Wire up backend usage
- Replace hard-coded names in backend source, package metadata, and documentation with imports from the new config (using shared module or build-time JSON import).
- Ensure runtime availability by adjusting bundling/tsconfig or adding a small helper module for CommonJS compatibility.
- Update tests to reflect dynamic naming where assertions currently use fixed strings.

### 4. Wire up frontend usage
- Replace hard-coded names in React components, titles, manifest metadata, and environment-dependent files with the config values (consider providing a small utility module consumed by Vite and React code).
- Adjust PWA files (`manifest`, `index.html`, `vite` config) to use the centralised values during build time (via Vite define plugin or import).
- Update styles/assets references if they encode the slug (e.g. CSS classes, filenames) and ensure fallback for existing favicons if renaming affects them.

### 5. Update documentation & tooling
- Add instructions to `README.md` and `SETUP.md` (or new `docs/`) describing how to rename via the config file.
- Ensure CI scripts, deployment configs, and domain URLs continue to function (keep explicit domain references when required, separating branding vs infrastructure).
- Consider adding a simple validation script/test that fails if "GuessTheSong" appears outside allowed exceptions, to enforce future consistency.

## Steps

- [ ] Complete Task 1: Audit existing references
- [ ] Complete Task 2: Design the naming config
- [ ] Complete Task 3: Wire up backend usage
- [ ] Complete Task 4: Wire up frontend usage
- [ ] Complete Task 5: Update documentation & tooling

## Review Feedback Addressed

1. **<Location/Topic>**: Description of feedback and how it was addressed
2. **<Location/Topic>**: Description of feedback and how it was addressed

## Notes

- Treat domain names or Spotify app IDs as immutable unless confirmed otherwise; only branding strings should move to the central config.
- Consider future localisation: make config structure extensible (e.g. per-locale display names) even if not implemented now.
- Verification: run both frontend/backend builds after renaming to confirm the new branding propagates without breaking deployments or tests.
