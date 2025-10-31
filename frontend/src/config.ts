// Configuration for different environments
const config = {
  development: {
    wsUrl: 'ws://localhost:8080'
  },
  production: {
    wsUrl: 'wss://guess-the-song.duckdns.org:8080'
  }
};

// Detect environment based on import.meta.env.MODE or hostname
const getEnvironment = (): 'development' | 'production' => {
  if (import.meta.env.DEV) {
    return 'development';
  }
  return 'production';
};

export const WS_URL = config[getEnvironment()].wsUrl;
