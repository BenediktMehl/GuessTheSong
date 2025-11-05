import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        extreme: '0 40px 80px -12px rgba(0, 0, 0, 0.35)',
      },
    },
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: ['light'],
    darkTheme: 'light',
    base: true,
    styled: true,
    utils: true,
    logs: false,
  },
};

export default config;
