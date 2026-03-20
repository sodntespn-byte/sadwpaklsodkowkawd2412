/**
 * Logger seguro: nunca registra PII, tokens, senhas ou credenciais.
 * Use em todo o backend no lugar de console.log/error/warn para erros e eventos.
 */

const SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'current_password',
  'new_password',
  'token',
  'access_token',
  'refresh_token',
  'authorization',
  'cookie',
  'x-auth-token',
  'secret',
  'api_key',
  'apikey',
  'apiKey',
]);

function redact(obj) {
  if (obj == null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redact);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const keyLower = k.toLowerCase();
    const isSensitive =
      SENSITIVE_KEYS.has(k) ||
      SENSITIVE_KEYS.has(keyLower) ||
      keyLower.includes('password') ||
      keyLower.includes('token') ||
      keyLower.includes('secret');
    out[k] = isSensitive ? '[REDACTED]' : redact(v);
  }
  return out;
}

/** Apenas mensagem de erro; nunca stack nem objeto completo em produção para evitar vazamento. */
function safeErrorMessage(err) {
  if (err == null) return '';
  if (typeof err === 'string') return err;
  if (err.message && typeof err.message === 'string') return err.message;
  return String(err);
}

export const logger = {
  info(...args) {
    const safe = args.map(a => (a && typeof a === 'object' && !(a instanceof Error) ? redact(a) : a));
    console.log(...safe);
  },
  warn(...args) {
    const safe = args.map(a => (a instanceof Error ? safeErrorMessage(a) : a && typeof a === 'object' ? redact(a) : a));
    console.warn(...safe);
  },
  error(context, errOrMessage) {
    const msg = errOrMessage instanceof Error ? safeErrorMessage(errOrMessage) : String(errOrMessage ?? '');
    console.error(`[${context}]`, msg);
  },
};

export default logger;
