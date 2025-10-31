// Configuration for different environments
const config = {
  development: {
    wsUrl: 'ws://localhost:8080'
  },
  production: {
    wsUrl: 'ws://guess-the-song.duckdns.org:8080'
  }
};

const BACKEND_TOGGLE_KEY = 'dev-backend-toggle';

// Detect environment based on import.meta.env.MODE or hostname
const getEnvironment = (): 'development' | 'production' => {
  if (import.meta.env.DEV) {
    return 'development';
  }
  return 'production';
};

const getWsUrl = (): string => {
  const env = getEnvironment();
  
  // In dev mode, check if user wants to use local or pi backend
  if (env === 'development') {
    const useLocal = localStorage.getItem(BACKEND_TOGGLE_KEY) === 'local';
    return useLocal ? config.development.wsUrl : config.production.wsUrl;
  }
  
  return config[env].wsUrl;
};

export const WS_URL = getWsUrl();
