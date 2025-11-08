const pino = require('pino');

// Determine log level from environment
// LOG_LEVEL env var takes precedence, otherwise default based on NODE_ENV
const getLogLevel = () => {
  if (process.env.LOG_LEVEL) {
    return process.env.LOG_LEVEL;
  }
  // Production defaults to 'warn' (only warnings and errors)
  // Development defaults to 'debug' (all logs)
  return process.env.NODE_ENV === 'production' ? 'warn' : 'debug';
};

// Configure Pino logger
// In development, use pretty printing for human-readable output
// In production, use standard JSON output for structured logging
const isDevelopment = process.env.NODE_ENV !== 'production';
const loggerConfig = {
  level: getLogLevel(),
};

// In development, use pino-pretty for readable output
if (isDevelopment) {
  require('pino-pretty');
  loggerConfig.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
    },
  };
}

// Create and export logger instance
const logger = pino(loggerConfig);

module.exports = logger;
