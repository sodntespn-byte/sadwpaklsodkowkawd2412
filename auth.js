/**
 * Liberty — Autenticação (token HMAC) — ESM
 * Compatível com routes/api.js (SESSION_SECRET). Uso: Authorization: Bearer <token> ou cookie liberty_token.
 */

import crypto from 'crypto';

const SESSION_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'liberty-default-change-in-production';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

if (!process.env.JWT_SECRET && !process.env.SESSION_SECRET && process.env.NODE_ENV === 'production') {
  console.warn('[AUTH] JWT_SECRET/SESSION_SECRET não definido; usando fallback. Defina em produção.');
}

function createToken(userId) {
  const payload = JSON.stringify({ userId, exp: Date.now() + SESSION_MAX_AGE_MS });
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return Buffer.from(payload).toString('base64url') + '.' + sig;
}

export function sign(user) {
  const userId = user && (user.id ?? user.userId);
  if (!userId) throw new Error('user.id required');
  return createToken(userId);
}

export function verify(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    const sig = crypto.createHmac('sha256', SESSION_SECRET).update(parts[0]).digest('hex');
    if (sig !== parts[1] || payload.exp < Date.now()) return null;
    return payload.userId ? { sub: payload.userId } : null;
  } catch {
    return null;
  }
}

export function middleware(req, res, next) {
  const header = req.headers.authorization;
  const bearerToken = header && header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  const xToken = (req.headers['x-auth-token'] || req.headers['X-Auth-Token'] || '').trim() || null;
  const cookieToken = req.cookies?.liberty_token || null;
  const bodyToken = (req.body && (req.body.token || req.body.access_token)) ? String(req.body.token || req.body.access_token).trim() : null;
  const queryToken = (req.query && (req.query.token || req.query.access_token)) ? String(req.query.token || req.query.access_token).trim() : null;
  const token = cookieToken || bearerToken || xToken || bodyToken || queryToken;
  const payload = token ? verify(token) : null;
  req.userId = payload ? payload.sub : null;
  if (process.env.NODE_ENV !== 'production' && token && (req.path === '/api/messages' || req.path.includes('/api/v1/'))) {
    if (payload) {
      console.log('[AUTH] Token aceito — userId:', req.userId);
    } else {
      console.log('[AUTH] Token rejeitado (inválido ou expirado) — verifique SESSION_SECRET/JWT_SECRET');
    }
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.userId) {
    console.log('[AUTH] 401 Não autorizado —', req.method, req.path, '| token ausente ou inválido');
    return res.status(401).json({ message: 'Não autorizado' });
  }
  next();
}
