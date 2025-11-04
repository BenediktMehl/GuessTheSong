import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const frontendDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(frontendDir, '..');
const appConfigAlias = resolve(repoRoot, 'app-config/index.mjs');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@app-config': appConfigAlias,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
  },
});
