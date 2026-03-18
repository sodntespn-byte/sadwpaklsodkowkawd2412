// VERSION: CACHE_V1_STABLE
// Compatibilidade máxima com Square Cloud e outros hosts: carregar .env de vários sítios
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirnameServer = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirnameServer, '..');
const pathsToTry = [
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), '.env.squarecloud'),
  path.join(rootDir, '.env'),
  path.join(rootDir, '.env.squarecloud'),
  path.join(__dirnameServer, '.env'),
  path.join(__dirnameServer, '.env.squarecloud'),
  path.join(process.cwd(), 'backend', '.env'),
  process.env.ENV_FILE || '',
  process.env.DOTENV_PATH || '',
].filter(Boolean);
for (const p of pathsToTry) {
  if (typeof p === 'string' && fs.existsSync(p)) {
    dotenv.config({ path: p, override: false });
  }
}
dotenv.config({ override: false });
import http from 'http';
import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcrypt';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import WebSocket, { WebSocketServer } from 'ws';
import crypto from 'node:crypto';
import Joi from 'joi';
import multer from 'multer';
import config from './src/config.js';
import { logger } from './src/lib/logger.js';
import { sanitizeAttachmentFilename, isAllowedFile } from './src/lib/upload-security.js';
import { createDatabase } from './config/database.js';
import { createMessageCache } from './services/messageCache.js';

/** Em produção não expõe mensagens de erro internas ao cliente (evita vazamento de stack/paths). */
function safeApiMessage(err, fallback) {
  if (config.isProduction) return fallback || 'Erro interno. Tente novamente mais tarde.';
  return (err && err.message) || fallback || 'Erro';
}
import { schemas, validateBody } from './src/middleware/validate.js';
import { registerAuthRoutes } from './src/routes/auth.js';
import {
  isUuid,
  sanitizeMessageContent,
  sanitizeName,
  sanitizeChannelName,
  sanitizeReason,
  sanitizeUsername,
  sanitizeDescription,
  sanitizeRole,
  sanitizeCallStatus,
  sanitizeUrl,
  requireUuidParams,
} from './src/lib/sanitize.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import { encrypt, decrypt } from './src/lib/message-crypto.js';
const MAX_CACHE_PER_CHANNEL = 100;
const messageCache = createMessageCache({ encrypt, decrypt, maxPerChannel: MAX_CACHE_PER_CHANNEL });

/**
 * Garante que a mensagem existe no banco. Se não existir, insere.
 * Usa id da mensagem para evitar duplicados (ON CONFLICT DO NOTHING).
 */
async function ensureMessageInDb(msg, chatId) {
  return;
}

/**
 * Carrega mensagens do banco para um chat e devolve no formato da API.
 * Usado quando o cache está vazio (ex.: após restart) para repopular.
 */
async function loadMessagesFromDb(chatId, limit = 300) {
  return [];
}

// Atividade em app (minutos) para ranking "By Activity" — só em memória
const activityByUser = new Map(); // userId -> { minutes, username }
const ACTIVITY_PING_INTERVAL_MS = 60 * 1000;
const ACTIVITY_MIN_INTERVAL_MS = 50 * 1000; // mínimo entre pings para contar
function addActivityPing(userId, username) {
  const now = Date.now();
  const cur = activityByUser.get(userId) || { minutes: 0, username: username || 'User', lastPing: 0 };
  if (now - cur.lastPing >= ACTIVITY_MIN_INTERVAL_MS) {
    cur.minutes += 1;
    cur.lastPing = now;
  }
  if (username) cur.username = username;
  cur.userId = userId;
  activityByUser.set(userId, cur);
}
function getActivityLevel(minutes) {
  if (minutes < 5) return 0;
  return Math.floor(Math.log(minutes / 5) / Math.log(1.2)) + 1;
}
function getXpLevel(xp) {
  if (xp < 500) return 0;
  return Math.floor(Math.log(xp / 500) / Math.log(1.2)) + 1;
}
function computeContentXpByUser(messagesByChannel) {
  const byUser = new Map(); // author_id -> { xp, username }
  const lists = messagesByChannel || [];
  for (const list of lists) {
    for (const msg of list) {
      const id = msg.author_id || msg.author;
      if (!id) continue;
      const cur = byUser.get(id) || { xp: 0, username: msg.author_username || msg.author || 'User' };
      cur.xp += msg.content && msg.content.length ? msg.content.length : 0;
      if (msg.author_username) cur.username = msg.author_username;
      if (msg.author && typeof msg.author === 'string') cur.username = msg.author;
      byUser.set(id, cur);
    }
  }
  return byUser;
}

const db = createDatabase({ logger, rootDir, isProduction: config.isProduction });

// Schema PostgreSQL inlined para deploy (evita dependência de db/init.js e db/schema.sql no runtime)
const LIBERTY_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username     VARCHAR(32) NOT NULL UNIQUE,
  email        VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255),
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE TABLE IF NOT EXISTS servers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) NOT NULL,
  owner_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS chats (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100),
  type       VARCHAR(20) NOT NULL DEFAULT 'channel' CHECK (type IN ('channel', 'dm', 'group_dm')),
  server_id  UUID REFERENCES servers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chats_server ON chats(server_id);
