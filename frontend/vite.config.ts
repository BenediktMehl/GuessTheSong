import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { VitePWA } from 'vite-plugin-pwa';
import appConfig from '../app-config/index.js';

const frontendDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(frontendDir, '..');
const appConfigAlias = resolve(repoRoot, 'app-config/index.mjs');

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
    fs: {
      allow: [repoRoot],
    },
  },
  resolve: {
    alias: {
      '@app-config': appConfigAlias,
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'app-config-html-transform',
      transformIndexHtml(html) {
        return html
          .replace(/%APP_DISPLAY_NAME%/g, appConfig.displayName)
          .replace(/%APP_SHORT_NAME%/g, appConfig.shortName)
          .replace(/%APP_DESCRIPTION%/g, appConfig.description);
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: appConfig.displayName,
        short_name: appConfig.shortName,
        description: appConfig.description,
        theme_color: '#22223b',
        background_color: '#f2e9e4',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        navigationPreload: false,
      },
    }),
  ],
});
