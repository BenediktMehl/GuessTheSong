// Log levels in order of severity
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Determine log level from environment
// VITE_LOG_LEVEL env var takes precedence, otherwise default based on environment
const getLogLevel = (): LogLevel => {
  const envLogLevel = import.meta.env.VITE_LOG_LEVEL;
  if (envLogLevel && ['debug', 'info', 'warn', 'error'].includes(envLogLevel)) {
    return envLogLevel as LogLevel;
  }
  // Production defaults to 'warn' (only warnings and errors)
  // Development defaults to 'debug' (all logs)
  return import.meta.env.DEV ? 'debug' : 'warn';
};

const currentLogLevel = getLogLevel();
const currentLevelValue = LOG_LEVELS[currentLogLevel];

// Check if a log level should be displayed
const shouldLog = (level: LogLevel): boolean => {
  return LOG_LEVELS[level] >= currentLevelValue;
};

// Format log message with level prefix
const formatMessage = (level: LogLevel, ...args: unknown[]): unknown[] => {
  return [`[${level.toUpperCase()}]`, ...args];
};

// Logger interface matching console API
interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

// Create logger object
const logger: Logger = {
  debug: (...args: unknown[]) => {
    if (shouldLog('debug')) {
      console.debug(...formatMessage('debug', ...args));
    }
  },
  info: (...args: unknown[]) => {
    if (shouldLog('info')) {
      console.info(...formatMessage('info', ...args));
    }
  },
  warn: (...args: unknown[]) => {
    if (shouldLog('warn')) {
      console.warn(...formatMessage('warn', ...args));
    }
  },
  error: (...args: unknown[]) => {
    if (shouldLog('error')) {
      console.error(...formatMessage('error', ...args));
    }
  },
};

export default logger;