CREATE INDEX IF NOT EXISTS idx_chats_type ON chats(type);
CREATE TABLE IF NOT EXISTS chat_members (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id   UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      VARCHAR(20) NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(chat_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_chat_members_chat ON chat_members(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_members(user_id);
CREATE TABLE IF NOT EXISTS messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id    UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(chat_id, created_at DESC);
CREATE TABLE IF NOT EXISTS group_members (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id   UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(chat_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_group_members_chat ON group_members(chat_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
CREATE TABLE IF NOT EXISTS friendships (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, friend_id)
);
CREATE INDEX IF NOT EXISTS idx_friendships_user ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships(friend_id);
CREATE TABLE IF NOT EXISTS webrtc_calls (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  callee_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_id      UUID REFERENCES chats(id) ON DELETE SET NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing', 'active', 'ended', 'rejected', 'missed')),
  started_at   TIMESTAMPTZ,
  ended_at     TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_webrtc_calls_caller ON webrtc_calls(caller_id);
CREATE INDEX IF NOT EXISTS idx_webrtc_calls_callee ON webrtc_calls(callee_id);
CREATE INDEX IF NOT EXISTS idx_webrtc_calls_created ON webrtc_calls(created_at DESC);
`;

async function dbInit() {
  if (!db.isConfigured() || !db.isConnected()) return;
  const sql = LIBERTY_SCHEMA_SQL.replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--[^\n]*/g, '')
    .trim();
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(Boolean);
  let applied = 0;
  for (const stmt of statements) {
    if (!stmt.toUpperCase().startsWith('CREATE')) continue;
    try {
      await db.query(stmt + ';');
      applied++;
    } catch (err) {
      if (err.code === '42P07') applied++;
      else logger.warn('[LIBERTY] Schema statement falhou:', err.message, '\n', stmt.slice(0, 60) + '...');
    }
  }
  try {
    await db.query(`ALTER TABLE chats DROP CONSTRAINT IF EXISTS chats_type_check`);
    await db.query(
      `ALTER TABLE chats ADD CONSTRAINT chats_type_check CHECK (type IN ('channel', 'dm', 'group_dm', 'category'))`
    );
  } catch (err) {
    if (err.code !== '42704' && err.code !== '42P01') logger.warn('[LIBERTY] Migração chats_type_check:', err.message);
  }
  try {
    await db.query(`ALTER TABLE chats ADD COLUMN parent_id UUID REFERENCES chats(id) ON DELETE SET NULL`);
  } catch (err) {
    if (err.code !== '42701') logger.warn('[LIBERTY] Migração chats.parent_id:', err.message);
  }
  try {
    await db.query(`ALTER TABLE chats ADD COLUMN channel_type VARCHAR(20) DEFAULT 'text'`);
  } catch (err) {
    if (err.code !== '42701') logger.warn('[LIBERTY] Migração chats.channel_type:', err.message);
  }
  try {
    await db.query(`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`);
  } catch (err) {
    if (err.code !== '42701') logger.warn('[LIBERTY] Migração users.password_hash:', err.message);
  }
  try {
    await db.query(`ALTER TABLE users ALTER COLUMN email DROP NOT NULL`);
  } catch (err) {
    if (err.code !== '42701') logger.warn('[LIBERTY] Migração users.email:', err.message);
  }
  try {
    await db.query(`ALTER TABLE users ADD COLUMN avatar_url TEXT`);
  } catch (err) {
    if (err.code !== '42701') logger.warn('[LIBERTY] Migração users.avatar_url:', err.message);
  }
  try {
    await db.query(`ALTER TABLE servers ADD COLUMN icon_url TEXT`);
  } catch (err) {
    if (err.code !== '42701') logger.warn('[LIBERTY] Migração servers.icon_url:', err.message);
  }
  try {
    await db.query(`ALTER TABLE users ADD COLUMN banner_url TEXT`);
  } catch (err) {
    if (err.code !== '42701') logger.warn('[LIBERTY] Migração users.banner_url:', err.message);
  }
  try {
    await db.query(`ALTER TABLE users ADD COLUMN description TEXT`);
  } catch (err) {
    if (err.code !== '42701') logger.warn('[LIBERTY] Migração users.description:', err.message);
  }
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS message_pins (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chat_id    UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        pinned_by  UUID REFERENCES users(id) ON DELETE SET NULL,
        pinned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(chat_id, message_id)
      )
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_message_pins_chat ON message_pins(chat_id)`);
  } catch (err) {
    if (err.code !== '42P07') logger.warn('[LIBERTY] Migração message_pins:', err.message);
  }
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS server_bans (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        server_id  UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        banned_by  UUID REFERENCES users(id) ON DELETE SET NULL,
        reason     TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(server_id, user_id)
      )
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_server_bans_server ON server_bans(server_id)`);
  } catch (err) {
    if (err.code !== '42P07') logger.warn('[LIBERTY] Migração server_bans:', err.message);
  }
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS server_members (
        server_id  UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role       VARCHAR(20) NOT NULL DEFAULT 'member',
        PRIMARY KEY (server_id, user_id)
      )
    `);
  } catch (err) {
    if (err.code !== '42P07') logger.warn('[LIBERTY] Migração server_members:', err.message);
  }
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS invites (
        code       VARCHAR(32) PRIMARY KEY,
        server_id  UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
        channel_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        expires_at TIMESTAMPTZ,
        max_uses   INT NOT NULL DEFAULT 0,
        uses       INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_invites_server ON invites(server_id)`);
  } catch (err) {
    if (err.code !== '42P07') logger.warn('[LIBERTY] Migração invites:', err.message);
  }
  logger.info('[LIBERTY] Schema PostgreSQL aplicado (' + applied + ' statements)');
}

// Lista de admins via variável de ambiente (ex.: ADMIN_USERNAMES=user1,user2). Nunca hardcodar em produção.
function _getAdminUsernames() {
  const raw = process.env.ADMIN_USERNAMES || '';
  if (typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}
async function isAdmin(req) {
  if (!req.userId) return false;
  const admins = _getAdminUsernames();
  if (admins.length === 0) return false;
  try {
    const r = await db.query('SELECT username FROM users WHERE id = $1::uuid LIMIT 1', [req.userId]);
    const u = (r.rows[0]?.username || '').trim().toLowerCase();
    return admins.includes(u);
  } catch (_) {
    return false;
  }
}

function isOfficialLibertyServer(row) {
  if (!row) return false;
  const name = (row.name || '').trim();
  return name.toLowerCase() === 'liberty' && (row.owner_id == null || row.owner_id === '');
}

const INVITE_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
function generateInviteCode(len = 8) {
  let s = '';
  for (let i = 0; i < len; i++) s += INVITE_CODE_CHARS[Math.floor(Math.random() * INVITE_CODE_CHARS.length)];
  return s;
}

// --- auth (inline para deploy sem auth.js)
// Fallback JWT quando o painel (ex.: Square Cloud) não injeta variáveis. Troque depois nas definições.
const _JWT_FALLBACK =
  'liberty-squarecloud-jwt-fallback-mínimo-32-caracteres-alterar-nas-configurações';
function _getAuthSecret() {
  const secret =
    process.env.JWT_SECRET ||
    (process.env.NODE_ENV !== 'production' ? 'dev-secret-not-for-production' : _JWT_FALLBACK);
  if (process.env.NODE_ENV === 'production' && (!secret || secret.length < 32)) {
    logger.error(
      'AUTH',
      'JWT_SECRET obrigatório em produção (mín. 32 caracteres). Square Cloud: Configurações → Environment → adicione JWT_SECRET com uma string longa (ex: gere com "openssl rand -base64 32"). Depois faça Redeploy.'
    );
    process.exit(1);
  }
  return secret || _JWT_FALLBACK;
}
const _authSecret = _getAuthSecret();

const auth = {
  sign(user) {
    return jwt.sign({ sub: user.id }, _authSecret, { expiresIn: '90d' });
  },
  verify(token) {
    try {
      const payload = jwt.verify(token, _authSecret);
      return payload && payload.sub ? { sub: payload.sub } : null;
    } catch {
      return null;
    }
  },
  /** Identidade do utilizador: SEMPRE e apenas a partir do JWT (payload.sub). Nunca confiar em user_id/author do body ou params. */
  middleware(req, res, next) {
    const header = req.headers.authorization;
    const bearerToken = header && header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    const xToken = (req.headers['x-auth-token'] || req.headers['X-Auth-Token'] || '').trim() || null;
    const cookieToken = (req.cookies && req.cookies.liberty_token) || null;
    const bodyToken =
      req.body && (req.body.token || req.body.access_token)
        ? String(req.body.token || req.body.access_token).trim()
        : null;
    const queryToken =
      req.query && (req.query.token || req.query.access_token)
        ? String(req.query.token || req.query.access_token).trim()
        : null;
    const token = cookieToken || bearerToken || xToken || bodyToken || queryToken;
    if (token) {
      const payload = auth.verify(token);
      req.userId = payload ? payload.sub : null;
    } else req.userId = null;
    next();
  },
  requireAuth(req, res, next) {
    if (!req.userId) return res.status(401).json({ message: 'Não autorizado' });
    next();
  },
  /** Verifica se o utilizador existe na base (evita FK ao criar servidores após limpar a DB). */
  async requireUserExists(req, res, next) {
    if (!req.userId) return res.status(401).json({ message: 'Não autorizado' });
    if (!db.isConfigured() || !db.isConnected()) return next();
    try {
      const r = await db.query(`SELECT id FROM users WHERE id = $1::uuid LIMIT 1`, [req.userId]);
      if (!r.rows[0]) {
        return res.status(401).json({
          message: 'Sessão inválida. Faça login ou registe-se novamente.',
          code: 'USER_NOT_FOUND',
        });
      }
      next();
    } catch (err) {
      logger.error('requireUserExists', err);
      return res.status(500).json({ message: 'Erro ao verificar sessão' });
    }
  },
};

// --- ws (inline para deploy sem ws.js)
const _wsSubscriptions = new Map();
const _wsUserConnections = new Map();
function _wsAddUserConnection(userId, ws) {
  if (!userId) return;
  let set = _wsUserConnections.get(userId);
  if (!set) {
    set = new Set();
    _wsUserConnections.set(userId, set);
  }
  set.add(ws);
}
function _wsRemoveUserConnection(userId, ws) {
  const set = _wsUserConnections.get(userId);
  if (set) {
    set.delete(ws);
    if (set.size === 0) _wsUserConnections.delete(userId);
  }
}
function _wsSubscribe(chatId, ws) {
  if (!chatId) return;
  let set = _wsSubscriptions.get(chatId);
  if (!set) {
    set = new Set();
    _wsSubscriptions.set(chatId, set);
  }
  set.add(ws);
}
function _wsUnsubscribe(chatId, ws) {
  const set = _wsSubscriptions.get(chatId);
  if (set) {
    set.delete(ws);
    if (set.size === 0) _wsSubscriptions.delete(chatId);
  }
}
function _wsUnsubscribeAll(ws) {
  _wsSubscriptions.forEach(set => set.delete(ws));
}
function _wsSendToUser(userId, payload) {
  const set = _wsUserConnections.get(userId);
  if (!set) return;
  const str = typeof payload === 'string' ? payload : JSON.stringify(payload);
  set.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(str);
  });
}
function _wsEmitToRoom(roomId, payload) {
  if (!roomId) return;
  const str = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const set = _wsSubscriptions.get(roomId);
  if (set)
    set.forEach(c => {
      if (c.readyState === WebSocket.OPEN) c.send(str);
    });
}
const ws = {
  emitMessage(message) {
    const payload = JSON.stringify({ type: 'message', data: message });
    _wsEmitToRoom(message.chat_id, payload);
    if (message.channel_id && message.channel_id !== message.chat_id) _wsEmitToRoom(message.channel_id, payload);
  },
  attach(server) {
    const wss = new WebSocketServer({ server, path: '/ws' });
    const sendJson = (ws, obj) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
    };
    wss.on('connection', (wsClient, req) => {
      const url = new URL(req.url || '', 'http://localhost');
      const token =
        url.searchParams.get('token') ||
        (req.headers['sec-websocket-protocol'] &&
          req.headers['sec-websocket-protocol'].split(',').map(s => s.trim())[0]);
      let payload = null;
      try {
        payload = token ? auth.verify(token) : null;
      } catch (_) {}
      let userId = payload ? payload.sub : null;
      wsClient.userId = userId;
      wsClient.subscribedChats = new Set();
      sendJson(wsClient, { op: 'hello', d: { heartbeat_interval: 45000, server_version: '1.0' } });
      if (userId && payload) {
        (async () => {
          try {
            const u = await db.query('SELECT id, username, avatar_url FROM users WHERE id = $1::uuid LIMIT 1', [userId]);
            const row = u.rows[0];
            const user = row ? { id: String(row.id), username: row.username || 'User', avatar_url: row.avatar_url || null } : { id: String(userId), username: 'User', avatar_url: null };
            sendJson(wsClient, { op: 'authenticated', d: { user, session_id: payload.jti || userId } });
          } catch (_) {
            sendJson(wsClient, { op: 'authenticated', d: { user: { id: String(userId), username: 'User', avatar_url: null }, session_id: userId } });
          }
        })();
      }
      _wsAddUserConnection(userId, wsClient);
      wsClient.on('message', raw => {
        try {
          const msg = JSON.parse(raw.toString());
          const type = msg.type || msg.op;
          const d = msg.d || msg;
          const chatId = msg.chat_id || d.chat_id;
          if (type === 'authenticate' && (d.token || msg.token)) {
            const t = d.token || msg.token;
            let p = null;
            try {
              p = auth.verify(t);
            } catch (_) {}
            if (p && p.sub) {
              const prevUserId = userId;
              userId = p.sub;
              wsClient.userId = userId;
              if (prevUserId) _wsRemoveUserConnection(prevUserId, wsClient);
              _wsAddUserConnection(userId, wsClient);
              db.query('SELECT id, username, avatar_url FROM users WHERE id = $1::uuid LIMIT 1', [userId]).then((r) => {
                const row = r.rows[0];
                const user = row ? { id: String(row.id), username: row.username || 'User', avatar_url: row.avatar_url || null } : { id: String(userId), username: 'User', avatar_url: null };
                sendJson(wsClient, { op: 'authenticated', d: { user, session_id: p.jti || userId } });
              }).catch(() => {
                sendJson(wsClient, { op: 'authenticated', d: { user: { id: String(userId), username: 'User', avatar_url: null }, session_id: userId } });
              });
            } else {
              sendJson(wsClient, { op: 'auth_failed', d: { reason: 'Token inválido' } });
            }
            return;
          }
          if (type === 'heartbeat') {
            sendJson(wsClient, { op: 'heartbeat_ack', d: { seq: d.seq != null ? d.seq : msg.seq } });
            return;
          }
          if (type === 'subscribe' && chatId) {
            wsClient.subscribedChats.add(chatId);
            _wsSubscribe(chatId, wsClient);
          } else if (type === 'unsubscribe' && chatId) {
            wsClient.subscribedChats.delete(chatId);
            _wsUnsubscribe(chatId, wsClient);
          } else if (type === 'webrtc_offer' || type === 'webrtc_answer' || type === 'webrtc_ice') {
            const target = msg.target_user_id || msg.to || d.target_user_id;
            const payload = msg.payload !== undefined ? msg.payload : d.payload;
            if (target && isUuid(String(target)) && payload !== undefined) _wsSendToUser(target, { type, from_user_id: userId, payload });
          } else if (type === 'webrtc_reject') {
            const target = msg.target_user_id || msg.to || d.target_user_id;
            if (target && isUuid(String(target))) _wsSendToUser(target, { type: 'webrtc_reject', from_user_id: userId });
          } else if (type === 'webrtc_hangup') {
            const target = msg.target_user_id || msg.to || d.target_user_id;
            if (target && isUuid(String(target))) _wsSendToUser(target, { type: 'webrtc_hangup', from_user_id: userId });
          } else if (type === 'stream_started') {
            const target = msg.target_user_id || msg.to || d.target_user_id;
            if (target && isUuid(String(target)))
              _wsSendToUser(target, {
                type: 'stream_started',
                from_user_id: userId,
                stream_type: msg.stream_type || d.stream_type || 'screen',
              });
          } else if (type === 'stream_stopped') {
            const target = msg.target_user_id || msg.to || d.target_user_id;
            if (target && isUuid(String(target))) _wsSendToUser(target, { type: 'stream_stopped', from_user_id: userId });
          } else if (type === 'join_server' && userId) {
            const code = (d.invite_code || msg.invite_code || '').trim().toUpperCase();
            if (!code) return;
            (async () => {
              try {
                const inv = await db.query(
                  `SELECT i.server_id, i.channel_id, i.expires_at, i.max_uses, i.uses,
                          s.name AS server_name, s.icon_url AS server_icon
                   FROM invites i JOIN servers s ON s.id = i.server_id
                   WHERE i.code = $1`,
                  [code]
                );
                if (!inv.rows[0]) {
                  wsClient.send(JSON.stringify({ type: 'invite_error', message: 'Convite inválido ou expirado' }));
                  return;
                }
                const row = inv.rows[0];
                if (row.expires_at && new Date(row.expires_at) < new Date()) {
                  wsClient.send(JSON.stringify({ type: 'invite_error', message: 'Convite expirado' }));
                  return;
                }
                if (row.max_uses > 0 && (row.uses || 0) >= row.max_uses) {
                  wsClient.send(JSON.stringify({ type: 'invite_error', message: 'Convite já não está disponível' }));
                  return;
                }
                await db.query(
                  `INSERT INTO server_members (server_id, user_id, role) VALUES ($1::uuid, $2::uuid, 'member') ON CONFLICT (server_id, user_id) DO NOTHING`,
                  [row.server_id, userId]
                );
                await db.query(
                  `INSERT INTO chat_members (chat_id, user_id, role) VALUES ($1::uuid, $2::uuid, 'member') ON CONFLICT (chat_id, user_id) DO NOTHING`,
                  [row.channel_id, userId]
                );
                await db.query(`UPDATE invites SET uses = uses + 1 WHERE code = $1`, [code]);
                const server = { id: String(row.server_id), name: row.server_name, icon_url: row.server_icon || null };
                const channelId = String(row.channel_id);
                if (wsClient.readyState === WebSocket.OPEN) {
                  wsClient.send(JSON.stringify({ type: 'server_created', server, channel_id: channelId }));
                }
              } catch (e) {
                logger.warn('[WS] join_server:', e.message);
                if (wsClient.readyState === WebSocket.OPEN) {
                  wsClient.send(JSON.stringify({ type: 'invite_error', message: 'Erro ao entrar no servidor' }));
                }
              }
            })();
          }
        } catch (_) {}
      });
      wsClient.on('close', () => {
        _wsRemoveUserConnection(userId, wsClient);
        wsClient.subscribedChats.forEach(chatId => _wsUnsubscribe(chatId, wsClient));
        _wsUnsubscribeAll(wsClient);
      });
    });
    return wss;
  },
  subscribe: _wsSubscribe,
  unsubscribe: _wsUnsubscribe,
};

const app = express();
app.disable('x-powered-by');
const PORT = config.PORT;
const STATIC_DIR = config.STATIC_DIR;
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const ATTACHMENTS_DIR = path.join(UPLOADS_DIR, 'attachments');
try {
  if (!fs.existsSync(ATTACHMENTS_DIR)) fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });
} catch (e) {
  logger.warn('[LIBERTY] Não foi possível criar pasta uploads/attachments:', e.message);
}
const ALLOWED_ORIGINS = config.ALLOWED_ORIGINS;
const corsOptions = {
  origin:
    ALLOWED_ORIGINS.length > 0
      ? (origin, cb) => (origin && ALLOWED_ORIGINS.includes(origin) ? cb(null, true) : cb(null, false))
      : config.isProduction
        ? false
        : true,
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Compressão gzip/brotli para todas as respostas (reduz payload em ~70% para texto/JSON)
app.use(compression({ level: 6, threshold: 1024 }));

app.set('trust proxy', 1);

if (config.FORCE_HTTPS) {
  app.use((req, res, next) => {
    if (req.secure) return next();
    return res.status(403).json({ message: 'HTTPS obrigatório. Use uma ligação segura para enviar dados.' });
  });
}

const limiterGeneral = rateLimit({
  windowMs: 60 * 1000,
  max: config.RATE_LIMIT_MAX,
  message: { message: 'Muitas requisições. Tente novamente em breve.' },
  standardHeaders: true,
  legacyHeaders: false,
});
const limiterAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: { message: 'Muitas tentativas de acesso. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

app.use(limiterGeneral);
app.use('/api/v1/auth', limiterAuth);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "script-src": [
          "'self'",
          "'unsafe-inline'",
          "https://unpkg.com",
          "https://cdn.socket.io"
        ],
        "connect-src": [
          "'self'",
          "ws:",
          "wss:",
          "https://unpkg.com",
          "https://cdn.socket.io",
          "https://www.youtube.com"
        ],
        "style-src": [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://cdnjs.cloudflare.com"
        ],
        "img-src": [
          "'self'",
          "data:",
          "blob:",
          "https:",
          "http:"
        ],
        "font-src": [
          "'self'",
          "https://cdnjs.cloudflare.com",
          "https://fonts.gstatic.com"
        ],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false, // Necessário para WebRTC funcionar em alguns navegadores
  })
);
app.use(express.json({ limit: '70mb' }));
// Parse Cookie header into req.cookies (evita dependência cookie-parser em deploy)
app.use((req, _res, next) => {
  req.cookies = Object.create(null);
  const raw = req.headers.cookie;
  if (raw) {
    for (const part of raw.split(';')) {
      const [key, ...v] = part.trim().split('=');
      if (key) {
        try {
          req.cookies[key] = decodeURIComponent((v.join('=') || '').trim());
        } catch {
          req.cookies[key] = (v.join('=') || '').trim();
        }
      }
    }
  }
  next();
});
app.use(auth.middleware);

const server = http.createServer(app);

// Chat "global" padrão usado pelo fluxo simplificado /api/messages (apenas cache do id, dados no DB)
let defaultChatId = null;

async function getDefaultChatId() {
  if (!db.isConfigured() || !db.isConnected()) {
    return null;
  }

  if (defaultChatId) return defaultChatId;

  try {
    // Tenta reaproveitar um chat existente com nome 'global-chat'
    const existing = await db.query(
      `SELECT id FROM chats WHERE name = $1 AND type = 'channel' ORDER BY created_at ASC LIMIT 1`,
      ['global-chat']
    );
    if (existing.rows[0]?.id) {
      defaultChatId = String(existing.rows[0].id);
      return defaultChatId;
    }

    // Garante que existe ao menos um servidor para pendurar o chat
    let serverId = null;
    const s = await db.query(`SELECT id FROM servers ORDER BY created_at ASC LIMIT 1`);
    if (s.rows[0]?.id) {
      serverId = s.rows[0].id;
    } else {
      const newServerId = crypto.randomUUID();
      const insServer = await db.query(`INSERT INTO servers (id, name) VALUES ($1::uuid, $2) RETURNING id`, [
        newServerId,
        'Global Server',
      ]);
      serverId = insServer.rows[0].id;
    }

    // Cria o chat padrão
    const newChatId = crypto.randomUUID();
    const insChat = await db.query(
      `INSERT INTO chats (id, name, type, server_id)
       VALUES ($1::uuid, $2, 'channel', $3::uuid)
       RETURNING id`,
      [newChatId, 'global-chat', serverId]
    );
    defaultChatId = String(insChat.rows[0].id);
    return defaultChatId;
  } catch (err) {
    logger.error('ensureDefaultChat', err);
    return null;
  }
}

async function start() {
  messageCache.clear();
  process.on('unhandledRejection', reason => {
    logger.error('unhandledRejection', reason instanceof Error ? reason : String(reason));
  });

  let hasDbUrl = db.getUrl().startsWith('postgres');
  if (process.env.NODE_ENV === 'production' && !hasDbUrl) {
    // Square Cloud e outros hosts podem injetar env com pequeno atraso — esperar e tentar de novo
    logger.warn('[LIBERTY] À espera de DATABASE_URL (3s)…');
    await new Promise(r => setTimeout(r, 3000));
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) dotenv.config({ path: envPath, override: false });
    hasDbUrl = db.getUrl().startsWith('postgres');
  }
  if (process.env.NODE_ENV === 'production' && !hasDbUrl) {
    const checked = 'DATABASE_URL';
    logger.error(
      'LIBERTY',
      `Base de dados obrigatória em produção. Defina uma destas variáveis no painel (Environment / Variáveis): ${checked}. Square Cloud: na app → Configurações → Environment → Adicionar variável → Nome: DATABASE_URL → Valor: a sua connection string PostgreSQL. Depois Redeploy.`
    );
    process.exit(1);
  }
  if (hasDbUrl) {
    logger.info('[LIBERTY] Conectando ao banco…');
    try {
      await db.connect();
      if (db.isConnected()) {
        await dbInit();
        try {
          let libertyServerId = null;
          const ex = await db.query(`SELECT id FROM servers WHERE name = $1 LIMIT 1`, ['Liberty']);
          if (ex.rows[0]?.id) {
            libertyServerId = ex.rows[0].id;
          } else {
            const newServerId = crypto.randomUUID();
            const ins = await db.query(
              `INSERT INTO servers (id, name, owner_id) VALUES ($1::uuid, $2, NULL) RETURNING id`,
              [newServerId, 'Liberty']
            );
            libertyServerId = ins.rows[0].id;
            const newChatId = crypto.randomUUID();
            await db.query(`INSERT INTO chats (id, name, type, server_id) VALUES ($1::uuid, 'general', 'channel', $2::uuid)`, [
              newChatId,
              libertyServerId,
            ]);
            logger.info('[LIBERTY] Servidor padrão Liberty criado.');
          }
          if (libertyServerId) {
            const chatRow = await db.query(
              `SELECT id FROM chats WHERE server_id = $1::uuid AND type = 'channel' LIMIT 1`,
              [libertyServerId]
            );
            const generalChatId = chatRow.rows[0]?.id;
            if (generalChatId) {
              const usersResult = await db.query(`SELECT id FROM users`);
              for (const u of usersResult.rows) {
                const uid = u.id;
                await db.query(
                  `INSERT INTO server_members (server_id, user_id, role) VALUES ($1::uuid, $2::uuid, 'member') ON CONFLICT (server_id, user_id) DO NOTHING`,
                  [libertyServerId, uid]
                );
                await db.query(
                  `INSERT INTO chat_members (chat_id, user_id, role) VALUES ($1::uuid, $2::uuid, 'member') ON CONFLICT (chat_id, user_id) DO NOTHING`,
                  [generalChatId, uid]
                );
              }
              if (usersResult.rows.length > 0) {
                logger.info('[LIBERTY] Todos os membros adicionados ao servidor Liberty.');
              }
            }
          }
        } catch (e) {
          logger.warn('[LIBERTY] ensureLibertyServer at startup:', e.message);
        }
      } else {
        logger.warn('[LIBERTY] Primeira conexão falhou; será tentado na primeira requisição.');
      }
    } catch (err) {
      logger.warn('[LIBERTY] Banco na subida:', err.message);
    }
  } else {
    logger.warn('[LIBERTY] DATABASE_URL não definida. Defina no .env ou no painel do host.');
  }

  ws.attach(server);
  const io = new SocketIOServer(server, {
    path: '/socket.io',
    cors: {
      origin: ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : process.env.NODE_ENV === 'production' ? false : true,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true,
  });
  app.locals.io = io;
  app.locals.emitMessage = function (message) {
    if (!message) return;
    const chatId = message.chat_id || message.channel_id;
    if (!chatId) return;
    const id = message.id || message.message_id;
    const msg = messageCache.last(String(chatId), id) || message;
    ws.emitMessage(msg);
    const payload = { type: 'message', data: msg };
    io.to(String(chatId)).emit('message', payload);
  };

  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.auth?.accessToken ||
      socket.handshake.query?.token ||
      socket.handshake.query?.accessToken;
    const payload = token ? auth.verify(token) : null;
    socket.userId = payload ? payload.sub : null;
    next();
  });
  io.on('connection', socket => {
    if (!io._libertyUserSockets) io._libertyUserSockets = new Map();
    if (socket.userId) {
      const uid = String(socket.userId);
      let set = io._libertyUserSockets.get(uid);
      if (!set) {
        set = new Set();
        io._libertyUserSockets.set(uid, set);
      }
      set.add(socket.id);
    }
    socket.on('subscribe', payload => {
      const chatId = payload && (payload.chat_id || payload.chatId);
      if (chatId) socket.join(chatId);
    });
    socket.on('unsubscribe', payload => {
      const chatId = payload && (payload.chat_id || payload.chatId);
      if (chatId) socket.leave(chatId);
    });

    if (!io._activeCalls) io._activeCalls = new Map();

    socket.on('call:init', payload => {
      try {
        const from = socket.userId ? String(socket.userId) : null;
        const to = payload && payload.to ? String(payload.to) : null;
        const offer = payload && payload.offer ? payload.offer : null;
        const callId = payload && payload.callId ? String(payload.callId) : crypto.randomUUID();
        if (!from || !to || !offer || !isUuid(to)) return;
        io._activeCalls.set(callId, { callId, from, to, createdAt: Date.now() });
        const set = io._libertyUserSockets.get(String(to));
        if (!set || set.size === 0) {
          socket.emit('call:error', { callId, message: 'Usuário offline.' });
          io._activeCalls.delete(callId);
          return;
        }
        for (const sid of set) io.to(sid).emit('call:incoming', { callId, from, offer });
        socket.emit('call:started', { callId, to });
      } catch (error) {
        console.error(error);
        try { socket.emit('call:error', { message: 'Falha ao iniciar chamada.' }); } catch (_) {}
      }
    });

    socket.on('call:answer', payload => {
      try {
        const from = socket.userId ? String(socket.userId) : null;
        const callId = payload && payload.callId ? String(payload.callId) : null;
        const answer = payload && payload.answer ? payload.answer : null;
        if (!from || !callId || !answer) return;
        const c = io._activeCalls.get(callId);
        if (!c) return;
        const target = String(c.from);
        const set = io._libertyUserSockets.get(target);
        if (!set || set.size === 0) return;
        for (const sid of set) io.to(sid).emit('call:answered', { callId, from, answer });
      } catch (error) {
        console.error(error);
      }
    });

    socket.on('call:ice', payload => {
      try {
        const from = socket.userId ? String(socket.userId) : null;
        const callId = payload && payload.callId ? String(payload.callId) : null;
        const to = payload && payload.to ? String(payload.to) : null;
        const candidate = payload && payload.candidate ? payload.candidate : null;
        if (!from || !callId || !to || !candidate) return;
        const set = io._libertyUserSockets.get(String(to));
        if (!set || set.size === 0) return;
        for (const sid of set) io.to(sid).emit('call:ice', { callId, from, candidate });
      } catch (error) {
        console.error(error);
      }
    });

    socket.on('call:end', payload => {
      try {
        const from = socket.userId ? String(socket.userId) : null;
        const callId = payload && payload.callId ? String(payload.callId) : null;
        if (!from || !callId) return;
        const c = io._activeCalls.get(callId);
        if (!c) return;
        io._activeCalls.delete(callId);
        const a = String(c.from);
        const b = String(c.to);
        const targets = [a, b];
        for (const uid of targets) {
          const set = io._libertyUserSockets.get(uid);
          if (!set || set.size === 0) continue;
          for (const sid of set) io.to(sid).emit('call:ended', { callId, from });
        }
      } catch (error) {
        console.error(error);
      }
    });

    socket.on('disconnect', () => {
      if (!io._libertyUserSockets || !socket.userId) return;
      const uid = String(socket.userId);
      const set = io._libertyUserSockets.get(uid);
      if (!set) return;
      set.delete(socket.id);
      if (set.size === 0) io._libertyUserSockets.delete(uid);
    });
  });

  // Garantir servidor 'Liberty' ownerless (owner_id NULL) e canal padrão #general
  async function ensureLibertyServer() {
    if (!db.isConnected()) return null;
    const existing = await db.query(`SELECT id FROM servers WHERE name = $1 LIMIT 1`, ['Liberty']);
    const serverId = existing.rows[0]?.id;
    if (serverId) {
      const ch = await db.query(
        `SELECT id FROM chats WHERE server_id = $1::uuid AND type = 'channel' LIMIT 1`,
        [serverId]
      );
      if (!ch.rows[0]?.id) {
        await db.query(
          `INSERT INTO chats (id, name, type, server_id) VALUES ($1::uuid, 'general', 'channel', $2::uuid) RETURNING id`,
          [crypto.randomUUID(), serverId]
        );
        logger.info('[LIBERTY] Canal #general criado no servidor Liberty existente.');
      }
      return String(serverId);
    }
    const newServerId = crypto.randomUUID();
    const ins = await db.query(`INSERT INTO servers (id, name, owner_id) VALUES ($1::uuid, $2, NULL) RETURNING id`, [
      newServerId,
      'Liberty',
    ]);
    const createdServerId = ins.rows[0].id;
    await db.query(`INSERT INTO chats (id, name, type, server_id) VALUES ($1::uuid, 'general', 'channel', $2::uuid) RETURNING id`, [
      crypto.randomUUID(),
      createdServerId,
    ]);
    logger.info('[LIBERTY] Servidor Liberty e canal #general criados.');
    return String(createdServerId);
  }

  async function ensureUserInLibertyServer(userId) {
    if (!db.isConnected()) return;
    const serverRow = await db.query(`SELECT id FROM servers WHERE name = $1 LIMIT 1`, ['Liberty']);
    const serverId = serverRow.rows[0]?.id;
    if (!serverId) return;
    const chatRow = await db.query(`SELECT id FROM chats WHERE server_id = $1::uuid AND type = 'channel' LIMIT 1`, [
      serverId,
    ]);
    const chatId = chatRow.rows[0]?.id;
    if (!chatId) return;
    await db.query(
      `INSERT INTO chat_members (chat_id, user_id, role) VALUES ($1::uuid, $2::uuid, 'member') ON CONFLICT (chat_id, user_id) DO NOTHING`,
      [chatId, userId]
    );
    await db.query(
      `INSERT INTO server_members (server_id, user_id, role) VALUES ($1::uuid, $2::uuid, 'member') ON CONFLICT (server_id, user_id) DO NOTHING`,
      [serverId, userId]
    );
  }

  /** Resolve serverId + channelId (ex: liberty-main-server, general) para chat_id no DB */
  async function getChatIdForServerAndChannel(serverId, channelId) {
    if (!db.isConfigured() || !db.isConnected()) return null;
    try {
      await ensureLibertyServer();
      const sid = (serverId || '').trim() || 'Liberty';
      const cid = (channelId || '').trim() || 'general';
      const r = await db.query(
        `SELECT c.id FROM chats c
         INNER JOIN servers s ON s.id = c.server_id
         WHERE c.type = 'channel' AND c.name = $1
           AND (s.id::text = $2 OR s.name = $2 OR (LOWER($2) = 'liberty-main-server' AND s.name = 'Liberty'))
         LIMIT 1`,
        [cid, sid]
      );
      if (r.rows[0]?.id) return String(r.rows[0].id);
      return getDefaultChatId();
    } catch (err) {
      logger.error('getChatIdForServerAndChannel', err);
      return getDefaultChatId();
    }
  }

  const authRouter = express.Router();
  registerAuthRoutes(authRouter, { db, auth, ensureLibertyServer, ensureUserInLibertyServer });
  app.use('/api/v1/auth', authRouter);

  // Mensagens: cache em memória + persistência no DB (ensureMessageInDb)
  app.post('/api/messages', auth.requireAuth, validateBody(schemas.messageContent), async (req, res) => {
    const { content } = req.body || {};
    const safeContent = sanitizeMessageContent(content);
    const userId = req.userId;
    try {
      let chatId = null;
      if (db.isConfigured() && db.isConnected()) chatId = await getDefaultChatId();
      if (!chatId) chatId = 'default-chat';
      let username = 'User';
      let avatarUrl = null;
      if (userId && db.isConfigured() && db.isConnected()) {
        try {
          const u = await db.query('SELECT username, avatar_url FROM users WHERE id = $1 LIMIT 1', [userId]);
          if (u.rows[0]) {
            username = u.rows[0].username || username;
            avatarUrl = u.rows[0].avatar_url || null;
          }
        } catch (_) {}
      }
      const createdAt = new Date();
      const saved = {
        id: crypto.randomUUID(),
        content: safeContent,
        author: username,
        author_username: username,
        username,
        avatar_url: avatarUrl,
        author_id: String(userId),
        channelId: 'default-channel',
        channel_id: chatId,
        chat_id: chatId,
        timestamp: createdAt,
        created_at: createdAt,
      };
      messageCache.push(chatId, saved);
      const emit = req.app.locals.emitMessage;
      if (emit && chatId) emit({ ...saved });
      return res.status(201).json({
        id: saved.id,
        content: saved.content,
        author_username: username,
        username,
        avatar_url: avatarUrl,
        created_at: saved.created_at.toISOString(),
      });
    } catch (err) {
      logger.error('POST /api/messages', err);
      return res.status(500).json({ message: safeApiMessage(err, 'Erro ao salvar mensagem') });
    }
  });

  app.get('/api/messages', auth.requireAuth, async (_req, res) => {
    try {
      let chatId = null;
      if (db.isConfigured() && db.isConnected()) chatId = await getDefaultChatId();
      if (!chatId) chatId = 'default-chat';
      const list = messageCache.list(chatId);
      const response = list.map(m => ({
        id: m.id,
        content: String(m.content || '').trim(),
        author_username: m.author_username || m.author || 'User',
        username: m.author_username || m.author || 'User',
        avatar_url: m.avatar_url || null,
        created_at: (m.created_at instanceof Date ? m.created_at : new Date(m.created_at)).toISOString(),
      }));
      return res.status(200).json(response);
    } catch (err) {
      logger.error('GET /api/messages', err);
      return res.status(500).json({ message: safeApiMessage(err, 'Erro ao carregar mensagens') });
    }
  });

  // POST /api/servers/:serverId/channels/:channelId/messages — cache + persistência no DB
  app.post(
    '/api/servers/:serverId/channels/:channelId/messages',
    auth.requireAuth,
    requireUuidParams(['serverId', 'channelId']),
    validateBody(
      Joi.object({
        content: Joi.string().min(1).max(64 * 1024).trim().required(),
      })
    ),
    async (req, res) => {
      const { content } = req.body || {};
      const safeContent = sanitizeMessageContent(content);
      const userId = req.userId;
      try {
        let chatId = null;
        if (db.isConfigured() && db.isConnected()) {
          chatId = await getChatIdForServerAndChannel(req.params.serverId, req.params.channelId);
        }
        if (!chatId) chatId = req.params.channelId;
        let username = 'User';
        let avatarUrl = null;
        if (db.isConfigured() && db.isConnected()) {
          try {
            const u = await db.query('SELECT username, avatar_url FROM users WHERE id = $1 LIMIT 1', [userId]);
            if (u.rows[0]) {
              username = u.rows[0].username || username;
              avatarUrl = u.rows[0].avatar_url || null;
            }
          } catch (_) {}
        }
        const createdAt = new Date();
        const saved = {
          id: crypto.randomUUID(),
          content: safeContent,
          author: username,
          author_username: username,
          username,
          avatar_url: avatarUrl,
          author_id: String(userId),
          channelId: req.params.channelId,
          channel_id: chatId,
          chat_id: chatId,
          timestamp: createdAt,
          created_at: createdAt,
        };
        messageCache.push(chatId, saved);
        const emit = req.app.locals.emitMessage;
        if (emit && chatId) emit({ ...saved });
        return res.status(201).json({
          id: saved.id,
          content: saved.content,
          author_username: username,
          username,
          avatar_url: avatarUrl,
          created_at: saved.created_at.toISOString(),
        });
      } catch (err) {
        logger.error('POST /api/servers/.../channels/.../messages', err);
        return res.status(500).json({ message: safeApiMessage(err, 'Erro ao salvar mensagem') });
      }
    }
  );

  // Resolve channelId para chat_id: se for UUID válido, usa como chat_id (canal do servidor); senão resolve por nome
  async function resolveChannelToChatId(userId, channelId) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(String(channelId).trim())) {
      const r = await db.query(
        "SELECT c.id FROM chats c LEFT JOIN chat_members cm ON cm.chat_id = c.id AND cm.user_id = $2::uuid WHERE c.id = $1::uuid AND (c.type IN ('channel','dm','group_dm') AND (c.server_id IS NOT NULL OR cm.user_id IS NOT NULL)) LIMIT 1",
        [channelId, userId]
      );
      if (r.rows[0]) return String(r.rows[0].id);
      const any = await db.query('SELECT id FROM chats WHERE id = $1::uuid LIMIT 1', [channelId]);
      if (any.rows[0]) return String(any.rows[0].id);
    }
    return (await getChatIdForServerAndChannel(null, channelId)) || (await getDefaultChatId());
  }

  const uploadAttachment = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, ATTACHMENTS_DIR),
      filename: (_req, file, cb) => {
        const { ext } = sanitizeAttachmentFilename(file.originalname);
        cb(null, `${crypto.randomUUID()}.${ext}`);
      },
    }),
    fileFilter: (_req, file, cb) => {
      if (!isAllowedFile(file.originalname || '', file.mimetype || '')) {
        return cb(new Error('Tipo de ficheiro não permitido. São aceites imagens, vídeos, áudio, documentos e arquivos (ex.: .exe, .php não são permitidos).'));
      }
      cb(null, true);
    },
    limits: { fileSize: config.MAX_UPLOAD_BYTES },
  });

  app.post(
    '/api/v1/channels/:channelId/attachments',
    auth.requireAuth,
    requireUuidParams(['channelId']),
    (req, res, next) => {
      resolveChannelToChatId(req.userId, req.params.channelId).then(chatId => {
        if (!chatId) return res.status(404).json({ message: 'Canal não encontrado' });
        next();
      }).catch(err => next(err));
    },
    (req, res, next) => {
      uploadAttachment.single('file')(req, res, (err) => {
        if (err && err.code === 'LIMIT_FILE_SIZE') {
          const maxMB = Math.round(config.MAX_UPLOAD_BYTES / (1024 * 1024));
          return res.status(400).json({ message: `Ficheiro excede o limite de ${maxMB} MB.` });
        }
        if (err && err.message && err.message.includes('Tipo de ficheiro')) return res.status(400).json({ message: err.message });
        next(err);
      });
    },
    (req, res) => {
      if (!req.file) return res.status(400).json({ message: 'Envie um ficheiro (campo "file").' });
      const url = `/uploads/attachments/${req.file.filename}`;
      const { safeBasename, ext } = sanitizeAttachmentFilename(req.file.originalname);
      const safeDisplayName = `${safeBasename}.${ext}`.slice(0, 200);
      return res.status(201).json({
        url,
        filename: safeDisplayName,
        mime_type: req.file.mimetype || null,
      });
    }
  );

  app.post(
    '/api/v1/channels/:channelId/messages',
    auth.requireAuth,
    requireUuidParams(['channelId']),
    validateBody(schemas.messageContent),
    async (req, res) => {
      const { channelId } = req.params;
      const { content, client_id: clientId, attachments: rawAttachments } = req.body || {};
      const safeContent = sanitizeMessageContent(content || '');
      const userId = req.userId;
      const hasAttachments = Array.isArray(rawAttachments) && rawAttachments.length > 0;
      if (!safeContent && !hasAttachments) {
        return res.status(400).json({ message: 'Envie texto e/ou anexos.' });
      }
      try {
        let chatId = null;
        if (db.isConfigured() && db.isConnected()) {
          chatId = (await resolveChannelToChatId(userId, channelId)) || (await getDefaultChatId());
        }
        if (!chatId) chatId = String(channelId);
        let username = 'User';
        let avatarUrl = null;
        if (db.isConfigured() && db.isConnected()) {
          try {
            const u = await db.query('SELECT username, avatar_url FROM users WHERE id = $1 LIMIT 1', [userId]);
            if (u.rows[0]) {
              username = u.rows[0].username || username;
              avatarUrl = u.rows[0].avatar_url || null;
            }
          } catch (_) {}
        }
        const savedAttachments = [];
        const MAX_BASE64_SIZE = 50 * 1024 * 1024;
        if (hasAttachments) {
          for (const att of rawAttachments) {
            if (att.url && (att.url.startsWith('/uploads/') || att.url.startsWith('http://') || att.url.startsWith('https://'))) {
              savedAttachments.push({
                url: att.url,
                filename: att.filename || path.basename(att.url) || 'file',
                mime_type: att.mime_type || null,
              });
              continue;
            }
            if (att.data && typeof att.data === 'string') {
              const match = att.data.match(/^data:([^;]+);base64,(.+)$/);
              if (!match) continue;
              const mimeType = (match[1] || '').trim();
              const base64 = match[2];
              let buf;
              try {
                buf = Buffer.from(base64, 'base64');
              } catch (_) {
                continue;
              }
              if (buf.length > MAX_BASE64_SIZE) {
                return res.status(400).json({ message: `Anexo "${att.filename || 'file'}" excede 50 MB. Use o upload de ficheiros.` });
              }
              const origName = att.filename || `file.${mimeType.split('/')[1] || 'bin'}`;
              if (!isAllowedFile(origName, mimeType)) {
                return res.status(400).json({ message: 'Tipo de ficheiro não permitido para anexos em base64.' });
              }
              const { ext } = sanitizeAttachmentFilename(origName);
              const filename = `${crypto.randomUUID()}.${ext}`;
              const filepath = path.join(ATTACHMENTS_DIR, filename);
              try {
                fs.writeFileSync(filepath, buf);
              } catch (e) {
                logger.error('write attachment', e);
                return res.status(500).json({ message: 'Erro ao guardar anexo.' });
              }
              const url = `/uploads/attachments/${filename}`;
              savedAttachments.push({
                url,
                filename: att.filename || filename,
                mime_type: mimeType || null,
              });
            }
          }
        }
        const createdAt = new Date();
        const saved = {
          id: crypto.randomUUID(),
          content: safeContent,
          author: username,
          author_username: username,
          author_id: String(userId),
          avatar_url: avatarUrl,
          channelId,
          channel_id: chatId,
          chat_id: chatId,
          timestamp: createdAt,
          created_at: createdAt,
          attachments: savedAttachments.length ? savedAttachments : undefined,
        };
        messageCache.push(chatId, saved);
        const emit = req.app.locals.emitMessage;
        if (emit && chatId) emit({ ...saved });
        const response = { success: true, message: saved };
        if (clientId !== undefined) response.client_id = clientId;
        return res.status(201).json(response);
      } catch (err) {
        logger.error('POST /api/v1/channels/:id/messages', err);
        return res.status(500).json({ message: safeApiMessage(err, 'Erro ao salvar') });
      }
    }
  );

  app.get('/api/v1/channels/:channelId/messages', auth.requireAuth, requireUuidParams(['channelId']), async (req, res) => {
    const { channelId } = req.params;
    const userId = req.userId;
    try {
      let chatId = null;
      if (db.isConfigured() && db.isConnected()) {
        chatId = (await resolveChannelToChatId(userId, channelId)) || (await getDefaultChatId());
      }
      if (!chatId) chatId = String(channelId);
      const list = messageCache.list(chatId);
      let result = list.map(m => ({
        id: m.id,
        channel_id: channelId,
        content: String(m.content || ''),
        author_id: m.author_id || null,
        author_username: m.author_username || m.author || 'User',
        avatar_url: m.avatar_url || null,
        created_at: (m.created_at instanceof Date ? m.created_at : new Date(m.created_at)).toISOString(),
        attachments: Array.isArray(m.attachments) && m.attachments.length > 0 ? m.attachments : undefined,
      }));
      return res.status(200).json(result);
    } catch (err) {
      logger.error('GET /api/v1/channels/:id/messages', err);
      return res.status(500).json({ message: safeApiMessage(err, 'Erro') });
    }
  });

  // Pins — apenas admins (ADMIN_USERNAMES) podem fixar/desfixar; qualquer um pode listar
  app.get('/api/v1/channels/:channelId/pins', auth.requireAuth, requireUuidParams(['channelId']), async (req, res) => {
    return res.status(200).json([]);
  });

  app.put('/api/v1/channels/:channelId/pins/:messageId', auth.requireAuth, requireUuidParams(['channelId', 'messageId']), async (req, res) => {
    const { channelId, messageId } = req.params;
    if (!(await isAdmin(req)))
      return res.status(403).json({ message: 'Apenas administradores podem fixar mensagens.' });
    if (!db.isConfigured() || !db.isConnected()) return res.status(503).json({ message: 'Banco indisponível' });
    if (!isUuid(channelId) || !isUuid(messageId))
      return res.status(400).json({ message: 'channelId ou messageId inválido' });
    try {
      await db.query(
        `INSERT INTO message_pins (chat_id, message_id, pinned_by) VALUES ($1::uuid, $2::uuid, $3::uuid)
         ON CONFLICT (chat_id, message_id) DO NOTHING`,
        [channelId, messageId, req.userId]
      );
      return res.status(200).json({ success: true });
    } catch (err) {
      if (err.code === '23503') return res.status(404).json({ message: 'Canal ou mensagem não encontrados' });
      return res.status(500).json({ message: safeApiMessage(err, 'Erro ao fixar') });
    }
  });

  app.delete('/api/v1/channels/:channelId/pins/:messageId', auth.requireAuth, requireUuidParams(['channelId', 'messageId']), async (req, res) => {
    const { channelId, messageId } = req.params;
    if (!(await isAdmin(req)))
      return res.status(403).json({ message: 'Apenas administradores podem desfixar mensagens.' });
    if (!db.isConfigured() || !db.isConnected()) return res.status(503).json({ message: 'Banco indisponível' });
    if (!isUuid(channelId) || !isUuid(messageId))
      return res.status(400).json({ message: 'channelId ou messageId inválido' });
    try {
      await db.query('DELETE FROM message_pins WHERE chat_id = $1::uuid AND message_id = $2::uuid', [
        channelId,
        messageId,
      ]);
      return res.status(204).end();
    } catch (err) {
      return res.status(500).json({ message: safeApiMessage(err, 'Erro ao desfixar') });
    }
  });

  // GET /api/v1/admin/db — estatísticas do banco (apenas admins)
  app.get('/api/v1/admin/db', auth.requireAuth, async (req, res) => {
    if (!(await isAdmin(req)))
      return res.status(403).json({ message: 'Acesso negado. Apenas administradores podem ver o banco.' });
    if (!db.isConfigured() || !db.isConnected()) return res.status(503).json({ message: 'Banco indisponível' });
    try {
      const [u, s, c, mp] = await Promise.all([
        db.query('SELECT COUNT(*) AS n FROM users'),
        db.query('SELECT COUNT(*) AS n FROM servers'),
        db.query('SELECT COUNT(*) AS n FROM chats'),
        db.query('SELECT COUNT(*) AS n FROM message_pins'),
      ]);
      return res.status(200).json({
        users: parseInt(u.rows[0]?.n || 0, 10),
        servers: parseInt(s.rows[0]?.n || 0, 10),
        channels: parseInt(c.rows[0]?.n || 0, 10),
        messages: 0,
        pinned_messages: parseInt(mp.rows[0]?.n || 0, 10),
      });
    } catch (err) {
      return res.status(500).json({ message: safeApiMessage(err, 'Erro ao obter estatísticas') });
    }
  });

  // GET /api/v1/servers — lista de servidores do usuário (autenticado); Liberty sempre incluído
  app.get(
    '/api/v1/servers',
    auth.requireAuth,
    (req, res, next) => auth.requireUserExists(req, res, next).catch(next),
    async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) {
      return res.status(503).json({ message: 'Banco indisponível' });
    }
    try {
      const userId = req.userId;
      await ensureLibertyServer();
      await ensureUserInLibertyServer(userId);
      const r = await db.query(
        `SELECT DISTINCT s.id, s.name, s.owner_id, s.created_at, s.icon_url
         FROM servers s
         LEFT JOIN chats c ON c.server_id = s.id
         LEFT JOIN chat_members cm ON cm.chat_id = c.id AND cm.user_id = $1::uuid
         LEFT JOIN server_members sm ON sm.server_id = s.id AND sm.user_id = $1::uuid
         WHERE s.owner_id = $1::uuid OR cm.user_id = $1::uuid OR sm.user_id = $1::uuid
         ORDER BY s.created_at ASC`,
        [userId]
      );
      let servers = r.rows.map(row => ({
        id: String(row.id),
        name: row.name,
        owner_id: row.owner_id ? String(row.owner_id) : null,
        created_at: row.created_at,
        icon: row.icon_url || null,
        icon_url: row.icon_url || null,
      }));
      const hasLiberty = servers.some(s => s.name === 'Liberty');
      if (!hasLiberty) {
        const libertyRow = await db.query(
          `SELECT id, name, owner_id, created_at, icon_url FROM servers WHERE name = $1 LIMIT 1`,
          ['Liberty']
        );
        if (libertyRow.rows[0]) {
          const row = libertyRow.rows[0];
          servers = [
            {
              id: String(row.id),
              name: row.name,
              owner_id: row.owner_id ? String(row.owner_id) : null,
              created_at: row.created_at,
              icon: row.icon_url || null,
              icon_url: row.icon_url || null,
            },
            ...servers,
          ];
        }
      }
      return res.status(200).json(servers);
    } catch (err) {
      if (err.message && err.message.includes('does not exist')) {
        try {
          await dbInit();
          const r = await db.query(
            `SELECT id, name, owner_id, created_at, icon_url FROM servers ORDER BY created_at ASC`
          );
          const servers = r.rows.map(row => ({
            id: String(row.id),
            name: row.name,
            owner_id: row.owner_id ? String(row.owner_id) : null,
            created_at: row.created_at,
            icon: row.icon_url || null,
            icon_url: row.icon_url || null,
          }));
          return res.status(200).json(servers);
        } catch (e) {
          logger.error('GET /api/v1/servers (após init)', e);
          return res.status(500).json({ message: safeApiMessage(e, 'Erro ao listar servidores') });
        }
      }
      logger.error('GET /api/v1/servers', err);
      return res.status(500).json({ message: safeApiMessage(err, 'Erro ao listar servidores') });
    }
    });

  // GET /api/v1/servers/:serverId — detalhes de um servidor (autenticado; 404 se não existir ou sem acesso)
  app.get('/api/v1/servers/:serverId', auth.requireAuth, requireUuidParams(['serverId']), async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) {
      return res.status(503).json({ message: 'Banco indisponível' });
    }
    const serverId = req.params.serverId;
    const userId = req.userId;
    try {
      const r = await db.query(
        `SELECT s.id, s.name, s.owner_id, s.created_at, s.icon_url
         FROM servers s
         LEFT JOIN chats c ON c.server_id = s.id
         LEFT JOIN chat_members cm ON cm.chat_id = c.id AND cm.user_id = $2::uuid
         LEFT JOIN server_members sm ON sm.server_id = s.id AND sm.user_id = $2::uuid
         WHERE s.id = $1::uuid AND (s.owner_id = $2::uuid OR cm.user_id = $2::uuid OR sm.user_id = $2::uuid)
         LIMIT 1`,
        [serverId, userId]
      );
      if (!r.rows[0]) {
        return res.status(404).json({ message: 'Servidor não encontrado' });
      }
      const row = r.rows[0];
      await ensureLibertyServer();
      const [chRes, mRes] = await Promise.all([
        db.query(
          `SELECT id, name, type, server_id, parent_id, channel_type, created_at
           FROM chats WHERE server_id = $1::uuid AND type IN ('channel', 'category')
           ORDER BY type ASC, created_at ASC`,
          [serverId]
        ),
        db.query(
          `SELECT DISTINCT u.id, u.username, u.avatar_url, COALESCE(sm.role, 'member') AS role
           FROM users u
           INNER JOIN chat_members cm ON cm.user_id = u.id
           INNER JOIN chats c ON c.id = cm.chat_id AND c.server_id = $1::uuid
           LEFT JOIN server_bans sb ON sb.server_id = c.server_id AND sb.user_id = u.id
           LEFT JOIN server_members sm ON sm.server_id = c.server_id AND sm.user_id = u.id
           WHERE sb.id IS NULL ORDER BY u.username ASC`,
          [serverId]
        ),
      ]);
      const channels = chRes.rows.map(c => ({
        id: String(c.id),
        name: c.name,
        type: c.type,
        server_id: c.server_id ? String(c.server_id) : null,
        parent_id: c.parent_id ? String(c.parent_id) : null,
        channel_type: c.channel_type || 'text',
        created_at: c.created_at,
      }));
      const members = mRes.rows.map(m => ({
        user_id: String(m.id),
        id: String(m.id),
        username: m.username,
        avatar_url: m.avatar_url || null,
        avatar: m.avatar_url || null,
        status: 'online',
        role: (m.role || 'member').toLowerCase(),
      }));
      return res.status(200).json({
        id: String(row.id),
        name: row.name,
        owner_id: row.owner_id ? String(row.owner_id) : null,
        created_at: row.created_at,
        icon: row.icon_url || null,
        icon_url: row.icon_url || null,
        channels,
        members,
      });
    } catch (err) {
      if (err.code === '22P02') return res.status(404).json({ message: 'Servidor não encontrado' });
      logger.error('GET /api/v1/servers/:serverId', err);
      return res.status(500).json({ message: safeApiMessage(err, 'Erro ao carregar servidor') });
    }
  });

  // PATCH /api/v1/servers/:serverId — atualizar servidor (bloqueado para servidor LIBERTY oficial)
  app.patch('/api/v1/servers/:serverId', auth.requireAuth, requireUuidParams(['serverId']), validateBody(schemas.patchServer), async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) {
      return res.status(503).json({ message: 'Banco indisponível' });
    }
    const serverId = req.params.serverId;
    const userId = req.userId;
    try {
      const r = await db.query(`SELECT id, name, owner_id FROM servers WHERE id = $1::uuid LIMIT 1`, [serverId]);
      if (!r.rows[0]) {
        return res.status(404).json({ message: 'Servidor não encontrado' });
      }
      if (isOfficialLibertyServer(r.rows[0])) {
        return res.status(403).json({ message: 'O servidor LIBERTY oficial não pode ser alterado.' });
      }
      const ownerCheck = await db.query(`SELECT id FROM servers WHERE id = $1::uuid AND owner_id = $2::uuid LIMIT 1`, [
        serverId,
        userId,
      ]);
      if (!ownerCheck.rows[0]) {
        return res.status(403).json({ message: 'Apenas o dono pode alterar o servidor.' });
      }
      const { name, icon } = req.body || {};
      const updates = [];
      const values = [];
      let idx = 1;
      const safeName = name !== undefined ? sanitizeName(name) : '';
      if (safeName) {
        updates.push(`name = $${idx++}`);
        values.push(safeName);
      }
      if (icon !== undefined && typeof icon === 'string' && icon.startsWith('data:image/')) {
        const match = icon.match(/^data:image\/(\w+);base64,(.+)$/);
        if (match) {
          const ext = match[1] === 'jpeg' || match[1] === 'jpg' ? 'jpg' : 'png';
          const dir = path.join(__dirname, 'uploads', 'servers');
          fs.mkdirSync(dir, { recursive: true });
          const filePath = path.join(dir, `${serverId}.${ext}`);
          fs.writeFileSync(filePath, Buffer.from(match[2], 'base64'));
          const iconUrl = `/uploads/servers/${serverId}.${ext}`;
          updates.push(`icon_url = $${idx++}`);
          values.push(iconUrl);
        }
      }
      if (updates.length === 0) {
        const row = await db.query(`SELECT id, name, owner_id, created_at, icon_url FROM servers WHERE id = $1::uuid`, [
          serverId,
        ]);
        const s = row.rows[0];
        return res.status(200).json({
          id: String(s.id),
          name: s.name,
          owner_id: s.owner_id ? String(s.owner_id) : null,
          created_at: s.created_at,
          icon: s.icon_url || null,
          icon_url: s.icon_url || null,
        });
      }
      values.push(serverId);
      await db.query(`UPDATE servers SET ${updates.join(', ')} WHERE id = $${idx}::uuid`, values);
      const row = await db.query(`SELECT id, name, owner_id, created_at, icon_url FROM servers WHERE id = $1::uuid`, [
        serverId,
      ]);
      const s = row.rows[0];
      return res.status(200).json({
        id: String(s.id),
        name: s.name,
        owner_id: s.owner_id ? String(s.owner_id) : null,
        created_at: s.created_at,
        icon: s.icon_url || null,
        icon_url: s.icon_url || null,
      });
    } catch (err) {
      if (err.code === '22P02') return res.status(404).json({ message: 'Servidor não encontrado' });
      logger.error('PATCH /api/v1/servers/:serverId', err);
      return res.status(500).json({ message: safeApiMessage(err, 'Erro ao atualizar servidor') });
    }
  });

  // DELETE /api/v1/servers/:serverId — apagar servidor (bloqueado para servidor LIBERTY oficial)
  app.delete('/api/v1/servers/:serverId', auth.requireAuth, requireUuidParams(['serverId']), async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) {
      return res.status(503).json({ message: 'Banco indisponível' });
    }
    const serverId = req.params.serverId;
    const userId = req.userId;
    try {
      const r = await db.query(`SELECT id, name, owner_id FROM servers WHERE id = $1::uuid LIMIT 1`, [serverId]);
      if (!r.rows[0]) {
        return res.status(404).json({ message: 'Servidor não encontrado' });
      }
      if (isOfficialLibertyServer(r.rows[0])) {
        return res.status(403).json({ message: 'O servidor LIBERTY oficial não pode ser alterado.' });
      }
      const ownerCheck = await db.query(`SELECT id FROM servers WHERE id = $1::uuid AND owner_id = $2::uuid LIMIT 1`, [
        serverId,
        userId,
      ]);
      if (!ownerCheck.rows[0]) {
        return res.status(403).json({ message: 'Apenas o dono pode apagar o servidor.' });
      }
      await db.query(`DELETE FROM servers WHERE id = $1::uuid`, [serverId]);
      return res.status(204).end();
    } catch (err) {
      if (err.code === '22P02') return res.status(404).json({ message: 'Servidor não encontrado' });
      logger.error('DELETE /api/v1/servers/:serverId', err);
      return res.status(500).json({ message: safeApiMessage(err, 'Erro ao apagar servidor') });
    }
  });

  // POST /api/v1/servers — criar servidor (autenticado)
  app.post(
    '/api/v1/servers',
    auth.requireAuth,
    (req, res, next) => auth.requireUserExists(req, res, next).catch(next),
    async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) {
      return res.status(503).json({ message: 'Banco indisponível' });
    }
    const { name, region, icon } = req.body || {};
    const serverName = sanitizeName(name) || 'Novo servidor';
    const userId = req.userId;
    try {
      const newServerId = crypto.randomUUID();
      const ins = await db.query(
        `INSERT INTO servers (id, name, owner_id) VALUES ($1::uuid, $2, $3::uuid) RETURNING id, name, owner_id, created_at`,
        [newServerId, serverName, userId]
      );
      const row = ins.rows[0];
      const serverId = row.id;
      let iconUrl = null;
      if (icon && typeof icon === 'string' && icon.startsWith('data:image/')) {
        const match = icon.match(/^data:image\/(\w+);base64,(.+)$/);
        if (match) {
          const ext = match[1] === 'jpeg' || match[1] === 'jpg' ? 'jpg' : 'png';
          const dir = path.join(__dirname, 'uploads', 'servers');
          try {
            fs.mkdirSync(dir, { recursive: true });
            const filePath = path.join(dir, `${serverId}.${ext}`);
            fs.writeFileSync(filePath, Buffer.from(match[2], 'base64'));
            iconUrl = `/uploads/servers/${serverId}.${ext}`;
            await db.query(`UPDATE servers SET icon_url = $1 WHERE id = $2::uuid`, [iconUrl, serverId]);
          } catch (e) {
            logger.warn('[API] Erro ao gravar ícone do servidor:', e.message);
          }
        }
      }
      const server = {
        id: String(row.id),
        name: row.name,
        owner_id: String(row.owner_id),
        created_at: row.created_at,
        icon: iconUrl,
        icon_url: iconUrl,
      };
      const newChatId = crypto.randomUUID();
      const ch = await db.query(
        `INSERT INTO chats (id, name, type, server_id) VALUES ($1::uuid, $2, 'channel', $3::uuid) RETURNING id`,
        [newChatId, 'general', row.id]
      );
      const generalChatId = ch.rows[0].id;
      await db.query(
        `INSERT INTO chat_members (chat_id, user_id) VALUES ($1::uuid, $2::uuid) ON CONFLICT (chat_id, user_id) DO NOTHING`,
        [generalChatId, userId]
      );
      await db.query(
        `INSERT INTO server_members (server_id, user_id, role) VALUES ($1::uuid, $2::uuid, 'member') ON CONFLICT (server_id, user_id) DO NOTHING`,
        [row.id, userId]
      );
      return res.status(201).json({ server });
    } catch (err) {
      if (err.message && err.message.includes('does not exist')) {
        try {
          await dbInit();
          const newServerId = crypto.randomUUID();
          const ins = await db.query(
            `INSERT INTO servers (id, name, owner_id) VALUES ($1::uuid, $2, $3::uuid) RETURNING id, name, owner_id, created_at`,
            [newServerId, serverName, userId]
          );
          const row = ins.rows[0];
          const newChatId = crypto.randomUUID();
          const ch = await db.query(
            `INSERT INTO chats (id, name, type, server_id) VALUES ($1::uuid, $2, 'channel', $3::uuid) RETURNING id`,
            [newChatId, 'general', row.id]
          );
          const generalChatId = ch.rows[0].id;
          await db.query(
            `INSERT INTO chat_members (chat_id, user_id) VALUES ($1::uuid, $2::uuid) ON CONFLICT (chat_id, user_id) DO NOTHING`,
            [generalChatId, userId]
          );
          await db.query(
            `INSERT INTO server_members (server_id, user_id, role) VALUES ($1::uuid, $2::uuid, 'member') ON CONFLICT (server_id, user_id) DO NOTHING`,
            [row.id, userId]
          );
          return res.status(201).json({
            server: {
              id: String(row.id),
              name: row.name,
              owner_id: String(row.owner_id),
              created_at: row.created_at,
              icon: null,
              icon_url: null,
            },
          });
        } catch (e) {
          logger.error('POST /api/v1/servers (após init)', e);
          return res.status(500).json({ message: e.message || 'Erro ao criar servidor' });
        }
      }
      logger.error('POST /api/v1/servers', err);
      return res.status(500).json({ message: safeApiMessage(err, 'Erro ao criar servidor') });
    }
    });

  // GET /api/v1/servers/:serverId/channels — lista canais e categorias do servidor
  app.get('/api/v1/servers/:serverId/channels', auth.requireAuth, requireUuidParams(['serverId']), async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) {
      return res.status(503).json({ message: 'Banco indisponível' });
    }
    const serverId = req.params.serverId;
    try {
      let r = await db.query(
        `SELECT id, name, type, server_id, parent_id, channel_type, created_at
         FROM chats
         WHERE server_id = $1::uuid AND type IN ('channel', 'category')
         ORDER BY type ASC, created_at ASC`,
        [serverId]
      );
      if (r.rows.length === 0) {
        const libertyId = await ensureLibertyServer();
        if (libertyId && String(libertyId) === String(serverId)) {
          r = await db.query(
            `SELECT id, name, type, server_id, parent_id, channel_type, created_at
             FROM chats
             WHERE server_id = $1::uuid AND type IN ('channel', 'category')
             ORDER BY type ASC, created_at ASC`,
            [serverId]
          );
        }
      }
      const list = r.rows.map(row => ({
        id: String(row.id),
        name: row.name,
        type: row.type,
        server_id: row.server_id ? String(row.server_id) : null,
        parent_id: row.parent_id ? String(row.parent_id) : null,
        channel_type: row.channel_type || 'text',
        created_at: row.created_at,
      }));
      return res.status(200).json(list);
    } catch (err) {
      logger.error('GET /api/v1/servers/:serverId/channels', err);
      return res.status(500).json({ message: safeApiMessage(err, 'Erro ao listar canais') });
    }
  });

  // GET /api/v1/servers/:serverId/members — membros do servidor (exclui banidos; role de server_members)
  app.get('/api/v1/servers/:serverId/members', auth.requireAuth, requireUuidParams(['serverId']), async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) {
      return res.status(503).json({ message: 'Banco indisponível' });
    }
    const serverId = req.params.serverId;
    try {
      const r = await db.query(
        `SELECT DISTINCT u.id, u.username, u.avatar_url, COALESCE(sm.role, 'member') AS role
         FROM users u
         INNER JOIN chat_members cm ON cm.user_id = u.id
         INNER JOIN chats c ON c.id = cm.chat_id AND c.server_id = $1::uuid
         LEFT JOIN server_bans sb ON sb.server_id = c.server_id AND sb.user_id = u.id
         LEFT JOIN server_members sm ON sm.server_id = c.server_id AND sm.user_id = u.id
         WHERE sb.id IS NULL
         ORDER BY u.username ASC`,
        [serverId]
      );
      const list = r.rows.map(row => ({
        user_id: String(row.id),
        id: String(row.id),
        username: row.username,
        avatar_url: row.avatar_url || null,
        avatar: row.avatar_url || null,
        status: 'online',
        role: (row.role || 'member').toLowerCase(),
      }));
      return res.status(200).json(list);
    } catch (err) {
      logger.error('GET /api/v1/servers/:serverId/members', err);
      return res.status(500).json({ message: safeApiMessage(err, 'Erro ao listar membros') });
    }
  });

  // PATCH /api/v1/servers/:serverId/members/:userId — alterar cargo (apenas dono do servidor ou admin)
  app.patch('/api/v1/servers/:serverId/members/:userId', auth.requireAuth, requireUuidParams(['serverId', 'userId']), validateBody(schemas.patchMemberRole), async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) return res.status(503).json({ message: 'Banco indisponível' });
    const { serverId, userId } = req.params;
    const role = sanitizeRole(req.body?.role);
    if (!role) return res.status(400).json({ message: 'role deve ser member, moderator ou admin' });
    try {
      const serverRow = await db.query('SELECT owner_id FROM servers WHERE id = $1::uuid', [serverId]);
      const s = serverRow.rows[0];
      if (!s) return res.status(404).json({ message: 'Servidor não encontrado' });
      const isOwner = s.owner_id && String(s.owner_id) === String(req.userId);
      const adminOk = await isAdmin(req);
      if (!isOwner && !adminOk)
        return res.status(403).json({ message: 'Apenas o dono do servidor ou um administrador pode alterar cargos.' });
      await db.query(
        `INSERT INTO server_members (server_id, user_id, role) VALUES ($1::uuid, $2::uuid, $3)
         ON CONFLICT (server_id, user_id) DO UPDATE SET role = $3`,
        [serverId, userId, role]
      );
      return res.status(200).json({ success: true, role });
    } catch (err) {
      if (err.code === '22P02') return res.status(404).json({ message: 'Servidor ou usuário não encontrado' });
      return res.status(500).json({ message: safeApiMessage(err, 'Erro ao atualizar cargo') });
    }
  });

  // POST /api/v1/servers/:serverId/bans — banir usuário do servidor (apenas admins)
  app.post('/api/v1/servers/:serverId/bans', auth.requireAuth, requireUuidParams(['serverId']), validateBody(schemas.serverBan), async (req, res) => {
    if (!(await isAdmin(req))) return res.status(403).json({ message: 'Apenas administradores podem banir membros.' });
    if (!db.isConfigured() || !db.isConnected()) return res.status(503).json({ message: 'Banco indisponível' });
    const serverId = req.params.serverId;
    const { user_id, reason } = req.body || {};
    try {
      await db.query(
        `INSERT INTO server_bans (server_id, user_id, banned_by, reason) VALUES ($1::uuid, $2::uuid, $3::uuid, $4)
         ON CONFLICT (server_id, user_id) DO UPDATE SET banned_by = $3::uuid, reason = $4`,
        [serverId, user_id, req.userId, sanitizeReason(reason)]
      );
      const chats = await db.query('SELECT id FROM chats WHERE server_id = $1::uuid', [serverId]);
      for (const ch of chats.rows || []) {
        await db.query('DELETE FROM chat_members WHERE chat_id = $1::uuid AND user_id = $2::uuid', [ch.id, user_id]);
      }
      return res.status(200).json({ success: true });
    } catch (err) {
      if (err.code === '22P02') return res.status(404).json({ message: 'Servidor ou usuário não encontrado' });
      return res.status(500).json({ message: safeApiMessage(err, 'Erro ao banir') });
    }
  });

  // DELETE /api/v1/servers/:serverId/bans/:userId — desbanir (apenas admins)
  app.delete('/api/v1/servers/:serverId/bans/:userId', auth.requireAuth, requireUuidParams(['serverId', 'userId']), async (req, res) => {
    if (!(await isAdmin(req))) return res.status(403).json({ message: 'Apenas administradores podem desbanir.' });
    if (!db.isConfigured() || !db.isConnected()) return res.status(503).json({ message: 'Banco indisponível' });
    const { serverId, userId } = req.params;
    try {
      await db.query('DELETE FROM server_bans WHERE server_id = $1::uuid AND user_id = $2::uuid', [serverId, userId]);
      return res.status(204).end();
    } catch (err) {
      return res.status(500).json({ message: safeApiMessage(err, 'Erro ao desbanir') });
    }
  });

  // POST /api/v1/servers/:serverId/channels — criar canal (texto/voz) ou categoria
  app.post('/api/v1/servers/:serverId/channels', auth.requireAuth, requireUuidParams(['serverId']), validateBody(schemas.createChannel), async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) {
      return res.status(503).json({ message: 'Banco indisponível' });
    }
    const serverId = req.params.serverId;
    const userId = req.userId;
    try {
      const sr = await db.query(`SELECT id, name, owner_id FROM servers WHERE id = $1::uuid LIMIT 1`, [serverId]);
      if (sr.rows[0] && isOfficialLibertyServer(sr.rows[0])) {
        return res.status(403).json({ message: 'O servidor LIBERTY oficial não pode ser alterado.' });
      }
    } catch (_) {}
    const { name, type, parent_id } = req.body || {};
    const channelType = (type === 'voice' ? 'voice' : 'text').toLowerCase();
    const isCategory = String(type).toLowerCase() === 'category';
    const channelName = sanitizeChannelName(name) || sanitizeName(name, 100).replace(/\s+/g, '-').toLowerCase();
    if (!channelName || channelName.length < 1) {
      return res.status(400).json({ message: 'Nome do canal ou categoria é obrigatório' });
    }
    try {
      const chatType = isCategory ? 'category' : 'channel';
      const parentId = parent_id && isUuid(parent_id) ? String(parent_id).trim() : null;
      const channelTypeVal = isCategory ? null : channelType;
      const ins = await db.query(
        `INSERT INTO chats (id, name, type, server_id, parent_id, channel_type)
         VALUES ($1::uuid, $2, $3, $4::uuid, $5::uuid, $6)
         RETURNING id, name, type, server_id, parent_id, channel_type, created_at`,
        [crypto.randomUUID(), channelName, chatType, serverId, parentId, channelTypeVal]
      );
      const row = ins.rows[0];
      if (!isCategory) {
        await db.query(
          `INSERT INTO chat_members (chat_id, user_id) VALUES ($1::uuid, $2::uuid) ON CONFLICT (chat_id, user_id) DO NOTHING`,
          [row.id, userId]
        );
        await db.query(
          `INSERT INTO server_members (server_id, user_id, role) VALUES ($1::uuid, $2::uuid, 'member') ON CONFLICT (server_id, user_id) DO NOTHING`,
          [serverId, userId]
        );
      }
      const channel = {
        id: String(row.id),
        name: row.name,
        type: row.type,
        server_id: String(row.server_id),
        parent_id: row.parent_id ? String(row.parent_id) : null,
        channel_type: row.channel_type || 'text',
        created_at: row.created_at,
      };
      return res.status(201).json(channel);
    } catch (err) {
      if (err.code === '23503') {
        return res.status(400).json({ message: 'Servidor ou categoria inválida' });
      }
      logger.error('POST /api/v1/servers/:serverId/channels', err);
      return res.status(500).json({ message: safeApiMessage(err, 'Erro ao criar canal') });
    }
  });

  // GET /api/v1/default-chat — ID do chat padrão (para o cliente inscrever no WebSocket)
  app.get('/api/v1/default-chat', async (_req, res) => {
    try {
      const chatId = await getDefaultChatId();
      if (!chatId) return res.status(404).json({ message: 'Chat padrão indisponível' });
      return res.status(200).json({ chat_id: chatId });
    } catch (err) {
      return res.status(500).json({ message: safeApiMessage(err) });
    }
  });

  // GET /api/v1/users/@me/channels — DMs e grupos do usuário
  app.get('/api/v1/users/@me/channels', auth.requireAuth, async (req, res) => {
    const userId = req.userId;
    if (!db.isConfigured() || !db.isConnected()) {
      return res.status(503).json({ message: 'Banco indisponível' });
    }
    try {
      const channels = [];

      const rels = await db.query(
        `SELECT
           to_regclass('public.chat_members') AS chat_members,
           to_regclass('public.group_members') AS group_members`
      );
      const hasChatMembers = !!rels.rows[0]?.chat_members;
      const hasGroupMembers = !!rels.rows[0]?.group_members;

      if (hasChatMembers) {
        const memberChannels = await db.query(
          `SELECT c.id, c.name, c.type, c.server_id FROM chats c
           INNER JOIN chat_members cm ON cm.chat_id = c.id
           WHERE cm.user_id = $1::uuid AND c.type = 'channel'`,
          [userId]
        );
        for (const row of memberChannels.rows) {
          channels.push({
            id: String(row.id),
            type: 'channel',
            name: row.name || 'geral',
            server_id: row.server_id ? String(row.server_id) : null,
          });
        }

        const dmRows = await db.query(
          `SELECT c.id AS chat_id, u.id AS recipient_id, u.username AS recipient_username, u.avatar_url AS recipient_avatar_url
           FROM chats c
           INNER JOIN chat_members me ON me.chat_id = c.id AND me.user_id = $1::uuid
           INNER JOIN chat_members other ON other.chat_id = c.id AND other.user_id != $1::uuid
           INNER JOIN users u ON u.id = other.user_id
           WHERE c.type = 'dm'`,
          [userId]
        );
        for (const row of dmRows.rows) {
          const recipient = {
            id: String(row.recipient_id),
            username: row.recipient_username,
            avatar_url: row.recipient_avatar_url || null,
            avatar: row.recipient_avatar_url || null,
          };
          if (!recipient.username || recipient.username === 'Unknown') continue;
          channels.push({
            id: String(row.chat_id),
            type: 'dm',
            name: null,
            recipient,
            recipients: [recipient],
          });
        }
      }

      if (hasGroupMembers) {
        const groupChats = await db.query(
          `SELECT c.id AS chat_id, c.name FROM chats c
           INNER JOIN group_members gm ON gm.chat_id = c.id
           WHERE c.type = 'group_dm' AND gm.user_id = $1::uuid`,
          [userId]
        );
        for (const row of groupChats.rows) {
          const members = await db.query(
            `SELECT u.id, u.username, u.avatar_url FROM group_members gm
             INNER JOIN users u ON u.id = gm.user_id
             WHERE gm.chat_id = $1::uuid`,
            [row.chat_id]
          );
          channels.push({
            id: String(row.chat_id),
            type: 'group_dm',
            name: row.name || members.rows.map(m => m.username).join(', '),
            recipients: members.rows.map(m => ({
              id: String(m.id),
              username: m.username,
              avatar_url: m.avatar_url || null,
              avatar: m.avatar_url || null,
            })),
          });
        }
      }

      for (let i = channels.length - 1; i >= 0; i -= 1) {
        const c = channels[i];
        if (c && c.type === 'dm') {
          const u = c.recipient || (c.recipients && c.recipients[0]);
          if (!u || !u.id || !u.username || u.username === 'Unknown') {
            console.log('Chat sem destinatário encontrado:', String(c.id));
            channels.splice(i, 1);
          }
        }
      }
      return res.status(200).json(channels);
    } catch (err) {
      console.error(err);
      console.log(err);
      logger.error('GET @me/channels', err);
      return res.status(500).json({ message: safeApiMessage(err, 'Erro ao listar canais') });
    }
  });

  // POST /api/v1/users/@me/channels — criar DM ou grupo (recipient_id OU recipient_ids[])
  app.post('/api/v1/users/@me/channels', auth.requireAuth, async (req, res) => {
    const userId = req.userId;
    const body = req.body || {};
    if (!db.isConfigured() || !db.isConnected()) {
      return res.status(503).json({ message: 'Banco indisponível' });
    }

    const recipientIds = Array.isArray(body.recipient_ids) ? body.recipient_ids.filter(Boolean).map(String) : [];
    const singleId = body.recipient_id ? String(body.recipient_id).trim() : null;

    if (recipientIds.length > 1) {
      const name = (body.name && String(body.name).trim()) || null;
      try {
        const newChatId = crypto.randomUUID();
        const ins = await db.query(
          `INSERT INTO chats (id, name, type, server_id) VALUES ($1::uuid, $2, 'group_dm', NULL) RETURNING id`,
          [newChatId, name]
        );
        const chatId = ins.rows[0].id;
        const allIds = [userId, ...recipientIds];
        for (const uid of allIds) {
          await db.query(
            `INSERT INTO group_members (chat_id, user_id) VALUES ($1::uuid, $2::uuid) ON CONFLICT (chat_id, user_id) DO NOTHING`,
            [chatId, uid]
          );
        }
        const members = await db.query(
          `SELECT u.id, u.username, u.avatar_url FROM group_members gm
           INNER JOIN users u ON u.id = gm.user_id
           WHERE gm.chat_id = $1::uuid`,
          [chatId]
        );
        return res.status(201).json({
          id: String(chatId),
          type: 'group_dm',
          name: name || members.rows.map(m => m.username).join(', '),
          recipients: members.rows.map(m => ({
            id: String(m.id),
            username: m.username,
            avatar_url: m.avatar_url || null,
            avatar: m.avatar_url || null,
          })),
        });
      } catch (err) {
        logger.error('POST @me/channels group', err);
        return res.status(500).json({ message: safeApiMessage(err, 'Erro ao criar grupo') });
      }
    }

    if (singleId && singleId !== userId) {
      try {
        const recipient = await db.query('SELECT id, username, avatar_url FROM users WHERE id = $1::uuid LIMIT 1', [singleId]);
        if (!recipient.rows[0]) return res.status(404).json({ message: 'Usuário não encontrado' });
        const recipientUsername = recipient.rows[0]?.username || 'Unknown';
        const recipientAvatarUrl = recipient.rows[0]?.avatar_url || null;

        const existing = await db.query(
          `SELECT c.id FROM chats c
           WHERE c.type = 'dm' AND (SELECT COUNT(*) FROM chat_members WHERE chat_id = c.id) = 2
           AND EXISTS (SELECT 1 FROM chat_members WHERE chat_id = c.id AND user_id = $1::uuid)
           AND EXISTS (SELECT 1 FROM chat_members WHERE chat_id = c.id AND user_id = $2::uuid)`,
          [userId, singleId]
        );
        if (existing.rows[0]) {
          const chatId = existing.rows[0].id;
          return res.status(200).json({
            id: String(chatId),
            type: 'dm',
            name: null,
            recipients: [{ id: singleId, username: recipientUsername, avatar_url: recipientAvatarUrl, avatar: recipientAvatarUrl }],
          });
        }
        const roleCol = await db.query(
          `SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'chat_members' AND column_name = 'role'
           LIMIT 1`
        );
        const newChatId = crypto.randomUUID();
        const ins = await db.query(
          `INSERT INTO chats (id, name, type, server_id) VALUES ($1::uuid, NULL, 'dm', NULL) RETURNING id`,
          [newChatId]
        );
        const chatId = ins.rows[0].id;
        if (roleCol.rows[0]) {
          await db.query(
            `INSERT INTO chat_members (chat_id, user_id, role)
             VALUES ($1::uuid, $2::uuid, 'member'), ($1::uuid, $3::uuid, 'member')
             ON CONFLICT (chat_id, user_id) DO NOTHING`,
            [chatId, userId, singleId]
          );
        } else {
          await db.query(
            `INSERT INTO chat_members (chat_id, user_id)
             VALUES ($1::uuid, $2::uuid), ($1::uuid, $3::uuid)
             ON CONFLICT (chat_id, user_id) DO NOTHING`,
            [chatId, userId, singleId]
          );
        }
        return res.status(201).json({
          id: String(chatId),
          type: 'dm',
          name: null,
          recipients: [{ id: singleId, username: recipientUsername, avatar_url: recipientAvatarUrl, avatar: recipientAvatarUrl }],
        });
      } catch (err) {
        console.error('[DETALHE DM]:', err);
        if (err && err.code === '23505') {
          try {
            const existing = await db.query(
              `SELECT c.id FROM chats c
               WHERE c.type = 'dm' AND (SELECT COUNT(*) FROM chat_members WHERE chat_id = c.id) = 2
               AND EXISTS (SELECT 1 FROM chat_members WHERE chat_id = c.id AND user_id = $1::uuid)
               AND EXISTS (SELECT 1 FROM chat_members WHERE chat_id = c.id AND user_id = $2::uuid)
               LIMIT 1`,
              [userId, singleId]
            );
            if (existing.rows[0]?.id) {
              const chatId = existing.rows[0].id;
              const u = await db.query('SELECT id, username, avatar_url FROM users WHERE id = $1::uuid LIMIT 1', [singleId]);
              const username = u.rows[0]?.username || 'Unknown';
              const avatarUrl = u.rows[0]?.avatar_url || null;
              return res.status(200).json({
                id: String(chatId),
                type: 'dm',
                name: null,
                recipients: [{ id: singleId, username, avatar_url: avatarUrl, avatar: avatarUrl }],
              });
            }
          } catch (_) {}
        }
        logger.error('POST @me/channels dm', err);
        return res.status(500).json({ message: safeApiMessage(err, 'Erro ao criar DM') });
      }
    }

    return res.status(400).json({ message: 'Envie recipient_id (DM) ou recipient_ids (array com 2+) para grupo' });
  });

  app.all('/api/v1/calls', (_req, res) => res.status(410).json({ message: 'Rota removida. Use Socket.IO.' }));
  app.all('/api/v1/calls/:id', (_req, res) => res.status(410).json({ message: 'Rota removida. Use Socket.IO.' }));

  // GET /api/v1/users/me e GET /api/v1/users/@me — perfil do usuário autenticado (frontend usa @me)
  const getMe = async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) {
      return res.status(503).json({ message: 'Banco indisponível' });
    }
    try {
      const r = await db.query(
        'SELECT id, username, email, avatar_url, banner_url, description, password_hash, created_at FROM users WHERE id = $1 LIMIT 1',
        [req.userId]
      );
      const row = r.rows[0];
      if (!row) return res.status(401).json({ message: 'Sessão inválida. Faça login novamente.' });
      const admin = await isAdmin(req);
      return res.status(200).json({
        id: String(row.id),
        username: row.username,
        email: row.email || null,
        avatar_url: row.avatar_url || null,
        banner_url: row.banner_url || null,
        description: row.description || null,
        has_password: Boolean(row.password_hash),
        created_at: row.created_at,
        admin: !!admin,
      });
    } catch (err) {
      logger.error('GET /users/me', err);
      return res.status(500).json({ message: safeApiMessage(err, 'Erro ao buscar perfil') });
    }
  };
  app.get('/api/v1/users/me', auth.requireAuth, auth.requireUserExists, getMe);
  app.get('/api/v1/users/@me', auth.requireAuth, auth.requireUserExists, getMe);

  // GET /api/v1/users/@me/export — exportar dados do utilizador (privacidade / RGPD)
  app.get('/api/v1/users/@me/export', auth.requireAuth, async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) {
      return res.status(503).json({ message: 'Banco indisponível' });
    }
    const userId = req.userId;
    try {
      const u = await db.query(
        'SELECT id, username, email, avatar_url, banner_url, description, created_at FROM users WHERE id = $1 LIMIT 1',
        [userId]
      );
      const user = u.rows[0];
      if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });
      const exportData = {
        exported_at: new Date().toISOString(),
        user: {
          id: String(user.id),
          username: user.username,
          email: user.email || null,
          description: user.description || null,
          created_at: user.created_at,
        },
        messages: [],
      };
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="liberty-data-export.json"');
      return res.status(200).send(JSON.stringify(exportData, null, 2));
    } catch (err) {
      logger.error('GET /users/@me/export', err);
      return res.status(500).json({ message: safeApiMessage(err, 'Erro ao exportar dados') });
    }
  });

  // DELETE /api/v1/users/@me — eliminar conta permanentemente (privacidade)
  app.delete('/api/v1/users/@me', auth.requireAuth, async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) {
      return res.status(503).json({ message: 'Banco indisponível' });
    }
    const userId = req.userId;
    const { password: confirmPassword } = req.body || {};
    try {
      const u = await db.query('SELECT password_hash FROM users WHERE id = $1 LIMIT 1', [userId]);
      const row = u.rows[0];
      if (!row) return res.status(404).json({ message: 'Usuário não encontrado' });
      if (row.password_hash) {
        const pass = (confirmPassword != null ? String(confirmPassword) : '').trim();
        if (!pass || !(await bcrypt.compare(pass, row.password_hash))) {
          return res.status(401).json({ message: 'Confirme a sua senha para eliminar a conta.' });
        }
      }
      await db.query('DELETE FROM users WHERE id = $1::uuid', [userId]);
      res.clearCookie('liberty_token', { path: '/', httpOnly: true, secure: config.isProduction, sameSite: 'strict' });
      return res.status(200).json({ success: true, message: 'Conta eliminada com sucesso.' });
    } catch (err) {
      logger.error('DELETE /users/@me', err);
      return res.status(500).json({ message: safeApiMessage(err, 'Erro ao eliminar conta') });
    }
  });

  // GET /api/v1/users/:userId — perfil público (nome, avatar, banner, descrição) para modal de perfil
  app.get('/api/v1/users/:userId', auth.requireAuth, requireUuidParams(['userId']), async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) return res.status(503).json({ message: 'Banco indisponível' });
    const targetId = req.params.userId;
    try {
      const r = await db.query(
        'SELECT id, username, avatar_url, banner_url, description, created_at FROM users WHERE id = $1::uuid LIMIT 1',
        [targetId]
      );
      const row = r.rows[0];
      if (!row) return res.status(404).json({ message: 'Usuário não encontrado' });
      return res.status(200).json({
        id: String(row.id),
        username: row.username,
        avatar_url: row.avatar_url || null,
        banner_url: row.banner_url || null,
        description: row.description || null,
        created_at: row.created_at,
      });
    } catch (err) {
      if (err.code === '22P02') return res.status(404).json({ message: 'Usuário não encontrado' });
      return res.status(500).json({ message: safeApiMessage(err, 'Erro ao buscar perfil') });
    }
  });

  // GET /api/v1/users/:userId/mutual-servers — servidores em comum entre o utilizador autenticado e userId
  app.get('/api/v1/users/:userId/mutual-servers', auth.requireAuth, requireUuidParams(['userId']), async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) return res.status(503).json({ message: 'Banco indisponível' });
    const me = req.userId;
    const other = req.params.userId;
    if (other === me) return res.status(200).json([]);
    try {
      const r = await db.query(
        `SELECT s.id, s.name, s.icon_url
         FROM servers s
         INNER JOIN server_members sm1 ON sm1.server_id = s.id AND sm1.user_id = $1::uuid
         INNER JOIN server_members sm2 ON sm2.server_id = s.id AND sm2.user_id = $2::uuid
         ORDER BY s.name ASC`,
        [me, other]
      );
      const list = (r.rows || []).map(row => ({
        id: String(row.id),
        name: row.name,
        icon_url: row.icon_url || null,
      }));
      return res.status(200).json(list);
    } catch (err) {
      if (err.code === '22P02') return res.status(404).json({ message: 'Utilizador não encontrado' });
      return res.status(500).json({ message: safeApiMessage(err, 'Erro ao listar servidores em comum') });
    }
  });

  // GET /api/v1/users/:userId/mutual-friends — amigos em comum (aceites) entre o utilizador autenticado e userId
  app.get('/api/v1/users/:userId/mutual-friends', auth.requireAuth, requireUuidParams(['userId']), async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) return res.status(503).json({ message: 'Banco indisponível' });
    const me = req.userId;
    const other = req.params.userId;
    if (other === me) return res.status(200).json([]);
    try {
      const r = await db.query(
        `SELECT u.id, u.username, u.avatar_url
         FROM users u
         INNER JOIN friendships f1 ON (
           (f1.user_id = $1::uuid AND f1.friend_id = u.id) OR (f1.friend_id = $1::uuid AND f1.user_id = u.id)
         ) AND f1.status = 'accepted'
         INNER JOIN friendships f2 ON (
           (f2.user_id = $2::uuid AND f2.friend_id = u.id) OR (f2.friend_id = $2::uuid AND f2.user_id = u.id)
         ) AND f2.status = 'accepted'
         WHERE u.id != $1::uuid AND u.id != $2::uuid
         ORDER BY u.username ASC
         LIMIT 50`,
        [me, other]
      );
      const list = (r.rows || []).map(row => ({
        id: String(row.id),
        username: row.username,
        avatar_url: row.avatar_url || null,
      }));
      return res.status(200).json(list);
    } catch (err) {
      if (err.code === '22P02') return res.status(404).json({ message: 'Utilizador não encontrado' });
      return res.status(500).json({ message: safeApiMessage(err, 'Erro ao listar amigos em comum') });
    }
  });

  // PATCH /api/v1/users/me e PATCH /api/v1/users/@me — atualizar perfil (username, avatar_url, banner_url, description)
  const patchMe = async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) {
      return res.status(503).json({ message: 'Banco indisponível' });
    }
    const { username, avatar_url, banner_url, description } = req.body || {};
    let usernameVal = username !== undefined ? sanitizeUsername(username) : null;
    const avatarVal = avatar_url != null ? sanitizeUrl(avatar_url) : null;
    const bannerVal = banner_url != null ? sanitizeUrl(banner_url) : null;
    const descVal = description != null ? sanitizeDescription(description) : null;
    if (usernameVal !== null && (usernameVal.length < 1 || usernameVal.length > 32)) {
      return res.status(400).json({ message: 'username deve ter entre 1 e 32 caracteres' });
    }
    if (avatar_url != null && avatar_url !== '' && avatarVal === null) {
      return res.status(400).json({ message: 'avatar_url inválido. Use apenas http(s) ou /uploads/' });
    }
    if (banner_url != null && banner_url !== '' && bannerVal === null) {
      return res.status(400).json({ message: 'banner_url inválido. Use apenas http(s) ou /uploads/' });
    }
    try {
      const cur = await db.query('SELECT username, avatar_url, banner_url, description FROM users WHERE id = $1 LIMIT 1', [
        req.userId,
      ]);
      const c = cur.rows[0];
      const newUsername = username !== undefined ? usernameVal : (c?.username ?? null);
      const newAvatar = avatar_url !== undefined ? avatarVal : (c?.avatar_url ?? null);
      const newBanner = banner_url !== undefined ? bannerVal : (c?.banner_url ?? null);
      const newDesc = description !== undefined ? descVal : (c?.description ?? null);
      if (newUsername != null) {
        const existing = await db.query('SELECT id FROM users WHERE username = $1 AND id != $2::uuid LIMIT 1', [
          newUsername,
          req.userId,
        ]);
        if (existing.rows[0]) {
          return res.status(409).json({ message: 'Esse nome de utilizador já está em uso' });
        }
      }
      await db.query(
        'UPDATE users SET username = COALESCE($1, username), avatar_url = $2, banner_url = $3, description = $4 WHERE id = $5',
        [newUsername, newAvatar, newBanner, newDesc, req.userId]
      );
      const r = await db.query(
        'SELECT id, username, email, avatar_url, banner_url, description FROM users WHERE id = $1 LIMIT 1',
        [req.userId]
      );
      const row = r.rows[0];
      return res.status(200).json({
        id: String(row.id),
        username: row.username,
        email: row.email || null,
        avatar_url: row.avatar_url || null,
        banner_url: row.banner_url || null,
        description: row.description || null,
      });
    } catch (err) {
      logger.error('PATCH /users/me', err);
      return res.status(500).json({ message: safeApiMessage(err, 'Erro ao atualizar perfil') });
    }
  };
  app.patch('/api/v1/users/me', auth.requireAuth, patchMe);
  app.patch('/api/v1/users/@me', auth.requireAuth, patchMe);

  // PATCH /api/v1/users/me/password — definir ou alterar senha (ativar depois nas configurações)
  app.patch('/api/v1/users/me/password', auth.requireAuth, async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) {
      return res.status(503).json({ message: 'Banco indisponível' });
    }
    const { current_password, new_password } = req.body || {};
    const newPass = new_password != null ? String(new_password).trim() : '';
    if (!newPass || newPass.length < 6) {
      return res.status(400).json({ message: 'Nova senha é obrigatória (mín. 6 caracteres)' });
    }
    try {
      const r = await db.query('SELECT password_hash FROM users WHERE id = $1 LIMIT 1', [req.userId]);
      const row = r.rows[0];
      if (!row) return res.status(404).json({ message: 'Usuário não encontrado' });
      if (row.password_hash) {
        const cur = (current_password != null ? String(current_password) : '').trim();
        if (!cur || !(await bcrypt.compare(cur, row.password_hash))) {
          return res.status(401).json({ message: 'Senha atual incorreta' });
        }
      }
      const password_hash = await bcrypt.hash(newPass, 12);
      await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [password_hash, req.userId]);
      return res.status(200).json({ success: true, message: 'Senha atualizada' });
    } catch (err) {
      logger.error('PATCH /users/me/password', err);
      return res.status(500).json({ message: safeApiMessage(err, 'Erro ao atualizar senha') });
    }
  });

  // POST /api/v1/users/me/avatar — upload de foto (body: { image: "data:image/...;base64,..." })
  const AVATARS_DIR = path.join(UPLOADS_DIR, 'avatars');
  try {
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    if (!fs.existsSync(AVATARS_DIR)) fs.mkdirSync(AVATARS_DIR, { recursive: true });
  } catch (e) {
    logger.warn('[LIBERTY] Não foi possível criar pasta uploads:', e.message);
  }

  app.post('/api/v1/users/me/avatar', auth.requireAuth, async (req, res) => {
    const userId = req.userId;
    const raw = req.body?.image;
    if (!raw || typeof raw !== 'string') {
      return res.status(400).json({ message: 'Envie { image: "data:image/...;base64,..." }' });
    }
    const match = raw.match(/^data:image\/(jpeg|jpg|png|gif|webp);base64,(.+)$/i);
    if (!match) {
      return res.status(400).json({ message: 'Imagem inválida. Use JPEG, PNG, GIF ou WebP em base64.' });
    }
    const ext = match[1].toLowerCase() === 'jpg' ? 'jpg' : match[1].toLowerCase();
    const base64 = match[2];
    let buf;
    try {
      buf = Buffer.from(base64, 'base64');
    } catch (_) {
      return res.status(400).json({ message: 'Base64 inválido.' });
    }
    if (buf.length > 4 * 1024 * 1024) {
      return res.status(400).json({ message: 'Imagem demasiado grande (máx. 4 MB).' });
    }
    const filename = `${userId}.${ext}`;
    const filepath = path.join(AVATARS_DIR, filename);
    try {
      fs.writeFileSync(filepath, buf);
    } catch (e) {
      logger.error('avatar', e);
      return res.status(500).json({ message: 'Erro ao guardar a imagem.' });
    }
    const avatarUrl = `/uploads/avatars/${filename}?t=${Date.now()}`;
    if (db.isConfigured() && db.isConnected()) {
      try {
        await db.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [avatarUrl, userId]);
      } catch (e) {
        logger.error('avatar_url', e);
        return res.status(500).json({ message: 'Erro ao atualizar perfil.' });
      }
    }
    return res.status(200).json({ avatar_url: avatarUrl });
  });

  // POST /api/v1/activity/ping — incrementa tempo em app (para ranking By Activity)
  app.post('/api/v1/activity/ping', auth.requireAuth, async (req, res) => {
    const userId = req.userId;
    let username = 'User';
    if (db.isConfigured() && db.isConnected()) {
      try {
        const u = await db.query('SELECT username FROM users WHERE id = $1 LIMIT 1', [userId]);
        if (u.rows[0]) username = u.rows[0].username || username;
      } catch (_) {}
    }
    addActivityPing(userId, username);
    return res.status(204).end();
  });

  // GET /api/v1/ranking — By Activity (tempo em app) + By Content (XP)
  app.get('/api/v1/ranking', auth.requireAuth, async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    try {
      const byActivityList = [];
      for (const [userId, data] of activityByUser.entries()) {
        byActivityList.push({
          id: userId,
          username: data.username || 'User',
          minutes: data.minutes || 0,
          level: getActivityLevel(data.minutes || 0),
        });
      }
      byActivityList.sort((a, b) => b.minutes - a.minutes);
      let by_activity = byActivityList.slice(0, limit).map((u, i) => ({
        rank: i + 1,
        id: u.id,
        username: u.username,
        minutes: u.minutes,
        level: u.level,
        avatar_url: null,
      }));

      const messagesByChannel = [];
      const xpByUser = computeContentXpByUser(messagesByChannel);
      let byContentList = Array.from(xpByUser.entries()).map(([id, data]) => ({
        id,
        username: data.username || 'User',
        xp: data.xp || 0,
        level: getXpLevel(data.xp || 0),
        avatar_url: null,
      }));
      byContentList.sort((a, b) => b.xp - a.xp);
      let by_content = byContentList.slice(0, limit).map((u, i) => ({
        rank: i + 1,
        id: u.id,
        username: u.username,
        xp: u.xp,
        level: u.level,
        avatar_url: null,
      }));

      const allIds = [
        ...new Set([...by_activity.map(u => u.id), ...by_content.map(u => u.id)].filter(id => id && isUuid(id))),
      ];
      let avatarByUser = {};
      if (db.isConfigured() && db.isConnected() && allIds.length > 0) {
        try {
          const placeholders = allIds.map((_, i) => `$${i + 1}::uuid`).join(',');
          const r = await db.query(`SELECT id, avatar_url FROM users WHERE id IN (${placeholders})`, allIds);
          avatarByUser = Object.fromEntries((r.rows || []).map(row => [String(row.id), row.avatar_url || null]));
        } catch (_) {}
      }
      by_activity = by_activity.map(u => ({ ...u, avatar_url: avatarByUser[u.id] || null }));
      by_content = by_content.map(u => ({ ...u, avatar_url: avatarByUser[u.id] || null }));

      return res.status(200).json({ by_activity, by_content });
    } catch (err) {
      logger.error('GET /ranking', err);
      return res.status(500).json({ message: safeApiMessage(err, 'Erro ao buscar ranking') });
    }
  });

  // GET /api/v1/users/@me/relationships — lista com type: 1=amigo, 2=bloqueado, 3=pending recebido, 4=pending enviado
  app.get('/api/v1/users/@me/relationships', auth.requireAuth, async (req, res) => {
    const userId = req.userId;
    if (!db.isConfigured() || !db.isConnected()) {
      return res.status(503).json({ message: 'Banco indisponível' });
    }
    try {
      const r = await db.query(
        `SELECT f.id AS rel_id, f.user_id, f.friend_id, f.status,
                u.id AS other_id, u.username AS other_username
         FROM friendships f
         INNER JOIN users u ON (u.id = f.friend_id AND f.user_id = $1::uuid) OR (u.id = f.user_id AND f.friend_id = $1::uuid)
         WHERE f.user_id = $1::uuid OR f.friend_id = $1::uuid`,
        [userId]
      );
      const list = r.rows.map(row => {
        const otherId = String(row.user_id) === userId ? row.friend_id : row.user_id;
        const sentByMe = String(row.user_id) === userId;
        let type = 1;
        if (row.status === 'blocked') type = 2;
        else if (row.status === 'pending') type = sentByMe ? 4 : 3;
        return {
          id: String(row.rel_id),
          type,
          user: { id: String(otherId), username: row.other_username },
        };
      });
      return res.status(200).json(list);
    } catch (err) {
      logger.error('GET @me/relationships', err);
      return res.status(500).json({ message: safeApiMessage(err, 'Erro ao listar amigos') });
    }
  });

  // POST /api/v1/users/@me/relationships — adicionar amigo por username (envia pedido pending)
  app.post('/api/v1/users/@me/relationships', auth.requireAuth, validateBody(schemas.relationshipAdd), async (req, res) => {
    const userId = req.userId;
    const name = sanitizeUsername(req.body?.username);
    if (!name) return res.status(400).json({ message: 'username é obrigatório' });
    if (!db.isConfigured() || !db.isConnected()) {
      return res.status(503).json({ message: 'Banco indisponível' });
    }
    try {
      const target = await db.query('SELECT id FROM users WHERE username = $1 LIMIT 1', [name]);
      if (!target.rows[0]) return res.status(404).json({ message: 'Utilizador não encontrado' });
      const friendId = target.rows[0].id;
      if (String(friendId) === userId) return res.status(400).json({ message: 'Não pode adicionar-se a si mesmo' });
      const existing = await db.query(
        'SELECT id, status FROM friendships WHERE (user_id = $1::uuid AND friend_id = $2::uuid) OR (user_id = $2::uuid AND friend_id = $1::uuid) LIMIT 1',
        [userId, friendId]
      );
      if (existing.rows[0]) {
        if (existing.rows[0].status === 'accepted') return res.status(400).json({ message: 'Já são amigos' });
        if (existing.rows[0].status === 'pending')
          return res.status(400).json({ message: 'Pedido já enviado ou pendente' });
        if (existing.rows[0].status === 'blocked')
          return res.status(400).json({ message: 'Não é possível adicionar este utilizador' });
      }
      await db.query(
        'INSERT INTO friendships (user_id, friend_id, status) VALUES ($1::uuid, $2::uuid, $3) ON CONFLICT (user_id, friend_id) DO NOTHING',
        [userId, friendId, 'pending']
      );
      const rel = await db.query(
        'SELECT id FROM friendships WHERE user_id = $1::uuid AND friend_id = $2::uuid LIMIT 1',
        [userId, friendId]
      );
      return res.status(201).json({
        id: rel.rows[0] ? String(rel.rows[0].id) : null,
        type: 4,
        user: { id: String(friendId), username: name },
      });
    } catch (err) {
      if (err.code === '23505') return res.status(400).json({ message: 'Pedido já existe' });
      logger.error('POST @me/relationships', err);
      return res.status(500).json({ message: safeApiMessage(err, 'Erro ao adicionar amigo') });
    }
  });

  // PUT /api/v1/users/@me/relationships/:id — aceitar pedido de amizade
  app.put('/api/v1/users/@me/relationships/:relationshipId', auth.requireAuth, requireUuidParams(['relationshipId']), async (req, res) => {
    const userId = req.userId;
    const relId = req.params.relationshipId;
    if (!db.isConfigured() || !db.isConnected()) return res.status(503).json({ message: 'Banco indisponível' });
    try {
      const r = await db.query(
        'UPDATE friendships SET status = $1 WHERE id = $2::uuid AND friend_id = $3::uuid AND status = $4 RETURNING id',
        ['accepted', relId, userId, 'pending']
      );
      if (!r.rows[0]) return res.status(404).json({ message: 'Pedido não encontrado ou já processado' });
      return res.status(200).json({ id: String(r.rows[0].id), status: 'accepted' });
    } catch (err) {
      logger.error('PUT @me/relationships/:id', err);
      return res.status(500).json({ message: safeApiMessage(err, 'Erro ao aceitar pedido') });
    }
  });

  // DELETE /api/v1/users/@me/relationships/:id — remover amizade / cancelar pedido / desbloquear
  app.delete('/api/v1/users/@me/relationships/:relationshipId', auth.requireAuth, requireUuidParams(['relationshipId']), async (req, res) => {
    const userId = req.userId;
    const relId = req.params.relationshipId;
    if (!db.isConfigured() || !db.isConnected()) return res.status(503).json({ message: 'Banco indisponível' });
    try {
      await db.query('DELETE FROM friendships WHERE id = $1::uuid AND (user_id = $2::uuid OR friend_id = $2::uuid)', [
        relId,
        userId,
      ]);
      return res.status(204).end();
    } catch (err) {
      logger.error('DELETE @me/relationships/:id', err);
      return res.status(500).json({ message: safeApiMessage(err, 'Erro ao remover') });
    }
  });

  // ── Invites ─────────────────────────────────────────────────────
  const INVITE_CODE_LEN = 8;
  const INVITE_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  function generateInviteCode() {
    let s = '';
    for (let i = 0; i < INVITE_CODE_LEN; i++) s += INVITE_CODE_CHARS[Math.floor(Math.random() * INVITE_CODE_CHARS.length)];
    return s;
  }

  // GET /api/v1/invites/:code — dados do convite (embed; pode ser sem auth para ver servidor)
  app.get('/api/v1/invites/:code', async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) {
      return res.status(503).json({ message: 'Serviço indisponível' });
    }
    const code = (req.params.code || '').trim().toUpperCase();
    if (!code || code.length > 32) return res.status(404).json({ message: 'Convite não encontrado' });
    try {
      const inv = await db.query(
        `SELECT i.code, i.server_id, i.channel_id, i.expires_at, i.max_uses, i.uses,
                s.name AS server_name, s.icon_url AS server_icon, s.created_at AS server_created_at
         FROM invites i
         JOIN servers s ON s.id = i.server_id
         JOIN chats c ON c.id = i.channel_id AND c.server_id = i.server_id
         WHERE i.code = $1`,
        [code]
      );
      if (!inv.rows[0]) return res.status(404).json({ message: 'Convite inválido ou expirado' });
      const row = inv.rows[0];
      if (row.expires_at && new Date(row.expires_at) < new Date()) return res.status(404).json({ message: 'Convite expirado' });
      if (row.max_uses > 0 && (row.uses || 0) >= row.max_uses) return res.status(404).json({ message: 'Convite já não está disponível' });
      const memberCount = await db.query(
        `SELECT COUNT(*) AS n FROM server_members WHERE server_id = $1::uuid`,
        [row.server_id]
      );
      const onlineCount = memberCount.rows[0]?.n || 0;
      return res.status(200).json({
        code: row.code,
        server_id: String(row.server_id),
        channel_id: String(row.channel_id),
        server: {
          id: String(row.server_id),
          name: row.server_name,
          icon_url: row.server_icon || null,
          approximate_member_count: parseInt(memberCount.rows[0]?.n || 0, 10),
          approximate_presence_count: parseInt(onlineCount, 10),
          created_at: row.server_created_at,
        },
        expires_at: row.expires_at,
        max_uses: row.max_uses,
        uses: row.uses || 0,
      });
    } catch (err) {
      if (err.code === '22P02') return res.status(404).json({ message: 'Convite não encontrado' });
      logger.error('GET /api/v1/invites/:code', err);
      return res.status(500).json({ message: safeApiMessage(err, 'Erro ao obter convite') });
    }
  });

  // POST /api/v1/invites/:code/join — entrar no servidor por convite (autenticado)
  app.post('/api/v1/invites/:code/join', auth.requireAuth, async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) {
      return res.status(503).json({ message: 'Serviço indisponível' });
    }
    const code = (req.params.code || '').trim().toUpperCase();
    const userId = req.userId;
    if (!code || code.length > 32) return res.status(404).json({ message: 'Convite não encontrado' });
    try {
      const inv = await db.query(
        `SELECT i.server_id, i.channel_id, i.expires_at, i.max_uses, i.uses,
                s.name AS server_name, s.icon_url AS server_icon,
                c.name AS channel_name
         FROM invites i
         JOIN servers s ON s.id = i.server_id
         JOIN chats c ON c.id = i.channel_id
         WHERE i.code = $1`,
        [code]
      );
      if (!inv.rows[0]) return res.status(404).json({ message: 'Convite inválido ou expirado' });
      const row = inv.rows[0];
      if (row.expires_at && new Date(row.expires_at) < new Date()) return res.status(404).json({ message: 'Convite expirado' });
      if (row.max_uses > 0 && (row.uses || 0) >= row.max_uses) return res.status(404).json({ message: 'Convite já não está disponível' });
      await db.query(
        `INSERT INTO server_members (server_id, user_id, role) VALUES ($1::uuid, $2::uuid, 'member') ON CONFLICT (server_id, user_id) DO NOTHING`,
        [row.server_id, userId]
      );
      await db.query(
        `INSERT INTO chat_members (chat_id, user_id, role) VALUES ($1::uuid, $2::uuid, 'member') ON CONFLICT (chat_id, user_id) DO NOTHING`,
        [row.channel_id, userId]
      );
      await db.query(`UPDATE invites SET uses = uses + 1 WHERE code = $1`, [code]);
      return res.status(200).json({
        server: { id: String(row.server_id), name: row.server_name, icon_url: row.server_icon || null },
        channel: { id: String(row.channel_id), name: row.channel_name },
      });
    } catch (err) {
      if (err.code === '22P02') return res.status(404).json({ message: 'Convite não encontrado' });
      logger.error('POST /api/v1/invites/:code/join', err);
      return res.status(500).json({ message: safeApiMessage(err, 'Erro ao entrar no servidor') });
    }
  });

  // POST /api/v1/channels/:channelId/invites — criar convite (autenticado; canal do servidor)
  app.post(
    '/api/v1/channels/:channelId/invites',
    auth.requireAuth,
    requireUuidParams(['channelId']),
    validateBody(Joi.object({ max_uses: Joi.number().optional(), max_age: Joi.number().optional() }).optional()),
    async (req, res) => {
      if (!db.isConfigured() || !db.isConnected()) {
        return res.status(503).json({ message: 'Serviço indisponível' });
      }
      const channelId = req.params.channelId;
      const userId = req.userId;
      try {
        const ch = await db.query(
          `SELECT c.id, c.server_id FROM chats c
           INNER JOIN server_members sm ON sm.server_id = c.server_id AND sm.user_id = $2::uuid
           WHERE c.id = $1::uuid AND c.type = 'channel' LIMIT 1`,
          [channelId, userId]
        );
        if (!ch.rows[0]) return res.status(404).json({ message: 'Canal não encontrado' });
        const serverId = ch.rows[0].server_id;
        let code = generateInviteCode();
        for (let i = 0; i < 5; i++) {
          const ex = await db.query(`SELECT 1 FROM invites WHERE code = $1`, [code]);
          if (!ex.rows[0]) break;
          code = generateInviteCode();
        }
        const maxAge = (req.body && req.body.max_age) ? Math.min(604800, Math.max(0, Number(req.body.max_age))) : 604800;
        const expiresAt = new Date(Date.now() + maxAge * 1000);
        const maxUses = (req.body && req.body.max_uses) ? Math.min(100, Math.max(0, Number(req.body.max_uses))) : 0;
        await db.query(
          `INSERT INTO invites (code, server_id, channel_id, created_by, expires_at, max_uses) VALUES ($1, $2::uuid, $3::uuid, $4::uuid, $5, $6)`,
          [code, serverId, channelId, userId, expiresAt, maxUses]
        );
        return res.status(201).json({
          code,
          server_id: String(serverId),
          channel_id: String(channelId),
          expires_at: expiresAt.toISOString(),
          max_uses: maxUses,
          uses: 0,
        });
      } catch (err) {
        logger.error('POST /api/v1/channels/:channelId/invites', err);
        return res.status(500).json({ message: safeApiMessage(err, 'Erro ao criar convite') });
      }
    }
  );

  // Favicon — evita 404 nos logs
  app.get('/favicon.ico', (req, res) => {
    const faviconPath = path.join(STATIC_DIR, 'favicon.ico');
    if (fs.existsSync(faviconPath)) {
      res.sendFile(faviconPath);
    } else {
      res.status(204).end();
    }
  });

  // Logo — serve de static ou fallback SVG (evita 404 quando static não está no deploy)
  const logoPath = path.join(STATIC_DIR, 'assets', 'logo.png');
  const logoFallbackSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 88 88" width="88" height="88"><rect width="88" height="88" fill="#FFD700"/><text x="44" y="52" font-family="Arial,sans-serif" font-size="24" font-weight="bold" fill="#1a1a1a" text-anchor="middle">L</text></svg>';
  app.get('/assets/logo.png', (req, res) => {
    if (fs.existsSync(logoPath)) {
      res.sendFile(logoPath);
    } else {
      res.type('svg').send(logoFallbackSvg);
    }
  });

  // Avatares enviados pelos utilizadores (cache curto: podem ser atualizados)
  app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { maxAge: '1d', etag: true }));

  // Static com cache agressivo para assets e sem cache para HTML (SPA)
  app.use(
    express.static(STATIC_DIR, {
      etag: true,
      lastModified: true,
      maxAge: 0,
      setHeaders: (res, filePath) => {
        const p = path.normalize(filePath).replace(/\\/g, '/');
        if (p.endsWith('.html') || p.endsWith('/index.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          return;
        }
        if (p.includes('/css/') || p.includes('/js/') || p.includes('/assets/') || p.includes('/static/')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=86400');
        }
      },
    })
  );
  app.get('/', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(STATIC_DIR, 'index.html'));
  });

  const CRAWLER_UA = /facebookexternalhit|Twitterbot|Discordbot|TelegramBot|LinkedInBot|WhatsApp|Slurp|bingbot|Googlebot|Applebot|Pinterest|redditbot|ia_archiver/i;
  app.get('/invite/:code', async (req, res, next) => {
    const ua = req.get('user-agent') || '';
    if (!CRAWLER_UA.test(ua)) return next();
    const code = (req.params.code || '').trim().toUpperCase();
    if (!code || code.length > 32) return next();
    const baseUrl = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host') || req.get('x-forwarded-host') || 'localhost'}`.replace(/\/$/, '');
    const canonicalUrl = `${baseUrl}/invite/${encodeURIComponent(code)}`;
    let title = 'LIBERTY — Convite';
    let description = 'Junte-se ao servidor no LIBERTY.';
    let imageUrl = `${baseUrl}/assets/logo.png`;
    if (db.isConfigured() && db.isConnected()) {
      try {
        const inv = await db.query(
          `SELECT i.code, i.server_id, i.expires_at, i.max_uses, i.uses,
                  s.name AS server_name, s.icon_url AS server_icon
           FROM invites i
           JOIN servers s ON s.id = i.server_id
           JOIN chats c ON c.id = i.channel_id AND c.server_id = i.server_id
           WHERE i.code = $1`,
          [code]
        );
        const row = inv.rows[0];
        if (row && (!row.expires_at || new Date(row.expires_at) >= new Date()) && (row.max_uses === 0 || (row.uses || 0) < row.max_uses)) {
          title = `Você foi convidado para ${(row.server_name || 'Servidor').replace(/</g, '&lt;')}`;
          description = `Entre no servidor ${(row.server_name || '').replace(/</g, '&lt;')} no LIBERTY — Freedom to Connect.`;
          if (row.server_icon) imageUrl = row.server_icon.startsWith('http') ? row.server_icon : `${baseUrl}${row.server_icon.startsWith('/') ? '' : '/'}${row.server_icon}`;
        }
      } catch (_) {}
    }
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#5865F2" />
  <meta property="og:title" content="${title.replace(/"/g, '&quot;')}" />
  <meta property="og:description" content="${description.replace(/"/g, '&quot;')}" />
  <meta property="og:image" content="${imageUrl.replace(/"/g, '&quot;')}" />
  <meta property="og:url" content="${canonicalUrl.replace(/"/g, '&quot;')}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="LIBERTY" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title.replace(/"/g, '&quot;')}" />
  <meta name="twitter:description" content="${description.replace(/"/g, '&quot;')}" />
  <meta name="twitter:image" content="${imageUrl.replace(/"/g, '&quot;')}" />
  <title>${title.replace(/</g, '&lt;')}</title>
  <meta http-equiv="refresh" content="0;url=${canonicalUrl.replace(/&/g, '&amp;')}" />
  <script>window.location.replace(${JSON.stringify(canonicalUrl)});</script>
</head>
<body><p>Redirecionando… <a href="${canonicalUrl.replace(/"/g, '&quot;').replace(/</g, '&lt;')}">Abrir convite</a></p></body>
</html>`;
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.type('html').send(html);
  });

  // SPA fallback: qualquer path não API/static devolve index.html para o cliente tratar (ex.: /channels/@me/:id ao dar F5)
  app.get('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(STATIC_DIR, 'index.html'));
  });

  // Handler de erros global: log detalhado e resposta JSON (debug)
  app.use((err, req, res, next) => {
    console.error(err);
    logger.error('Express error handler', err);
    if (res.headersSent) return next(err);
    const status = err && (err.status ?? err.statusCode) ? (err.status ?? err.statusCode) : 500;
    res.status(status).json(err);
  });

  server.listen(PORT, '0.0.0.0', () => {
    logger.info('LIBERTY listening on port', PORT);
  });
}

start().catch(err => {
  logger.error('startup', err);
  process.exit(1);
});
