/**
 * Sanitização e validação centralizada — NUNCA confiar em dados do cliente.
 * User/servidor/canal são sempre identificados por JWT (req.userId) e UUIDs validados.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Máximos permitidos (alinhados ao schema e proteção contra DoS) */
const LIMITS = {
  MESSAGE_CONTENT: 64 * 1024,
  SERVER_NAME: 100,
  CHANNEL_NAME: 100,
  USERNAME: 100,
  BAN_REASON: 500,
  DESCRIPTION: 1000,
  STATUS_TEXT: 128,
};

/**
 * Valida UUID. Retorna true se string não vazia e formato UUID.
 */
function isUuid(s) {
  return typeof s === 'string' && UUID_REGEX.test(String(s).trim());
}

/**
 * Sanitiza conteúdo de mensagem para armazenamento: remove caracteres de controlo, trim, limita tamanho.
 * O autor da mensagem é SEMPRE definido no servidor a partir de req.userId — nunca do body.
 * Escape HTML é feito no frontend ao renderizar (evita XSS).
 */
function sanitizeMessageContent(str) {
  if (str == null) return '';
  let s = String(str)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
    .trim();
  if (s.length > LIMITS.MESSAGE_CONTENT) s = s.slice(0, LIMITS.MESSAGE_CONTENT);
  return s;
}

/**
 * Escape completo para HTML (evita XSS em qualquer output).
 */
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Nome seguro para servidor/canal: apenas letras, números, espaços, hífen, underscore. Max length.
 */
function sanitizeName(str, maxLen = LIMITS.SERVER_NAME) {
  if (str == null) return '';
  let s = String(str)
    .replace(/[\x00-\x1f\x7f]/g, '')
    .trim();
  s = s.replace(/[^\p{L}\p{N}\s\-_]/gu, '').replace(/\s+/g, ' ');
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s.trim() || '';
}

/**
 * Nome de canal: normalizado para slug (lowercase, espaços → hífen), sem HTML.
 */
function sanitizeChannelName(str) {
  if (str == null) return '';
  let s = String(str)
    .replace(/[\x00-\x1f\x7f<>'"&]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .replace(/[^a-z0-9\-_]/g, '');
  return s.slice(0, LIMITS.CHANNEL_NAME) || '';
}

/**
 * Motivo de ban: texto simples, sem HTML, limitado.
 */
function sanitizeReason(str) {
  if (str == null) return '';
  let s = String(str)
    .replace(/[\x00-\x1f\x7f<>]/g, '')
    .trim();
  return s.slice(0, LIMITS.BAN_REASON);
}

/**
 * Username para login/register/busca: trim, sem control chars, max length.
 */
function sanitizeUsername(str) {
  if (str == null) return '';
  let s = String(str)
    .replace(/[\x00-\x1f\x7f]/g, '')
    .trim();
  return s.slice(0, LIMITS.USERNAME);
}

/**
 * Descrição (perfil, etc.): texto simples, limitado.
 */
function sanitizeDescription(str) {
  if (str == null) return '';
  let s = String(str)
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
    .trim();
  return s.slice(0, LIMITS.DESCRIPTION);
}

/**
 * Status de chamada: apenas valores permitidos.
 */
function sanitizeCallStatus(str) {
  const allowed = ['ringing', 'active', 'ended', 'rejected', 'missed'];
  if (str == null || !allowed.includes(String(str).toLowerCase())) return null;
  return String(str).toLowerCase();
}

/**
 * Role de membro: apenas valores permitidos.
 */
function sanitizeRole(str) {
  const allowed = ['member', 'moderator', 'admin'];
  if (str == null || !allowed.includes(String(str).toLowerCase())) return null;
  return String(str).toLowerCase();
}

/**
 * Middleware: valida que os parâmetros indicados são UUIDs. Retorna 400 se algum for inválido.
 * Uso: requireUuidParams(['serverId', 'channelId'])(req, res, next)
 */
function requireUuidParams(paramNames) {
  return (req, res, next) => {
    for (const name of paramNames) {
      const v = req.params[name];
      if (v !== undefined && v !== '' && !isUuid(v)) {
        return res.status(400).json({ message: `Parâmetro inválido: ${name} deve ser um UUID` });
      }
    }
    next();
  };
}

export {
  isUuid,
  sanitizeMessageContent,
  escapeHtml,
  sanitizeName,
  sanitizeChannelName,
  sanitizeReason,
  sanitizeUsername,
  sanitizeDescription,
  sanitizeCallStatus,
  sanitizeRole,
  requireUuidParams,
  LIMITS,
};
