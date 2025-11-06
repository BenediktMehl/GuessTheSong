// Configuration for different environments
const config = {
  development: {
    wsUrl: 'ws://localhost:8080',
  },
  production: {
    wsUrl: 'wss://guess-the-song.duckdns.org:8080',
  },
};

const BACKEND_TOGGLE_KEY = 'dev-backend-toggle';

// Detect environment based on import.meta.env.MODE or hostname
const getEnvironment = (): 'development' | 'production' => {
  if (import.meta.env.DEV) {
    return 'development';
  }
  return 'production';
};

const normaliseToSecure = (url: string): string => {
  if (typeof window === 'undefined') {
    return url;
  }

  // When the frontend runs over HTTPS the websocket must be secure as well.
  if (window.location.protocol === 'https:' && url.startsWith('ws://')) {
    return url.replace('ws://', 'wss://');
  }

  return url;
};

const getWsUrl = (): string => {
  const envUrl = import.meta.env.VITE_WS_URL as string | undefined;
  if (envUrl) {
    return normaliseToSecure(envUrl);
  }

  const env = getEnvironment();

  // In dev mode, check if user wants to use local or pi backend
  if (env === 'development') {
    const useLocal = localStorage.getItem(BACKEND_TOGGLE_KEY) === 'local';
    return normaliseToSecure(useLocal ? config.development.wsUrl : config.production.wsUrl);
  }

  return normaliseToSecure(config[env].wsUrl);
};

export const WS_URL = getWsUrl();

// Derive HTTP/HTTPS URL from WebSocket URL
const getBackendHttpUrl = (): string => {
  const wsUrl = getWsUrl();
  // Convert ws:// to http:// and wss:// to https://
  if (wsUrl.startsWith('wss://')) {
    return wsUrl.replace('wss://', 'https://');
  }
  if (wsUrl.startsWith('ws://')) {
    return wsUrl.replace('ws://', 'http://');
  }
  // Fallback if URL doesn't match expected pattern
  return wsUrl;
};

export const BACKEND_HTTP_URL = getBackendHttpUrl();
