# App Configuration

Edit `base.json` to rebrand the experience. The file ships with the "Guess The Song" defaults but can be changed to any product name that fits your deployment. The runtime config (`index.js`) derives additional helpers such as `slug`, `camelCaseId`, and `shortName` so the rest of the codebase can consume consistent naming formats.

## Fields

- `displayName` – Human-friendly name shown in headings and marketing copy. Falls back to a title-cased version of `slug` if omitted.
- `shortName` – Compact variant with limited characters (used by PWAs); defaults to `displayName` without spaces.
- `slug` – URL/identifier-friendly string. If not provided it is generated from `displayName`.
- `description` – Short description for manifests and metadata.

Derived fields are documented via TypeScript definitions in `index.d.ts` and include `camelCaseId`, `pascalCaseId`, `compactName`, and `uppercaseSlug`.

CommonJS consumers should import `index.cjs`, while ESM/Vite builds use `index.mjs`; `index.js` re-exports the CommonJS variant for convenience.

After updating `base.json`, rerun the frontend and backend to pick up the new values. There is no additional build step required.
