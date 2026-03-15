// VERSION: CACHE_V1_STABLE
// dotenv: não sobrescreve variáveis já definidas pelo host (ex.: Square Cloud)
import dotenv from 'dotenv';
dotenv.config({ override: false });
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import http from 'http';
import express from 'express';
import helmet from 'helmet';
import bcrypt from 'bcrypt';
import { Server as SocketIOServer } from 'socket.io';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import WebSocket, { WebSocketServer } from 'ws';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Cache de mensagens: memória ou Redis (REDIS_URL); persistência no DB garante segurança
import messageCacheModule from './message-cache.js';
const getCachedMessages = messageCacheModule.getCachedMessages;
const setCachedMessages = messageCacheModule.setCachedMessages;
const addCachedMessage = messageCacheModule.addCachedMessage;
const getAllMessageLists = messageCacheModule.getAllMessageLists;
const MAX_CACHE_PER_CHANNEL = messageCacheModule.MAX_CACHE_PER_CHANNEL;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(s) {
  return typeof s === 'string' && UUID_REGEX.test(s.trim());
}

/**
 * Garante que a mensagem existe no banco. Se não existir, insere.
 * Usa id da mensagem para evitar duplicados (ON CONFLICT DO NOTHING).
 */
async function ensureMessageInDb(msg, chatId) {
  if (!msg || !chatId || !db.isConfigured() || !db.isConnected()) return;
  const id = msg.id || msg.message_id;
  if (!id || !isUuid(id)) return;
  const dbChatId = isUuid(chatId) ? chatId : null;
  if (!dbChatId) return;
  const userId = msg.author_id && isUuid(String(msg.author_id)) ? msg.author_id : null;
  const content = String(msg.content || '').trim();
  if (!content) return;
  const createdAt = msg.created_at instanceof Date ? msg.created_at : new Date(msg.created_at || Date.now());
  try {
    await db.query(
      `INSERT INTO messages (id, chat_id, user_id, content, created_at, updated_at)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [id, dbChatId, userId, content, createdAt, createdAt]
    );
  } catch (err) {
    console.warn('[LIBERTY] ensureMessageInDb:', err.message);
  }
}

/**
 * Carrega mensagens do banco para um chat e devolve no formato da API.
 * Usado quando o cache está vazio (ex.: após restart) para repopular.
 */
async function loadMessagesFromDb(chatId, limit = 300) {
  if (!chatId || !isUuid(chatId) || !db.isConfigured() || !db.isConnected()) return [];
  try {
    const r = await db.query(
      `SELECT m.id, m.chat_id, m.user_id, m.content, m.created_at, u.username, u.avatar_url
       FROM messages m
       LEFT JOIN users u ON u.id = m.user_id
       WHERE m.chat_id = $1::uuid
       ORDER BY m.created_at ASC
       LIMIT $2`,
      [chatId, limit]
    );
    const rows = r.rows || [];
    return rows.map((row) => ({
      id: String(row.id),
      chat_id: String(row.chat_id),
      content: row.content || '',
      author_id: row.user_id ? String(row.user_id) : null,
      author_username: row.username || 'User',
      author: row.username || 'User',
      username: row.username || 'User',
      avatar_url: row.avatar_url || null,
      created_at: row.created_at,
    }));
  } catch (err) {
    console.warn('[LIBERTY] loadMessagesFromDb:', err.message);
    return [];
  }
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
      cur.xp += (msg.content && msg.content.length) ? msg.content.length : 0;
      if (msg.author_username) cur.username = msg.author_username;
      if (msg.author && typeof msg.author === 'string') cur.username = msg.author;
      byUser.set(id, cur);
    }
  }
  return byUser;
}

// --- db (inline para deploy sem pasta db/)
// Usa env (DATABASE_URL, BANCO_DADOS, DB_URL) ou, se não definida, esta URL embutida (Neon).
// O parâmetro channel_binding=require é removido na conexão.
const EMBEDDED_DATABASE_URL = 'postgresql://neondb_owner:npg_z2MNWjJgXSB7@ep-icy-art-ameh1o7b-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

function _dbGetUrl() {
  const url = process.env.DATABASE_URL || process.env.BANCO_DADOS || process.env.DB_URL || EMBEDDED_DATABASE_URL || '';
  return typeof url === 'string' ? url.trim() : '';
}
function _dbLoadMtlsOptions() {
  try {
    const CERT_PATH = path.join(__dirname, 'certificate.pem');
    const raw = fs.readFileSync(CERT_PATH, 'utf8');
    const keyMatch = raw.match(/-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA )?PRIVATE KEY-----/);
    const certMatch = raw.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/);
    if (!keyMatch || !certMatch) return null;
    return { rejectUnauthorized: false, key: keyMatch[0], cert: certMatch[0] };
  } catch {
    return null;
  }
}
let _dbPool = null;
let _dbConnected = false;
async function _dbConnect() {
  let rawUrl = _dbGetUrl();
  if (!rawUrl || !rawUrl.startsWith('postgres')) {
    console.warn('[LIBERTY] DATABASE_URL não definida — banco desativado');
    return null;
  }
  // Neon: remover channel_binding=require (causa falha em muitos ambientes Node)
  if (rawUrl.includes('channel_binding=require')) {
    rawUrl = rawUrl.replace(/&channel_binding=require/g, '').replace(/\?channel_binding=require&?/g, '?').replace(/\?&/, '?');
  }
  if (!_dbPool) {
    const isLocalhost = /@localhost[\s:]|@127\.0\.0\.1[\s:]/.test(rawUrl);
    const isNeon = /\.neon\.tech\//.test(rawUrl);
    const poolConfig = { connectionString: rawUrl, max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 15000 };
    if (!isLocalhost) {
      const mtls = _dbLoadMtlsOptions();
      poolConfig.ssl = mtls || (isNeon ? { rejectUnauthorized: false } : { rejectUnauthorized: true });
    }
    _dbPool = new Pool(poolConfig);
  }
  const tryConnect = async () => {
    const client = await _dbPool.connect();
    await client.query('SELECT 1');
    client.release();
  };
  try {
    await tryConnect();
    _dbConnected = true;
    console.log('[LIBERTY] PostgreSQL conectado');
    return _dbPool;
  } catch (err) {
    console.warn('[LIBERTY] PostgreSQL primeira tentativa:', err.message);
    _dbConnected = false;
    await new Promise((r) => setTimeout(r, 2500));
    try {
      await tryConnect();
      _dbConnected = true;
      console.log('[LIBERTY] PostgreSQL conectado (2ª tentativa)');
      return _dbPool;
    } catch (err2) {
      console.warn('[LIBERTY] PostgreSQL indisponível:', err2.message);
      _dbConnected = false;
      return null;
    }
  }
}
const db = {
  query(text, params) {
    if (!_dbPool) throw new Error('Banco não configurado. Defina DATABASE_URL.');
    return _dbPool.query(text, params);
  },
  connect: _dbConnect,
  isConfigured: () => Boolean(_dbGetUrl()),
  isConnected: () => _dbConnected && _dbPool,
  getPool: () => _dbPool,
  /** Tenta conectar se configurado mas ainda não conectado (útil após cold start). */
  async ensureConnected() {
    if (!_dbGetUrl()) return false;
    if (_dbConnected && _dbPool) return true;
    await _dbConnect();
    return _dbConnected && _dbPool;
  },
};

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
  const sql = LIBERTY_SCHEMA_SQL.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '').trim();
  const statements = sql.split(';').map((s) => s.trim()).filter(Boolean);
  let applied = 0;
  for (const stmt of statements) {
    if (!stmt.toUpperCase().startsWith('CREATE')) continue;
    try {
      await db.query(stmt + ';');
      applied++;
    } catch (err) {
      if (err.code === '42P07') applied++;
      else console.warn('[LIBERTY] Schema statement falhou:', err.message, '\n', stmt.slice(0, 60) + '...');
    }
  }
  try {
    await db.query(`ALTER TABLE chats DROP CONSTRAINT IF EXISTS chats_type_check`);
    await db.query(`ALTER TABLE chats ADD CONSTRAINT chats_type_check CHECK (type IN ('channel', 'dm', 'group_dm', 'category'))`);
  } catch (err) {
    if (err.code !== '42704' && err.code !== '42P01') console.warn('[LIBERTY] Migração chats_type_check:', err.message);
  }
  try {
    await db.query(`ALTER TABLE chats ADD COLUMN parent_id UUID REFERENCES chats(id) ON DELETE SET NULL`);
  } catch (err) {
    if (err.code !== '42701') console.warn('[LIBERTY] Migração chats.parent_id:', err.message);
  }
  try {
    await db.query(`ALTER TABLE chats ADD COLUMN channel_type VARCHAR(20) DEFAULT 'text'`);
  } catch (err) {
    if (err.code !== '42701') console.warn('[LIBERTY] Migração chats.channel_type:', err.message);
  }
  try {
    await db.query(`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`);
  } catch (err) {
    if (err.code !== '42701') console.warn('[LIBERTY] Migração users.password_hash:', err.message);
  }
  try {
    await db.query(`ALTER TABLE users ALTER COLUMN email DROP NOT NULL`);
  } catch (err) {
    if (err.code !== '42701') console.warn('[LIBERTY] Migração users.email:', err.message);
  }
  try {
    await db.query(`ALTER TABLE users ADD COLUMN avatar_url TEXT`);
  } catch (err) {
    if (err.code !== '42701') console.warn('[LIBERTY] Migração users.avatar_url:', err.message);
  }
  try {
    await db.query(`ALTER TABLE servers ADD COLUMN icon_url TEXT`);
  } catch (err) {
    if (err.code !== '42701') console.warn('[LIBERTY] Migração servers.icon_url:', err.message);
  }
  try {
    await db.query(`ALTER TABLE users ADD COLUMN banner_url TEXT`);
  } catch (err) {
    if (err.code !== '42701') console.warn('[LIBERTY] Migração users.banner_url:', err.message);
  }
  try {
    await db.query(`ALTER TABLE users ADD COLUMN description TEXT`);
  } catch (err) {
    if (err.code !== '42701') console.warn('[LIBERTY] Migração users.description:', err.message);
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
    if (err.code !== '42P07') console.warn('[LIBERTY] Migração message_pins:', err.message);
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
    if (err.code !== '42P07') console.warn('[LIBERTY] Migração server_bans:', err.message);
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
    if (err.code !== '42P07') console.warn('[LIBERTY] Migração server_members:', err.message);
  }
  console.log('[LIBERTY] Schema PostgreSQL aplicado (' + applied + ' statements)');
}

const ADMIN_USERNAMES = ['zerk', 'noeb'];
async function isAdmin(req) {
  if (!req.userId) return false;
  try {
    const r = await db.query('SELECT username FROM users WHERE id = $1::uuid LIMIT 1', [req.userId]);
    const u = (r.rows[0]?.username || '').trim().toLowerCase();
    return ADMIN_USERNAMES.includes(u);
  } catch (_) {
    return false;
  }
}

function isOfficialLibertyServer(row) {
  if (!row) return false;
  const name = (row.name || '').trim();
  return name.toLowerCase() === 'liberty' && (row.owner_id == null || row.owner_id === '');
}

// --- auth (inline para deploy sem auth.js)
const _authSecret = process.env.JWT_SECRET || 'dev-secret-mudar-depois';
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.warn('[AUTH] Defina JWT_SECRET em produção.');
}
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
  middleware(req, res, next) {
    const header = req.headers.authorization;
    const bearerToken = header && header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    const xToken = (req.headers['x-auth-token'] || req.headers['X-Auth-Token'] || '').trim() || null;
    const cookieToken = (req.cookies && req.cookies.liberty_token) || null;
    const bodyToken = (req.body && (req.body.token || req.body.access_token)) ? String(req.body.token || req.body.access_token).trim() : null;
    const queryToken = (req.query && (req.query.token || req.query.access_token)) ? String(req.query.token || req.query.access_token).trim() : null;
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
};

// --- ws (inline para deploy sem ws.js)
const _wsSubscriptions = new Map();
const _wsUserConnections = new Map();
function _wsAddUserConnection(userId, ws) {
  if (!userId) return;
  let set = _wsUserConnections.get(userId);
  if (!set) { set = new Set(); _wsUserConnections.set(userId, set); }
  set.add(ws);
}
function _wsRemoveUserConnection(userId, ws) {
  const set = _wsUserConnections.get(userId);
  if (set) { set.delete(ws); if (set.size === 0) _wsUserConnections.delete(userId); }
}
function _wsSubscribe(chatId, ws) {
  if (!chatId) return;
  let set = _wsSubscriptions.get(chatId);
  if (!set) { set = new Set(); _wsSubscriptions.set(chatId, set); }
  set.add(ws);
}
function _wsUnsubscribe(chatId, ws) {
  const set = _wsSubscriptions.get(chatId);
  if (set) { set.delete(ws); if (set.size === 0) _wsSubscriptions.delete(chatId); }
}
function _wsUnsubscribeAll(ws) {
  _wsSubscriptions.forEach((set) => set.delete(ws));
}
function _wsSendToUser(userId, payload) {
  const set = _wsUserConnections.get(userId);
  if (!set) return;
  const str = typeof payload === 'string' ? payload : JSON.stringify(payload);
  set.forEach((c) => { if (c.readyState === WebSocket.OPEN) c.send(str); });
}
function _wsEmitToRoom(roomId, payload) {
  if (!roomId) return;
  const str = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const set = _wsSubscriptions.get(roomId);
  if (set) set.forEach((c) => { if (c.readyState === WebSocket.OPEN) c.send(str); });
}
const ws = {
  emitMessage(message) {
    const payload = JSON.stringify({ type: 'message', data: message });
    _wsEmitToRoom(message.chat_id, payload);
    if (message.channel_id && message.channel_id !== message.chat_id) _wsEmitToRoom(message.channel_id, payload);
  },
  attach(server) {
    const wss = new WebSocketServer({ server, path: '/ws' });
    wss.on('connection', (wsClient, req) => {
      const url = new URL(req.url || '', 'http://localhost');
      const token = url.searchParams.get('token') || (req.headers['sec-websocket-protocol'] && req.headers['sec-websocket-protocol'].split(',').map(s => s.trim())[0]);
      const payload = token ? auth.verify(token) : null;
      const userId = payload ? payload.sub : null;
      wsClient.userId = userId;
      wsClient.subscribedChats = new Set();
      _wsAddUserConnection(userId, wsClient);
      wsClient.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          const type = msg.type || msg.op;
          const d = msg.d || msg;
          const chatId = msg.chat_id || d.chat_id;
          if (type === 'subscribe' && chatId) {
            wsClient.subscribedChats.add(chatId);
            _wsSubscribe(chatId, wsClient);
          } else if (type === 'unsubscribe' && chatId) {
            wsClient.subscribedChats.delete(chatId);
            _wsUnsubscribe(chatId, wsClient);
          } else if (type === 'webrtc_offer' || type === 'webrtc_answer' || type === 'webrtc_ice') {
            const target = msg.target_user_id || msg.to || d.target_user_id;
            const payload = msg.payload !== undefined ? msg.payload : d.payload;
            if (target && payload !== undefined) _wsSendToUser(target, { type, from_user_id: userId, payload });
          } else if (type === 'webrtc_reject') {
            const target = msg.target_user_id || msg.to || d.target_user_id;
            if (target) _wsSendToUser(target, { type: 'webrtc_reject', from_user_id: userId });
          } else if (type === 'stream_started') {
            const target = msg.target_user_id || msg.to || d.target_user_id;
            if (target) _wsSendToUser(target, { type: 'stream_started', from_user_id: userId, stream_type: msg.stream_type || d.stream_type || 'screen' });
          } else if (type === 'stream_stopped') {
            const target = msg.target_user_id || msg.to || d.target_user_id;
            if (target) _wsSendToUser(target, { type: 'stream_stopped', from_user_id: userId });
          }
        } catch (_) {}
      });
      wsClient.on('close', () => {
        _wsRemoveUserConnection(userId, wsClient);
        wsClient.subscribedChats.forEach((chatId) => _wsUnsubscribe(chatId, wsClient));
        _wsUnsubscribeAll(wsClient);
      });
    });
    return wss;
  },
  subscribe: _wsSubscribe,
  unsubscribe: _wsUnsubscribe,
};

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const STATIC_DIR = path.join(__dirname, 'static');

// CSP: Socket.io servido localmente; conexões wss/ws permitidas; imagens externas (avatar URL)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'sha256-iNdzJueCLgGX4W5su4mORbOameseXUZO+P+Hm0wFzX0='"],
      connectSrc: ["'self'", "wss:", "ws:"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(express.json({ limit: '5mb' }));
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
      const insServer = await db.query(
        `INSERT INTO servers (name) VALUES ($1) RETURNING id`,
        ['Global Server']
      );
      serverId = insServer.rows[0].id;
    }

    // Cria o chat padrão
    const insChat = await db.query(
      `INSERT INTO chats (name, type, server_id)
       VALUES ($1, 'channel', $2)
       RETURNING id`,
      ['global-chat', serverId]
    );
    defaultChatId = String(insChat.rows[0].id);
    return defaultChatId;
  } catch (err) {
    console.error('[MESSAGES] Erro ao garantir chat padrão:', err.message);
    return null;
  }
}

async function start() {
  const dbUrl = _dbGetUrl();
  if (dbUrl && dbUrl.startsWith('postgres')) {
    console.log('[LIBERTY] DATABASE_URL definida (' + dbUrl.length + ' chars). Conectando…');
    try {
      await db.connect();
      if (db.isConnected()) {
        await dbInit();
      } else {
        console.warn('[LIBERTY] Primeira conexão falhou; será tentado de novo na primeira requisição.');
      }
    } catch (err) {
      console.warn('[LIBERTY] Banco na subida:', err.message);
    }
  } else {
    console.warn('[LIBERTY] DATABASE_URL não definida (valor atual: ' + (dbUrl ? dbUrl.length + ' chars' : 'vazio') + '). Defina no painel: Square Cloud → Configurações → Environment.');
  }

  ws.attach(server);
  const io = new SocketIOServer(server, {
    path: '/socket.io',
    cors: { origin: '*' },
    transports: ['websocket', 'polling'],
    allowEIO3: true,
  });
  app.locals.io = io;
  app.locals.emitMessage = function (message) {
    ws.emitMessage(message);
    if (message) {
      const payload = { type: 'message', data: message };
      if (message.chat_id) io.to(message.chat_id).emit('message', payload);
      if (message.channel_id && message.channel_id !== message.chat_id) io.to(message.channel_id).emit('message', payload);
    }
  };

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    const payload = token ? auth.verify(token) : null;
    socket.userId = payload ? payload.sub : null;
    next();
  });
  io.on('connection', (socket) => {
    socket.on('subscribe', (payload) => {
      const chatId = payload && (payload.chat_id || payload.chatId);
      if (chatId) socket.join(chatId);
    });
    socket.on('unsubscribe', (payload) => {
      const chatId = payload && (payload.chat_id || payload.chatId);
      if (chatId) socket.leave(chatId);
    });
  });

  // Garantir servidor 'Liberty' ownerless (owner_id NULL) e canal padrão
  async function ensureLibertyServer() {
    if (!db.isConnected()) return null;
    const existing = await db.query(`SELECT id FROM servers WHERE name = $1 LIMIT 1`, ['Liberty']);
    if (existing.rows[0]?.id) return String(existing.rows[0].id);
    const ins = await db.query(
      `INSERT INTO servers (name, owner_id) VALUES ($1, NULL) RETURNING id`,
      ['Liberty']
    );
    const serverId = ins.rows[0].id;
    await db.query(
      `INSERT INTO chats (name, type, server_id) VALUES ('general', 'channel', $1::uuid) RETURNING id`,
      [serverId]
    );
    return String(serverId);
  }

  async function ensureUserInLibertyServer(userId) {
    if (!db.isConnected()) return;
    const serverRow = await db.query(`SELECT id FROM servers WHERE name = $1 LIMIT 1`, ['Liberty']);
    const serverId = serverRow.rows[0]?.id;
    if (!serverId) return;
    const chatRow = await db.query(
      `SELECT id FROM chats WHERE server_id = $1::uuid AND type = 'channel' LIMIT 1`,
      [serverId]
    );
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
      console.error('[MESSAGES] getChatIdForServerAndChannel:', err.message);
      return getDefaultChatId();
    }
  }

  // Registro: apenas username obrigatório; email e senha opcionais (senha pode ser definida depois nas configurações)
  app.post('/api/v1/auth/register', async (req, res) => {
    if (!db.isConfigured()) {
      return res.status(503).json({ message: 'Banco de dados indisponível. Defina DATABASE_URL no ambiente.' });
    }
    const ok = await db.ensureConnected();
    if (!ok) {
      return res.status(503).json({ message: 'Banco de dados indisponível. Tente mais tarde.' });
    }

    const { username, email, password } = req.body || {};
    const name = username ? String(username).trim() : '';
    if (!name || name.length < 2) {
      return res.status(400).json({ message: 'username é obrigatório (mín. 2 caracteres)' });
    }

    try {
      await ensureLibertyServer();
      const emailVal = email && String(email).trim() ? String(email).trim().toLowerCase() : null;
      const password_hash = password && String(password).trim()
        ? await bcrypt.hash(String(password).trim(), 10)
        : null;
      const r = await db.query(
        `INSERT INTO users (username, email, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, username, email, created_at`,
        [name, emailVal, password_hash]
      );
      const row = r.rows[0];
      const user = { id: String(row.id), username: row.username, email: row.email, has_password: Boolean(password_hash) };
      await ensureUserInLibertyServer(row.id);
      const access_token = auth.sign(user);
      res.cookie('liberty_token', access_token, {
        path: '/',
        maxAge: 90 * 24 * 60 * 60 * 1000,
        sameSite: 'lax',
        httpOnly: false,
      });

      return res.status(201).json({
        success: true,
        user,
        access_token,
        refresh_token: access_token,
      });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ message: 'Nome de usuário (ou email) já em uso' });
      }
      console.error('[API] register', err.message);
      return res.status(500).json({ message: err.message || 'Erro ao criar conta' });
    }
  });

  // Refresh: valida o token e devolve access_token + user (para o front não voltar ao login ao recarregar)
  app.post('/api/v1/auth/refresh', async (req, res) => {
    const token = (req.body && (req.body.refresh_token || req.body.token || req.body.access_token)) ? String(req.body.refresh_token || req.body.token || req.body.access_token).trim() : null;
    if (!token) {
      return res.status(401).json({ message: 'Token ausente' });
    }
    const payload = auth.verify(token);
    if (!payload || !payload.sub) {
      return res.status(401).json({ message: 'Token inválido ou expirado' });
    }
    try {
      const r = await db.query(
        `SELECT id, username, email FROM users WHERE id = $1::uuid LIMIT 1`,
        [payload.sub]
      );
      const row = r.rows[0];
      if (!row) {
        return res.status(401).json({ message: 'Usuário não encontrado' });
      }
      const user = { id: String(row.id), username: row.username, email: row.email, has_password: Boolean(row.password_hash) };
      const access_token = auth.sign(user);
      res.cookie('liberty_token', access_token, {
        path: '/',
        maxAge: 90 * 24 * 60 * 60 * 1000,
        sameSite: 'lax',
        httpOnly: false,
      });
      return res.status(200).json({
        access_token,
        refresh_token: access_token,
        user,
      });
    } catch (err) {
      console.error('[API] refresh', err.message);
      return res.status(500).json({ message: err.message || 'Erro ao renovar sessão' });
    }
  });

  // Login: username obrigatório; senha opcional (se usuário não tiver senha, login só com username)
  app.post('/api/v1/auth/login', async (req, res) => {
    if (!db.isConfigured()) {
      return res.status(503).json({ message: 'Banco de dados indisponível. Defina DATABASE_URL no ambiente.' });
    }
    const ok = await db.ensureConnected();
    if (!ok) {
      return res.status(503).json({ message: 'Banco de dados indisponível.' });
    }
    const { username, password } = req.body || {};
    const name = username ? String(username).trim() : '';
    if (!name) {
      return res.status(400).json({ message: 'username é obrigatório' });
    }
    try {
      const r = await db.query(
        `SELECT id, username, email, password_hash FROM users WHERE username = $1 LIMIT 1`,
        [name]
      );
      const row = r.rows[0];
      if (!row) {
        return res.status(401).json({ message: 'Usuário ou senha inválidos' });
      }
      if (row.password_hash) {
        if (!password || !(await bcrypt.compare(String(password), row.password_hash))) {
          return res.status(401).json({ message: 'Usuário ou senha inválidos' });
        }
      }
      await ensureLibertyServer();
      await ensureUserInLibertyServer(row.id);
      const user = { id: String(row.id), username: row.username, email: row.email, has_password: Boolean(row.password_hash) };
      const access_token = auth.sign(user);
      res.cookie('liberty_token', access_token, {
        path: '/',
        maxAge: 90 * 24 * 60 * 60 * 1000,
        sameSite: 'lax',
        httpOnly: false,
      });
      return res.status(200).json({
        success: true,
        user,
        access_token,
        refresh_token: access_token,
      });
    } catch (err) {
      console.error('[API] login', err.message);
      return res.status(500).json({ message: err.message || 'Erro ao fazer login' });
    }
  });

  // Mensagens: cache em memória + persistência no DB (ensureMessageInDb)
  app.post('/api/messages', auth.requireAuth, async (req, res) => {
    const { content, author } = req.body || {};
    if (!content || !String(content).trim()) {
      return res.status(400).json({ message: 'content é obrigatório' });
    }
    const safeContent = String(content).trim().replace(/</g, '&lt;');
    const userId = req.userId;
    try {
      let chatId = null;
      if (db.isConfigured() && db.isConnected()) chatId = await getDefaultChatId();
      if (!chatId) chatId = 'default-chat';
      let username = (author && String(author).trim()) || 'User';
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
      await addCachedMessage(chatId, saved);
      await ensureMessageInDb(saved, chatId);
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
      console.error('[API] POST /api/messages erro:', err.message);
      return res.status(500).json({ message: err.message || 'Erro ao salvar mensagem' });
    }
  });

  app.get('/api/messages', async (_req, res) => {
    try {
      let chatId = null;
      if (db.isConfigured() && db.isConnected()) chatId = await getDefaultChatId();
      if (!chatId) chatId = 'default-chat';
      let list = await getCachedMessages(chatId);
      if (list.length === 0 && db.isConfigured() && db.isConnected() && isUuid(chatId)) {
        const fromDb = await loadMessagesFromDb(chatId, MAX_CACHE_PER_CHANNEL);
        if (fromDb.length > 0) {
          await setCachedMessages(chatId, fromDb);
          list = await getCachedMessages(chatId);
        }
      }
      const response = list.map((m) => ({
        id: m.id,
        content: String(m.content || '').trim(),
        author_username: m.author_username || m.author || 'User',
        username: m.author_username || m.author || 'User',
        avatar_url: m.avatar_url || null,
        created_at: (m.created_at instanceof Date ? m.created_at : new Date(m.created_at)).toISOString(),
      }));
      return res.status(200).json(response);
    } catch (err) {
      console.error('[API] GET /api/messages erro:', err.message);
      return res.status(500).json({ message: err.message || 'Erro ao carregar mensagens' });
    }
  });

  // POST /api/servers/:serverId/channels/:channelId/messages — cache + persistência no DB
  app.post('/api/servers/:serverId/channels/:channelId/messages', auth.requireAuth, async (req, res) => {
    const { content } = req.body || {};
    if (!content || !String(content).trim()) {
      return res.status(400).json({ message: 'content é obrigatório' });
    }
    const safeContent = String(content).trim().replace(/</g, '&lt;');
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
      await addCachedMessage(chatId, saved);
      await ensureMessageInDb(saved, chatId);
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
      console.error('[API] POST /api/servers/.../channels/.../messages erro:', err.message);
      return res.status(500).json({ message: err.message || 'Erro ao salvar mensagem' });
    }
  });

  // Resolve channelId para chat_id: se for UUID válido, usa como chat_id (canal do servidor); senão resolve por nome
  async function resolveChannelToChatId(userId, channelId) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(String(channelId).trim())) {
      const r = await db.query(
        'SELECT c.id FROM chats c LEFT JOIN chat_members cm ON cm.chat_id = c.id AND cm.user_id = $2::uuid WHERE c.id = $1::uuid AND (c.type IN (\'channel\',\'dm\',\'group_dm\') AND (c.server_id IS NOT NULL OR cm.user_id IS NOT NULL)) LIMIT 1',
        [channelId, userId]
      );
      if (r.rows[0]) return String(r.rows[0].id);
      const any = await db.query('SELECT id FROM chats WHERE id = $1::uuid LIMIT 1', [channelId]);
      if (any.rows[0]) return String(any.rows[0].id);
    }
    return await getChatIdForServerAndChannel(null, channelId) || await getDefaultChatId();
  }

  // Mensagens por canal: cache + persistência no DB (ensureMessageInDb)
  app.post('/api/v1/channels/:channelId/messages', auth.requireAuth, async (req, res) => {
    const { channelId } = req.params;
    const { content } = req.body || {};
    if (!content || !String(content).trim()) {
      return res.status(400).json({ message: 'content é obrigatório' });
    }
    const safeContent = String(content).trim().replace(/</g, '&lt;');
    const userId = req.userId;
    try {
      let chatId = null;
      if (db.isConfigured() && db.isConnected()) {
        chatId = await resolveChannelToChatId(userId, channelId) || await getDefaultChatId();
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
      };
      await addCachedMessage(chatId, saved);
      await ensureMessageInDb(saved, chatId);
      const emit = req.app.locals.emitMessage;
      if (emit && chatId) emit({ ...saved });
      return res.status(201).json({ success: true, message: saved });
    } catch (err) {
      console.error('[API] POST /api/v1/channels/:id/messages', err.message);
      return res.status(500).json({ message: err.message || 'Erro ao salvar' });
    }
  });

  app.get('/api/v1/channels/:channelId/messages', auth.requireAuth, async (req, res) => {
    const { channelId } = req.params;
    const userId = req.userId;
    try {
      let chatId = null;
      if (db.isConfigured() && db.isConnected()) {
        chatId = await resolveChannelToChatId(userId, channelId) || await getDefaultChatId();
      }
      if (!chatId) chatId = String(channelId);
      let list = await getCachedMessages(chatId);
      if (list.length === 0 && db.isConfigured() && db.isConnected() && isUuid(chatId)) {
        const fromDb = await loadMessagesFromDb(chatId, MAX_CACHE_PER_CHANNEL);
        if (fromDb.length > 0) {
          await setCachedMessages(chatId, fromDb);
          list = await getCachedMessages(chatId);
        }
      }
      let result = list.map((m) => ({
        id: m.id,
        channel_id: channelId,
        content: String(m.content || ''),
        author_id: m.author_id || null,
        author_username: m.author_username || m.author || 'User',
        avatar_url: m.avatar_url || null,
        created_at: (m.created_at instanceof Date ? m.created_at : new Date(m.created_at)).toISOString(),
      }));
      if (db.isConfigured() && db.isConnected() && result.length > 0) {
        const authorIds = [...new Set(result.map((m) => m.author_id).filter(Boolean))];
        if (authorIds.length > 0) {
          try {
            const placeholders = authorIds.map((_, i) => `$${i + 1}::uuid`).join(',');
            const r = await db.query(`SELECT id, avatar_url FROM users WHERE id IN (${placeholders})`, authorIds);
            const avatarByAuthor = Object.fromEntries((r.rows || []).map((row) => [String(row.id), row.avatar_url || null]));
            result = result.map((m) => ({ ...m, avatar_url: (m.author_id && avatarByAuthor[m.author_id]) || m.avatar_url }));
          } catch (_) {}
        }
      }
      return res.status(200).json(result);
    } catch (err) {
      console.error('[API] GET /api/v1/channels/:id/messages', err.message);
      return res.status(500).json({ message: err.message || 'Erro' });
    }
  });

  // Pins — apenas admins (Zerk, noeb) podem fixar/desfixar; qualquer um pode listar
  app.get('/api/v1/channels/:channelId/pins', auth.requireAuth, async (req, res) => {
    const chatId = req.params.channelId;
    if (!db.isConfigured() || !db.isConnected()) return res.status(503).json({ message: 'Banco indisponível' });
    if (!isUuid(chatId)) return res.status(400).json({ message: 'channelId inválido' });
    try {
      const r = await db.query(
        `SELECT p.id, p.message_id, p.pinned_at, m.content, m.user_id AS author_id, u.username AS author_username
         FROM message_pins p
         INNER JOIN messages m ON m.id = p.message_id AND m.chat_id = p.chat_id
         LEFT JOIN users u ON u.id = m.user_id
         WHERE p.chat_id = $1::uuid ORDER BY p.pinned_at DESC`,
        [chatId]
      );
      const list = (r.rows || []).map((row) => ({
        id: String(row.message_id),
        content: row.content || '',
        author_id: row.author_id ? String(row.author_id) : null,
        author_username: row.author_username || 'User',
        pinned_at: row.pinned_at,
      }));
      return res.status(200).json(list);
    } catch (err) {
      if (err.message && err.message.includes('does not exist')) return res.status(200).json([]);
      return res.status(500).json({ message: err.message || 'Erro ao listar pins' });
    }
  });

  app.put('/api/v1/channels/:channelId/pins/:messageId', auth.requireAuth, async (req, res) => {
    const { channelId, messageId } = req.params;
    if (!(await isAdmin(req))) return res.status(403).json({ message: 'Apenas administradores (Zerk, noeb) podem fixar mensagens.' });
    if (!db.isConfigured() || !db.isConnected()) return res.status(503).json({ message: 'Banco indisponível' });
    if (!isUuid(channelId) || !isUuid(messageId)) return res.status(400).json({ message: 'channelId ou messageId inválido' });
    try {
      await db.query(
        `INSERT INTO message_pins (chat_id, message_id, pinned_by) VALUES ($1::uuid, $2::uuid, $3::uuid)
         ON CONFLICT (chat_id, message_id) DO NOTHING`,
        [channelId, messageId, req.userId]
      );
      return res.status(200).json({ success: true });
    } catch (err) {
      if (err.code === '23503') return res.status(404).json({ message: 'Canal ou mensagem não encontrados' });
      return res.status(500).json({ message: err.message || 'Erro ao fixar' });
    }
  });

  app.delete('/api/v1/channels/:channelId/pins/:messageId', auth.requireAuth, async (req, res) => {
    const { channelId, messageId } = req.params;
    if (!(await isAdmin(req))) return res.status(403).json({ message: 'Apenas administradores (Zerk, noeb) podem desfixar mensagens.' });
    if (!db.isConfigured() || !db.isConnected()) return res.status(503).json({ message: 'Banco indisponível' });
    if (!isUuid(channelId) || !isUuid(messageId)) return res.status(400).json({ message: 'channelId ou messageId inválido' });
    try {
      await db.query('DELETE FROM message_pins WHERE chat_id = $1::uuid AND message_id = $2::uuid', [channelId, messageId]);
      return res.status(204).end();
    } catch (err) {
      return res.status(500).json({ message: err.message || 'Erro ao desfixar' });
    }
  });

  // GET /api/v1/admin/db — estatísticas do banco (apenas Zerk e noeb)
  app.get('/api/v1/admin/db', auth.requireAuth, async (req, res) => {
    if (!(await isAdmin(req))) return res.status(403).json({ message: 'Acesso negado. Apenas administradores podem ver o banco.' });
    if (!db.isConfigured() || !db.isConnected()) return res.status(503).json({ message: 'Banco indisponível' });
    try {
      const [u, s, c, m, mp] = await Promise.all([
        db.query('SELECT COUNT(*) AS n FROM users'),
        db.query('SELECT COUNT(*) AS n FROM servers'),
        db.query('SELECT COUNT(*) AS n FROM chats'),
        db.query('SELECT COUNT(*) AS n FROM messages'),
        db.query('SELECT COUNT(*) AS n FROM message_pins'),
      ]);
      return res.status(200).json({
        users: parseInt(u.rows[0]?.n || 0, 10),
        servers: parseInt(s.rows[0]?.n || 0, 10),
        channels: parseInt(c.rows[0]?.n || 0, 10),
        messages: parseInt(m.rows[0]?.n || 0, 10),
        pinned_messages: parseInt(mp.rows[0]?.n || 0, 10),
      });
    } catch (err) {
      return res.status(500).json({ message: err.message || 'Erro ao obter estatísticas' });
    }
  });

  // GET /api/v1/servers — lista de servidores do usuário (autenticado)
  app.get('/api/v1/servers', auth.requireAuth, async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) {
      return res.status(503).json({ message: 'Banco indisponível' });
    }
    try {
      const userId = req.userId;
      const r = await db.query(
        `SELECT DISTINCT s.id, s.name, s.owner_id, s.created_at, s.icon_url
         FROM servers s
         LEFT JOIN chats c ON c.server_id = s.id
         LEFT JOIN chat_members cm ON cm.chat_id = c.id AND cm.user_id = $1::uuid
         WHERE s.owner_id = $1::uuid OR cm.user_id = $1::uuid
         ORDER BY s.created_at ASC`,
        [userId]
      );
      const servers = r.rows.map((row) => ({
        id: String(row.id),
        name: row.name,
        owner_id: row.owner_id ? String(row.owner_id) : null,
        created_at: row.created_at,
        icon: row.icon_url || null,
        icon_url: row.icon_url || null,
      }));
      return res.status(200).json(servers);
    } catch (err) {
      if (err.message && err.message.includes('does not exist')) {
        try {
          await dbInit();
          const r = await db.query(`SELECT id, name, owner_id, created_at, icon_url FROM servers ORDER BY created_at ASC`);
          const servers = r.rows.map((row) => ({
            id: String(row.id),
            name: row.name,
            owner_id: row.owner_id ? String(row.owner_id) : null,
            created_at: row.created_at,
            icon: row.icon_url || null,
            icon_url: row.icon_url || null,
          }));
          return res.status(200).json(servers);
        } catch (e) {
          console.error('[API] GET /api/v1/servers (após init):', e.message);
          return res.status(500).json({ message: e.message || 'Erro ao listar servidores' });
        }
      }
      console.error('[API] GET /api/v1/servers:', err.message);
      return res.status(500).json({ message: err.message || 'Erro ao listar servidores' });
    }
  });

  // GET /api/v1/servers/:serverId — detalhes de um servidor (autenticado; 404 se não existir ou sem acesso)
  app.get('/api/v1/servers/:serverId', auth.requireAuth, async (req, res) => {
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
         WHERE s.id = $1::uuid AND (s.owner_id = $2::uuid OR cm.user_id = $2::uuid)
         LIMIT 1`,
        [serverId, userId]
      );
      if (!r.rows[0]) {
        return res.status(404).json({ message: 'Servidor não encontrado' });
      }
      const row = r.rows[0];
      return res.status(200).json({
        id: String(row.id),
        name: row.name,
        owner_id: row.owner_id ? String(row.owner_id) : null,
        created_at: row.created_at,
        icon: row.icon_url || null,
        icon_url: row.icon_url || null,
      });
    } catch (err) {
      if (err.code === '22P02') return res.status(404).json({ message: 'Servidor não encontrado' });
      console.error('[API] GET /api/v1/servers/:serverId:', err.message);
      return res.status(500).json({ message: err.message || 'Erro ao carregar servidor' });
    }
  });

  // PATCH /api/v1/servers/:serverId — atualizar servidor (bloqueado para servidor LIBERTY oficial)
  app.patch('/api/v1/servers/:serverId', auth.requireAuth, async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) {
      return res.status(503).json({ message: 'Banco indisponível' });
    }
    const serverId = req.params.serverId;
    const userId = req.userId;
    try {
      const r = await db.query(
        `SELECT id, name, owner_id FROM servers WHERE id = $1::uuid LIMIT 1`,
        [serverId]
      );
      if (!r.rows[0]) {
        return res.status(404).json({ message: 'Servidor não encontrado' });
      }
      if (isOfficialLibertyServer(r.rows[0])) {
        return res.status(403).json({ message: 'O servidor LIBERTY oficial não pode ser alterado.' });
      }
      const ownerCheck = await db.query(
        `SELECT id FROM servers WHERE id = $1::uuid AND owner_id = $2::uuid LIMIT 1`,
        [serverId, userId]
      );
      if (!ownerCheck.rows[0]) {
        return res.status(403).json({ message: 'Apenas o dono pode alterar o servidor.' });
      }
      const { name, icon } = req.body || {};
      const updates = [];
      const values = [];
      let idx = 1;
      if (name !== undefined && String(name).trim()) {
        updates.push(`name = $${idx++}`);
        values.push(String(name).trim());
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
        const row = await db.query(`SELECT id, name, owner_id, created_at, icon_url FROM servers WHERE id = $1::uuid`, [serverId]);
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
      const row = await db.query(`SELECT id, name, owner_id, created_at, icon_url FROM servers WHERE id = $1::uuid`, [serverId]);
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
      console.error('[API] PATCH /api/v1/servers/:serverId:', err.message);
      return res.status(500).json({ message: err.message || 'Erro ao atualizar servidor' });
    }
  });

  // DELETE /api/v1/servers/:serverId — apagar servidor (bloqueado para servidor LIBERTY oficial)
  app.delete('/api/v1/servers/:serverId', auth.requireAuth, async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) {
      return res.status(503).json({ message: 'Banco indisponível' });
    }
    const serverId = req.params.serverId;
    const userId = req.userId;
    try {
      const r = await db.query(
        `SELECT id, name, owner_id FROM servers WHERE id = $1::uuid LIMIT 1`,
        [serverId]
      );
      if (!r.rows[0]) {
        return res.status(404).json({ message: 'Servidor não encontrado' });
      }
      if (isOfficialLibertyServer(r.rows[0])) {
        return res.status(403).json({ message: 'O servidor LIBERTY oficial não pode ser alterado.' });
      }
      const ownerCheck = await db.query(
        `SELECT id FROM servers WHERE id = $1::uuid AND owner_id = $2::uuid LIMIT 1`,
        [serverId, userId]
      );
      if (!ownerCheck.rows[0]) {
        return res.status(403).json({ message: 'Apenas o dono pode apagar o servidor.' });
      }
      await db.query(`DELETE FROM servers WHERE id = $1::uuid`, [serverId]);
      return res.status(204).end();
    } catch (err) {
      if (err.code === '22P02') return res.status(404).json({ message: 'Servidor não encontrado' });
      console.error('[API] DELETE /api/v1/servers/:serverId:', err.message);
      return res.status(500).json({ message: err.message || 'Erro ao apagar servidor' });
    }
  });

  // POST /api/v1/servers — criar servidor (autenticado)
  app.post('/api/v1/servers', auth.requireAuth, async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) {
      return res.status(503).json({ message: 'Banco indisponível' });
    }
    const { name, region, icon } = req.body || {};
    const serverName = (name && String(name).trim()) || 'Novo servidor';
    const userId = req.userId;
    try {
      const ins = await db.query(
        `INSERT INTO servers (name, owner_id) VALUES ($1, $2::uuid) RETURNING id, name, owner_id, created_at`,
        [serverName, userId]
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
            console.warn('[API] Erro ao gravar ícone do servidor:', e.message);
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
      const ch = await db.query(
        `INSERT INTO chats (name, type, server_id) VALUES ($1, 'channel', $2::uuid) RETURNING id`,
        ['general', row.id]
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
          const ins = await db.query(
            `INSERT INTO servers (name, owner_id) VALUES ($1, $2::uuid) RETURNING id, name, owner_id, created_at`,
            [serverName, userId]
          );
          const row = ins.rows[0];
          const ch = await db.query(
            `INSERT INTO chats (name, type, server_id) VALUES ($1, 'channel', $2::uuid) RETURNING id`,
            ['general', row.id]
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
          console.error('[API] POST /api/v1/servers (após init):', e.message);
          return res.status(500).json({ message: e.message || 'Erro ao criar servidor' });
        }
      }
      console.error('[API] POST /api/v1/servers:', err.message);
      return res.status(500).json({ message: err.message || 'Erro ao criar servidor' });
    }
  });

  // GET /api/v1/servers/:serverId/channels — lista canais e categorias do servidor
  app.get('/api/v1/servers/:serverId/channels', auth.requireAuth, async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) {
      return res.status(503).json({ message: 'Banco indisponível' });
    }
    const serverId = req.params.serverId;
    try {
      const r = await db.query(
        `SELECT id, name, type, server_id, parent_id, channel_type, created_at
         FROM chats
         WHERE server_id = $1::uuid AND type IN ('channel', 'category')
         ORDER BY type ASC, created_at ASC`,
        [serverId]
      );
      const list = r.rows.map((row) => ({
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
      console.error('[API] GET /api/v1/servers/:serverId/channels:', err.message);
      return res.status(500).json({ message: err.message || 'Erro ao listar canais' });
    }
  });

  // GET /api/v1/servers/:serverId/members — membros do servidor (exclui banidos; role de server_members)
  app.get('/api/v1/servers/:serverId/members', auth.requireAuth, async (req, res) => {
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
      const list = r.rows.map((row) => ({
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
      console.error('[API] GET /api/v1/servers/:serverId/members:', err.message);
      return res.status(500).json({ message: err.message || 'Erro ao listar membros' });
    }
  });

  // PATCH /api/v1/servers/:serverId/members/:userId — alterar cargo (apenas dono do servidor ou admin)
  app.patch('/api/v1/servers/:serverId/members/:userId', auth.requireAuth, async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) return res.status(503).json({ message: 'Banco indisponível' });
    const { serverId, userId } = req.params;
    const role = req.body && req.body.role ? String(req.body.role).toLowerCase() : null;
    const allowedRoles = ['member', 'moderator', 'admin'];
    if (!role || !allowedRoles.includes(role)) return res.status(400).json({ message: 'role deve ser member, moderator ou admin' });
    if (!isUuid(serverId) || !isUuid(userId)) return res.status(400).json({ message: 'IDs inválidos' });
    try {
      const serverRow = await db.query('SELECT owner_id FROM servers WHERE id = $1::uuid', [serverId]);
      const s = serverRow.rows[0];
      if (!s) return res.status(404).json({ message: 'Servidor não encontrado' });
      const isOwner = s.owner_id && String(s.owner_id) === String(req.userId);
      const adminOk = await isAdmin(req);
      if (!isOwner && !adminOk) return res.status(403).json({ message: 'Apenas o dono do servidor ou um administrador pode alterar cargos.' });
      await db.query(
        `INSERT INTO server_members (server_id, user_id, role) VALUES ($1::uuid, $2::uuid, $3)
         ON CONFLICT (server_id, user_id) DO UPDATE SET role = $3`,
        [serverId, userId, role]
      );
      return res.status(200).json({ success: true, role });
    } catch (err) {
      if (err.code === '22P02') return res.status(404).json({ message: 'Servidor ou usuário não encontrado' });
      return res.status(500).json({ message: err.message || 'Erro ao atualizar cargo' });
    }
  });

  // POST /api/v1/servers/:serverId/bans — banir usuário do servidor (apenas Zerk, noeb)
  app.post('/api/v1/servers/:serverId/bans', auth.requireAuth, async (req, res) => {
    if (!(await isAdmin(req))) return res.status(403).json({ message: 'Apenas administradores (Zerk, noeb) podem banir membros.' });
    if (!db.isConfigured() || !db.isConnected()) return res.status(503).json({ message: 'Banco indisponível' });
    const serverId = req.params.serverId;
    const { user_id, reason } = req.body || {};
    if (!isUuid(serverId) || !user_id || !isUuid(user_id)) return res.status(400).json({ message: 'serverId e user_id são obrigatórios' });
    try {
      await db.query(
        `INSERT INTO server_bans (server_id, user_id, banned_by, reason) VALUES ($1::uuid, $2::uuid, $3::uuid, $4)
         ON CONFLICT (server_id, user_id) DO UPDATE SET banned_by = $3::uuid, reason = $4`,
        [serverId, user_id, req.userId, reason ? String(reason).trim() : null]
      );
      const chats = await db.query('SELECT id FROM chats WHERE server_id = $1::uuid', [serverId]);
      for (const ch of chats.rows || []) {
        await db.query('DELETE FROM chat_members WHERE chat_id = $1::uuid AND user_id = $2::uuid', [ch.id, user_id]);
      }
      return res.status(200).json({ success: true });
    } catch (err) {
      if (err.code === '22P02') return res.status(404).json({ message: 'Servidor ou usuário não encontrado' });
      return res.status(500).json({ message: err.message || 'Erro ao banir' });
    }
  });

  // DELETE /api/v1/servers/:serverId/bans/:userId — desbanir (apenas Zerk, noeb)
  app.delete('/api/v1/servers/:serverId/bans/:userId', auth.requireAuth, async (req, res) => {
    if (!(await isAdmin(req))) return res.status(403).json({ message: 'Apenas administradores (Zerk, noeb) podem desbanir.' });
    if (!db.isConfigured() || !db.isConnected()) return res.status(503).json({ message: 'Banco indisponível' });
    const { serverId, userId } = req.params;
    if (!isUuid(serverId) || !isUuid(userId)) return res.status(400).json({ message: 'IDs inválidos' });
    try {
      await db.query('DELETE FROM server_bans WHERE server_id = $1::uuid AND user_id = $2::uuid', [serverId, userId]);
      return res.status(204).end();
    } catch (err) {
      return res.status(500).json({ message: err.message || 'Erro ao desbanir' });
    }
  });

  // POST /api/v1/servers/:serverId/channels — criar canal (texto/voz) ou categoria
  app.post('/api/v1/servers/:serverId/channels', auth.requireAuth, async (req, res) => {
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
    const channelName = name && String(name).trim() ? String(name).trim().replace(/\s+/g, '-').toLowerCase().substring(0, 100) : null;
    if (!channelName || channelName.length < 1) {
      return res.status(400).json({ message: 'Nome do canal ou categoria é obrigatório' });
    }
    try {
      const chatType = isCategory ? 'category' : 'channel';
      const parentId = parent_id && String(parent_id).trim() ? String(parent_id).trim() : null;
      const channelTypeVal = isCategory ? null : channelType;
      const ins = await db.query(
        `INSERT INTO chats (name, type, server_id, parent_id, channel_type)
         VALUES ($1, $2, $3::uuid, $4::uuid, $5)
         RETURNING id, name, type, server_id, parent_id, channel_type, created_at`,
        [channelName, chatType, serverId, parentId, channelTypeVal]
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
      console.error('[API] POST /api/v1/servers/:serverId/channels:', err.message);
      return res.status(500).json({ message: err.message || 'Erro ao criar canal' });
    }
  });

  // GET /api/v1/default-chat — ID do chat padrão (para o cliente inscrever no WebSocket)
  app.get('/api/v1/default-chat', async (_req, res) => {
    try {
      const chatId = await getDefaultChatId();
      if (!chatId) return res.status(404).json({ message: 'Chat padrão indisponível' });
      return res.status(200).json({ chat_id: chatId });
    } catch (err) {
      return res.status(500).json({ message: err.message });
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

      const dmChats = await db.query(
        `SELECT c.id AS chat_id FROM chats c
         INNER JOIN chat_members cm ON cm.chat_id = c.id
         WHERE c.type = 'dm' AND cm.user_id = $1::uuid`,
        [userId]
      );
      for (const row of dmChats.rows) {
        const other = await db.query(
          `SELECT u.id, u.username, u.avatar_url FROM chat_members cm
           INNER JOIN users u ON u.id = cm.user_id
           WHERE cm.chat_id = $1::uuid AND cm.user_id != $2::uuid`,
          [row.chat_id, userId]
        );
        const u = other.rows[0];
        if (u) {
          channels.push({
            id: String(row.chat_id),
            type: 'dm',
            name: null,
            recipients: [{ id: String(u.id), username: u.username, avatar_url: u.avatar_url || null, avatar: u.avatar_url || null }],
          });
        }
      }

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
          name: row.name || members.rows.map((m) => m.username).join(', '),
          recipients: members.rows.map((m) => ({ id: String(m.id), username: m.username, avatar_url: m.avatar_url || null, avatar: m.avatar_url || null })),
        });
      }

      return res.status(200).json(channels);
    } catch (err) {
      console.error('[LIBERTY] GET @me/channels', err);
      return res.status(500).json({ message: err.message || 'Erro ao listar canais' });
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
        const ins = await db.query(
          `INSERT INTO chats (name, type, server_id) VALUES ($1, 'group_dm', NULL) RETURNING id`,
          [name]
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
          name: name || members.rows.map((m) => m.username).join(', '),
          recipients: members.rows.map((m) => ({ id: String(m.id), username: m.username, avatar_url: m.avatar_url || null, avatar: m.avatar_url || null })),
        });
      } catch (err) {
        console.error('[LIBERTY] POST @me/channels group', err);
        return res.status(500).json({ message: err.message || 'Erro ao criar grupo' });
      }
    }

    if (singleId && singleId !== userId) {
      try {
        const existing = await db.query(
          `SELECT c.id FROM chats c
           WHERE c.type = 'dm' AND (SELECT COUNT(*) FROM chat_members WHERE chat_id = c.id) = 2
           AND EXISTS (SELECT 1 FROM chat_members WHERE chat_id = c.id AND user_id = $1::uuid)
           AND EXISTS (SELECT 1 FROM chat_members WHERE chat_id = c.id AND user_id = $2::uuid)`,
          [userId, singleId]
        );
        if (existing.rows[0]) {
          const chatId = existing.rows[0].id;
          const u = await db.query('SELECT id, username, avatar_url FROM users WHERE id = $1::uuid', [singleId]);
          const username = u.rows[0]?.username || 'User';
          const avatarUrl = u.rows[0]?.avatar_url || null;
          return res.status(200).json({
            id: String(chatId),
            type: 'dm',
            name: null,
            recipients: [{ id: singleId, username, avatar_url: avatarUrl, avatar: avatarUrl }],
          });
        }
        const ins = await db.query(
          `INSERT INTO chats (name, type, server_id) VALUES (NULL, 'dm', NULL) RETURNING id`,
          []
        );
        const chatId = ins.rows[0].id;
        await db.query(
          `INSERT INTO chat_members (chat_id, user_id) VALUES ($1::uuid, $2::uuid), ($1::uuid, $3::uuid)`,
          [chatId, userId, singleId]
        );
        const u = await db.query('SELECT id, username, avatar_url FROM users WHERE id = $1::uuid', [singleId]);
        const username = u.rows[0]?.username || 'User';
        const avatarUrl = u.rows[0]?.avatar_url || null;
        return res.status(201).json({
          id: String(chatId),
          type: 'dm',
          name: null,
          recipients: [{ id: singleId, username, avatar_url: avatarUrl, avatar: avatarUrl }],
        });
      } catch (err) {
        console.error('[LIBERTY] POST @me/channels dm', err);
        return res.status(500).json({ message: err.message || 'Erro ao criar DM' });
      }
    }

    return res.status(400).json({ message: 'Envie recipient_id (DM) ou recipient_ids (array com 2+) para grupo' });
  });

  // POST /api/v1/calls — registar início de chamada WebRTC (ringing)
  app.post('/api/v1/calls', auth.requireAuth, async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) {
      return res.status(503).json({ message: 'Banco indisponível' });
    }
    const callerId = req.userId;
    const calleeId = req.body?.callee_id ? String(req.body.callee_id).trim() : null;
    const chatId = req.body?.chat_id ? String(req.body.chat_id).trim() : null;
    if (!calleeId || calleeId === callerId) {
      return res.status(400).json({ message: 'callee_id inválido' });
    }
    try {
      const r = await db.query(
        `INSERT INTO webrtc_calls (caller_id, callee_id, chat_id, status)
         VALUES ($1::uuid, $2::uuid, $3::uuid, 'ringing')
         RETURNING id, caller_id, callee_id, chat_id, status, created_at`,
        [callerId, calleeId, chatId || null]
      );
      const row = r.rows[0];
      return res.status(201).json({
        id: String(row.id),
        caller_id: String(row.caller_id),
        callee_id: String(row.callee_id),
        chat_id: row.chat_id ? String(row.chat_id) : null,
        status: row.status,
        created_at: row.created_at,
      });
    } catch (err) {
      console.error('[LIBERTY] POST /api/v1/calls', err);
      return res.status(500).json({ message: err.message || 'Erro ao criar chamada' });
    }
  });

  // PATCH /api/v1/calls/:id — atualizar estado da chamada (active, ended, rejected, missed)
  app.patch('/api/v1/calls/:id', auth.requireAuth, async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) {
      return res.status(503).json({ message: 'Banco indisponível' });
    }
    const callId = req.params.id;
    const status = req.body?.status ? String(req.body.status).trim() : null;
    const valid = ['ringing', 'active', 'ended', 'rejected', 'missed'];
    if (!status || !valid.includes(status)) {
      return res.status(400).json({ message: 'status deve ser um de: ' + valid.join(', ') });
    }
    try {
      const r = await db.query(
        `UPDATE webrtc_calls SET status = $1, started_at = CASE WHEN $1 = 'active' AND started_at IS NULL THEN now() ELSE started_at END, ended_at = CASE WHEN $1 IN ('ended','rejected','missed') THEN now() ELSE ended_at END
         WHERE id = $2::uuid AND (caller_id = $3::uuid OR callee_id = $3::uuid)
         RETURNING id, status, started_at, ended_at`,
        [status, callId, req.userId]
      );
      if (r.rows.length === 0) {
        return res.status(404).json({ message: 'Chamada não encontrada' });
      }
      return res.status(200).json(r.rows[0]);
    } catch (err) {
      console.error('[LIBERTY] PATCH /api/v1/calls/:id', err);
      return res.status(500).json({ message: err.message || 'Erro ao atualizar chamada' });
    }
  });

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
      if (!row) return res.status(404).json({ message: 'Usuário não encontrado' });
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
      console.error('[LIBERTY] GET /users/me', err);
      return res.status(500).json({ message: err.message || 'Erro ao buscar perfil' });
    }
  };
  app.get('/api/v1/users/me', auth.requireAuth, getMe);
  app.get('/api/v1/users/@me', auth.requireAuth, getMe);

  // GET /api/v1/users/:userId — perfil público (nome, avatar, banner, descrição) para modal de perfil
  app.get('/api/v1/users/:userId', auth.requireAuth, async (req, res) => {
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
      return res.status(500).json({ message: err.message || 'Erro ao buscar perfil' });
    }
  });

  // PATCH /api/v1/users/me e PATCH /api/v1/users/@me — atualizar perfil (avatar_url, banner_url, description)
  const patchMe = async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) {
      return res.status(503).json({ message: 'Banco indisponível' });
    }
    const { avatar_url, banner_url, description } = req.body || {};
    const avatarVal = avatar_url != null ? String(avatar_url).trim() : null;
    const bannerVal = banner_url != null ? String(banner_url).trim() : null;
    const descVal = description != null ? String(description).trim() : null;
    if (avatarVal && avatarVal.length > 0 && !/^https?:\/\//i.test(avatarVal) && !/^\//.test(avatarVal)) {
      return res.status(400).json({ message: 'avatar_url deve ser uma URL (http/https) ou caminho (/uploads/...)' });
    }
    if (bannerVal && bannerVal.length > 0 && !/^https?:\/\//i.test(bannerVal) && !/^\//.test(bannerVal)) {
      return res.status(400).json({ message: 'banner_url deve ser uma URL (http/https) ou caminho' });
    }
    try {
      const cur = await db.query('SELECT avatar_url, banner_url, description FROM users WHERE id = $1 LIMIT 1', [req.userId]);
      const c = cur.rows[0];
      const newAvatar = avatar_url !== undefined ? avatarVal : (c?.avatar_url ?? null);
      const newBanner = banner_url !== undefined ? bannerVal : (c?.banner_url ?? null);
      const newDesc = description !== undefined ? descVal : (c?.description ?? null);
      await db.query(
        'UPDATE users SET avatar_url = $1, banner_url = $2, description = $3 WHERE id = $4',
        [newAvatar, newBanner, newDesc, req.userId]
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
      console.error('[LIBERTY] PATCH /users/me', err);
      return res.status(500).json({ message: err.message || 'Erro ao atualizar perfil' });
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
      const r = await db.query(
        'SELECT password_hash FROM users WHERE id = $1 LIMIT 1',
        [req.userId]
      );
      const row = r.rows[0];
      if (!row) return res.status(404).json({ message: 'Usuário não encontrado' });
      if (row.password_hash) {
        const cur = (current_password != null ? String(current_password) : '').trim();
        if (!cur || !(await bcrypt.compare(cur, row.password_hash))) {
          return res.status(401).json({ message: 'Senha atual incorreta' });
        }
      }
      const password_hash = await bcrypt.hash(newPass, 10);
      await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [password_hash, req.userId]);
      return res.status(200).json({ success: true, message: 'Senha atualizada' });
    } catch (err) {
      console.error('[LIBERTY] PATCH /users/me/password', err);
      return res.status(500).json({ message: err.message || 'Erro ao atualizar senha' });
    }
  });

  // POST /api/v1/users/me/avatar — upload de foto (body: { image: "data:image/...;base64,..." })
  const UPLOADS_DIR = path.join(__dirname, 'uploads');
  const AVATARS_DIR = path.join(UPLOADS_DIR, 'avatars');
  try {
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    if (!fs.existsSync(AVATARS_DIR)) fs.mkdirSync(AVATARS_DIR, { recursive: true });
  } catch (e) {
    console.warn('[LIBERTY] Não foi possível criar pasta uploads:', e.message);
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
      console.error('[LIBERTY] Erro ao gravar avatar:', e.message);
      return res.status(500).json({ message: 'Erro ao guardar a imagem.' });
    }
    const avatarUrl = `/uploads/avatars/${filename}?t=${Date.now()}`;
    if (db.isConfigured() && db.isConnected()) {
      try {
        await db.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [avatarUrl, userId]);
      } catch (e) {
        console.error('[LIBERTY] Erro ao atualizar avatar_url:', e.message);
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

      const messagesByChannel = await getAllMessageLists();
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

      const allIds = [...new Set([...by_activity.map((u) => u.id), ...by_content.map((u) => u.id)].filter((id) => id && isUuid(id)))];
      let avatarByUser = {};
      if (db.isConfigured() && db.isConnected() && allIds.length > 0) {
        try {
          const placeholders = allIds.map((_, i) => `$${i + 1}::uuid`).join(',');
          const r = await db.query(`SELECT id, avatar_url FROM users WHERE id IN (${placeholders})`, allIds);
          avatarByUser = Object.fromEntries((r.rows || []).map((row) => [String(row.id), row.avatar_url || null]));
        } catch (_) {}
      }
      by_activity = by_activity.map((u) => ({ ...u, avatar_url: avatarByUser[u.id] || null }));
      by_content = by_content.map((u) => ({ ...u, avatar_url: avatarByUser[u.id] || null }));

      return res.status(200).json({ by_activity, by_content });
    } catch (err) {
      console.error('[LIBERTY] GET /ranking', err);
      return res.status(500).json({ message: err.message || 'Erro ao buscar ranking' });
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
      const list = r.rows.map((row) => {
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
      console.error('[LIBERTY] GET @me/relationships', err);
      return res.status(500).json({ message: err.message || 'Erro ao listar amigos' });
    }
  });

  // POST /api/v1/users/@me/relationships — adicionar amigo por username (envia pedido pending)
  app.post('/api/v1/users/@me/relationships', auth.requireAuth, async (req, res) => {
    const userId = req.userId;
    const { username } = req.body || {};
    const name = username && String(username).trim();
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
        if (existing.rows[0].status === 'pending') return res.status(400).json({ message: 'Pedido já enviado ou pendente' });
        if (existing.rows[0].status === 'blocked') return res.status(400).json({ message: 'Não é possível adicionar este utilizador' });
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
      console.error('[LIBERTY] POST @me/relationships', err);
      return res.status(500).json({ message: err.message || 'Erro ao adicionar amigo' });
    }
  });

  // PUT /api/v1/users/@me/relationships/:id — aceitar pedido de amizade
  app.put('/api/v1/users/@me/relationships/:relationshipId', auth.requireAuth, async (req, res) => {
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
      console.error('[LIBERTY] PUT @me/relationships/:id', err);
      return res.status(500).json({ message: err.message || 'Erro ao aceitar pedido' });
    }
  });

  // DELETE /api/v1/users/@me/relationships/:id — remover amizade / cancelar pedido / desbloquear
  app.delete('/api/v1/users/@me/relationships/:relationshipId', auth.requireAuth, async (req, res) => {
    const userId = req.userId;
    const relId = req.params.relationshipId;
    if (!db.isConfigured() || !db.isConnected()) return res.status(503).json({ message: 'Banco indisponível' });
    try {
      await db.query(
        'DELETE FROM friendships WHERE id = $1::uuid AND (user_id = $2::uuid OR friend_id = $2::uuid)',
        [relId, userId]
      );
      return res.status(204).end();
    } catch (err) {
      console.error('[LIBERTY] DELETE @me/relationships/:id', err);
      return res.status(500).json({ message: err.message || 'Erro ao remover' });
    }
  });

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
  const logoFallbackSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 88 88" width="88" height="88"><rect width="88" height="88" fill="#FFD700"/><text x="44" y="52" font-family="Arial,sans-serif" font-size="24" font-weight="bold" fill="#1a1a1a" text-anchor="middle">L</text></svg>';
  app.get('/assets/logo.png', (req, res) => {
    if (fs.existsSync(logoPath)) {
      res.sendFile(logoPath);
    } else {
      res.type('svg').send(logoFallbackSvg);
    }
  });

  // Avatares enviados pelos utilizadores
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  // Static + rota raiz
  app.use(express.static(STATIC_DIR));
  app.get('/', (_req, res) => res.sendFile(path.join(STATIC_DIR, 'index.html')));

  // SPA fallback: qualquer path não API/static devolve index.html para o cliente tratar (ex.: /channels/@me/:id ao dar F5)
  app.get('*', (_req, res) => res.sendFile(path.join(STATIC_DIR, 'index.html')));

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`LIBERTY listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Falha ao iniciar:', err);
  process.exit(1);
});

