const PORT = Number.parseInt(process.env.PORT ?? '8080', 10);
const HOST = process.env.HOST ?? '0.0.0.0';
const USE_TLS = process.env.WS_USE_TLS === 'true';
const TLS_CERT_PATH = process.env.WS_TLS_CERT_PATH;
const TLS_KEY_PATH = process.env.WS_TLS_KEY_PATH;

const ALLOWED_ORIGINS = (process.env.WS_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

module.exports = {
  PORT,
  HOST,
  USE_TLS,
  TLS_CERT_PATH,
  TLS_KEY_PATH,
  ALLOWED_ORIGINS,
};
