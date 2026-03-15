// VERSION: CACHE_V1_STABLE
import 'dotenv/config';
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- db (inline para deploy sem pasta db/)
// Suporta DATABASE_URL, BANCO_DADOS (Square Cloud) ou DB_URL
function _dbGetUrl() {
  return process.env.DATABASE_URL || process.env.BANCO_DADOS || process.env.DB_URL || '';
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
  // Neon pooler: remover channel_binding=require (pode causar handshake fail em alguns ambientes)
  if (rawUrl.includes('channel_binding=require')) {
    rawUrl = rawUrl.replace(/&channel_binding=require/g, '').replace(/\?channel_binding=require&?/g, '?').replace(/\?&/, '?');
  }
  if (!_dbPool) {
    const isLocalhost = /@localhost[\s:]|@127\.0\.0\.1[\s:]/.test(rawUrl);
    const poolConfig = { connectionString: rawUrl, max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 20000 };
    if (!isLocalhost) {
      poolConfig.ssl = _dbLoadMtlsOptions() || { rejectUnauthorized: true };
    }
    _dbPool = new Pool(poolConfig);
  }
  try {
    const client = await _dbPool.connect();
    await client.query('SELECT 1');
    client.release();
    _dbConnected = true;
    console.log('[LIBERTY] PostgreSQL conectado');
    return _dbPool;
  } catch (err) {
    console.warn('[LIBERTY] PostgreSQL indisponível:', err.message);
    _dbConnected = false;
    return null;
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
  console.log('[LIBERTY] Schema PostgreSQL aplicado (' + applied + ' statements)');
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
const ws = {
  emitMessage(message) {
    const set = _wsSubscriptions.get(message.chat_id);
    if (!set) return;
    const payload = JSON.stringify({ type: 'message', data: message });
    set.forEach((c) => { if (c.readyState === WebSocket.OPEN) c.send(payload); });
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
          if (msg.type === 'subscribe' && msg.chat_id) {
            wsClient.subscribedChats.add(msg.chat_id);
            _wsSubscribe(msg.chat_id, wsClient);
          } else if (msg.type === 'unsubscribe' && msg.chat_id) {
            wsClient.subscribedChats.delete(msg.chat_id);
            _wsUnsubscribe(msg.chat_id, wsClient);
          } else if (msg.type === 'webrtc_offer' || msg.type === 'webrtc_answer' || msg.type === 'webrtc_ice') {
            const target = msg.target_user_id || msg.to;
            if (target && msg.payload !== undefined) _wsSendToUser(target, { type: msg.type, from_user_id: userId, payload: msg.payload });
          } else if (msg.type === 'stream_started') {
            const target = msg.target_user_id || msg.to;
            if (target) _wsSendToUser(target, { type: 'stream_started', from_user_id: userId, stream_type: msg.stream_type || 'screen' });
          } else if (msg.type === 'stream_stopped') {
            const target = msg.target_user_id || msg.to;
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
app.use(express.json());
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
  if (db.isConfigured()) {
    try {
      await db.connect();
      if (db.isConnected()) await dbInit();
    } catch (err) {
      console.warn('[LIBERTY] Banco:', err.message);
    }
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
    if (message && message.chat_id) {
      io.to(message.chat_id).emit('message', { type: 'message', data: message });
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
      const user = { id: String(row.id), username: row.username, email: row.email };
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
      const user = { id: String(row.id), username: row.username, email: row.email };
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
      const user = { id: String(row.id), username: row.username, email: row.email };
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

  // Mensagens: só DB; exige login (fluxo simplificado /api/messages)
  app.post('/api/messages', auth.requireAuth, async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) {
      return res
        .status(503)
        .json({ message: 'Banco de dados indisponível. Verifique DATABASE_URL no .env.' });
    }

    const { content, author } = req.body || {};
    if (!content || !String(content).trim()) {
      return res.status(400).json({ message: 'content é obrigatório' });
    }

    const safeContent = String(content).trim().replace(/</g, '&lt;');
    const userId = req.userId;

    try {
      const chatId = await getDefaultChatId();
      if (!chatId) {
        return res
          .status(503)
          .json({ message: 'Chat padrão indisponível. Verifique a configuração do banco de dados.' });
      }

      const result = await db.query(
        `INSERT INTO messages (content, chat_id, user_id)
         VALUES ($1, $2, $3)
         RETURNING id, content, created_at, user_id`,
        [safeContent, chatId, userId]
      );

      const row = result.rows[0];
      let username = (author && String(author).trim()) || 'User';
      let avatarUrl = null;
      if (userId) {
        const u = await db.query(
          'SELECT username, avatar_url FROM users WHERE id = $1 LIMIT 1',
          [userId]
        );
        if (u.rows[0]) {
          username = u.rows[0].username || username;
          avatarUrl = u.rows[0].avatar_url || null;
        }
      }
      const saved = {
        id: String(row.id),
        content: row.content,
        author: username,
        author_username: username,
        username,
        avatar_url: avatarUrl,
        channelId: 'default-channel',
        timestamp: row.created_at || new Date(),
      };

      const emit = req.app.locals.emitMessage;
      if (emit && chatId) {
        emit({ ...saved, chat_id: chatId });
      }

      return res.status(201).json({
        id: saved.id,
        content: saved.content,
        author_username: username,
        username,
        avatar_url: avatarUrl,
        created_at: new Date(saved.timestamp).toISOString(),
      });
    } catch (err) {
      console.error('[API] POST /api/messages erro:', err.message);
      return res
        .status(500)
        .json({ message: err.message || 'Erro ao salvar mensagem no banco de dados' });
    }
  });

  app.get('/api/messages', async (_req, res) => {
    if (!db.isConfigured() || !db.isConnected()) {
      return res
        .status(503)
        .json({ message: 'Banco de dados indisponível. Verifique DATABASE_URL no .env.' });
    }

    try {
      const chatId = await getDefaultChatId();
      if (!chatId) {
        // Sem chat padrão ainda: nenhuma mensagem persistida
        return res.status(200).json([]);
      }

      const result = await db.query(
        `SELECT m.id, m.content, m.created_at, m.user_id,
                u.username AS author_username, u.avatar_url
         FROM messages m
         LEFT JOIN users u ON u.id = m.user_id
         WHERE m.chat_id = $1
         ORDER BY m.created_at ASC
         LIMIT 50`,
        [chatId]
      );

      const response = result.rows.map((row, index) => ({
        id: row.id ? String(row.id) : String(index),
        content: String(row.content || '').trim().replace(/</g, '&lt;'),
        author_username: row.author_username || 'User',
        username: row.author_username || 'User',
        avatar_url: row.avatar_url || null,
        created_at: new Date(row.created_at || Date.now()).toISOString(),
      }));

      return res.status(200).json(response);
    } catch (err) {
      console.error('[API] GET /api/messages erro:', err.message);
      return res
        .status(500)
        .json({ message: err.message || 'Erro ao carregar mensagens do banco de dados' });
    }
  });

  // POST /api/servers/:serverId/channels/:channelId/messages — exige login; persiste só no DB
  app.post('/api/servers/:serverId/channels/:channelId/messages', auth.requireAuth, async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) {
      return res.status(503).json({ message: 'Banco de dados indisponível.' });
    }
    const { content } = req.body || {};
    if (!content || !String(content).trim()) {
      return res.status(400).json({ message: 'content é obrigatório' });
    }
    const safeContent = String(content).trim().replace(/</g, '&lt;');
    const userId = req.userId;
    try {
      const chatId = await getChatIdForServerAndChannel(req.params.serverId, req.params.channelId);
      if (!chatId) {
        return res.status(503).json({ message: 'Chat indisponível.' });
      }
      const result = await db.query(
        `INSERT INTO messages (content, chat_id, user_id) VALUES ($1, $2, $3)
         RETURNING id, content, created_at, user_id`,
        [safeContent, chatId, userId]
      );
      const row = result.rows[0];
      let username = 'User';
      let avatarUrl = null;
      const u = await db.query('SELECT username, avatar_url FROM users WHERE id = $1 LIMIT 1', [userId]);
      if (u.rows[0]) {
        username = u.rows[0].username || username;
        avatarUrl = u.rows[0].avatar_url || null;
      }
      const saved = {
        id: String(row.id),
        content: row.content,
        author: username,
        author_username: username,
        username,
        avatar_url: avatarUrl,
        channelId: req.params.channelId,
        timestamp: row.created_at || new Date(),
      };
      const emit = req.app.locals.emitMessage;
      if (emit && chatId) emit({ ...saved, chat_id: chatId });
      return res.status(201).json({
        id: saved.id,
        content: saved.content,
        author_username: username,
        username,
        avatar_url: avatarUrl,
        created_at: new Date(saved.timestamp).toISOString(),
      });
    } catch (err) {
      console.error('[API] POST /api/servers/.../channels/.../messages erro:', err.message);
      return res.status(500).json({ message: err.message || 'Erro ao salvar mensagem' });
    }
  });

  // Mensagens por canal (legacy): só DB
  app.post('/api/v1/channels/:channelId/messages', auth.requireAuth, async (req, res) => {
    const { channelId } = req.params;
    const { content } = req.body || {};
    if (!content || !String(content).trim()) {
      return res.status(400).json({ message: 'content é obrigatório' });
    }
    const safeContent = String(content).trim().replace(/</g, '&lt;');
    const userId = req.userId;
    if (!db.isConfigured() || !db.isConnected()) {
      return res.status(503).json({ message: 'Banco indisponível' });
    }
    try {
      const chatId = await getChatIdForServerAndChannel(null, channelId) || await getDefaultChatId();
      if (!chatId) return res.status(503).json({ message: 'Chat indisponível' });
      const result = await db.query(
        `INSERT INTO messages (content, chat_id, user_id) VALUES ($1, $2, $3)
         RETURNING id, content, created_at, user_id`,
        [safeContent, chatId, userId]
      );
      const row = result.rows[0];
      let username = 'User';
      const u = await db.query('SELECT username FROM users WHERE id = $1 LIMIT 1', [userId]);
      if (u.rows[0]) username = u.rows[0].username || username;
      const saved = {
        id: String(row.id),
        content: row.content,
        author: username,
        channelId,
        timestamp: row.created_at || new Date(),
      };
      const emit = req.app.locals.emitMessage;
      if (emit && chatId) emit({ ...saved, chat_id: chatId });
      return res.status(201).json({ success: true, message: saved });
    } catch (err) {
      console.error('[API] POST /api/v1/channels/:id/messages', err.message);
      return res.status(500).json({ message: err.message || 'Erro ao salvar' });
    }
  });

  app.get('/api/v1/channels/:channelId/messages', async (req, res) => {
    const { channelId } = req.params;
    if (!db.isConfigured() || !db.isConnected()) {
      return res.status(503).json({ message: 'Banco indisponível' });
    }
    try {
      const chatId = await getChatIdForServerAndChannel(null, channelId) || await getDefaultChatId();
      if (!chatId) return res.status(200).json([]);
      const result = await db.query(
        `SELECT m.id, m.content, m.created_at, u.username AS author_username
         FROM messages m LEFT JOIN users u ON u.id = m.user_id
         WHERE m.chat_id = $1 ORDER BY m.created_at ASC LIMIT 100`,
        [chatId]
      );
      const list = result.rows.map((row, i) => ({
        id: row.id ? String(row.id) : String(i),
        channel_id: channelId,
        content: String(row.content || ''),
        author_username: row.author_username || 'User',
        created_at: new Date(row.created_at).toISOString(),
      }));
      return res.status(200).json(list);
    } catch (err) {
      console.error('[API] GET /api/v1/channels/:id/messages', err.message);
      return res.status(500).json({ message: err.message || 'Erro' });
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
        `SELECT DISTINCT s.id, s.name, s.owner_id, s.created_at
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
      }));
      return res.status(200).json(servers);
    } catch (err) {
      if (err.message && err.message.includes('does not exist')) {
        try {
          await dbInit();
          const r = await db.query(`SELECT id, name, owner_id, created_at FROM servers ORDER BY created_at ASC`);
          const servers = r.rows.map((row) => ({
            id: String(row.id),
            name: row.name,
            owner_id: row.owner_id ? String(row.owner_id) : null,
            created_at: row.created_at,
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

  // POST /api/v1/servers — criar servidor (autenticado)
  app.post('/api/v1/servers', auth.requireAuth, async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) {
      return res.status(503).json({ message: 'Banco indisponível' });
    }
    const { name, region } = req.body || {};
    const serverName = (name && String(name).trim()) || 'Novo servidor';
    const userId = req.userId;
    try {
      const ins = await db.query(
        `INSERT INTO servers (name, owner_id) VALUES ($1, $2::uuid) RETURNING id, name, owner_id, created_at`,
        [serverName, userId]
      );
      const row = ins.rows[0];
      const server = {
        id: String(row.id),
        name: row.name,
        owner_id: String(row.owner_id),
        created_at: row.created_at,
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
          return res.status(201).json({
            server: {
              id: String(row.id),
              name: row.name,
              owner_id: String(row.owner_id),
              created_at: row.created_at,
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

  // POST /api/v1/servers/:serverId/channels — criar canal (texto/voz) ou categoria
  app.post('/api/v1/servers/:serverId/channels', auth.requireAuth, async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) {
      return res.status(503).json({ message: 'Banco indisponível' });
    }
    const serverId = req.params.serverId;
    const userId = req.userId;
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
          `SELECT u.id, u.username FROM chat_members cm
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
            recipients: [{ id: String(u.id), username: u.username }],
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
          `SELECT u.id, u.username FROM group_members gm
           INNER JOIN users u ON u.id = gm.user_id
           WHERE gm.chat_id = $1::uuid`,
          [row.chat_id]
        );
        channels.push({
          id: String(row.chat_id),
          type: 'group_dm',
          name: row.name || members.rows.map((m) => m.username).join(', '),
          recipients: members.rows.map((m) => ({ id: String(m.id), username: m.username })),
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
          `SELECT u.id, u.username FROM group_members gm
           INNER JOIN users u ON u.id = gm.user_id
           WHERE gm.chat_id = $1::uuid`,
          [chatId]
        );
        return res.status(201).json({
          id: String(chatId),
          type: 'group_dm',
          name: name || members.rows.map((m) => m.username).join(', '),
          recipients: members.rows.map((m) => ({ id: String(m.id), username: m.username })),
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
          const u = await db.query('SELECT id, username FROM users WHERE id = $1::uuid', [singleId]);
          const username = u.rows[0]?.username || 'User';
          return res.status(200).json({
            id: String(chatId),
            type: 'dm',
            name: null,
            recipients: [{ id: singleId, username }],
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
        const u = await db.query('SELECT id, username FROM users WHERE id = $1::uuid', [singleId]);
        const username = u.rows[0]?.username || 'User';
        return res.status(201).json({
          id: String(chatId),
          type: 'dm',
          name: null,
          recipients: [{ id: singleId, username }],
        });
      } catch (err) {
        console.error('[LIBERTY] POST @me/channels dm', err);
        return res.status(500).json({ message: err.message || 'Erro ao criar DM' });
      }
    }

    return res.status(400).json({ message: 'Envie recipient_id (DM) ou recipient_ids (array com 2+) para grupo' });
  });

  // GET /api/v1/users/me — perfil do usuário autenticado (inclui avatar_url)
  app.get('/api/v1/users/me', auth.requireAuth, async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) {
      return res.status(503).json({ message: 'Banco indisponível' });
    }
    try {
      const r = await db.query(
        'SELECT id, username, email, avatar_url, created_at FROM users WHERE id = $1 LIMIT 1',
        [req.userId]
      );
      const row = r.rows[0];
      if (!row) return res.status(404).json({ message: 'Usuário não encontrado' });
      return res.status(200).json({
        id: String(row.id),
        username: row.username,
        email: row.email || null,
        avatar_url: row.avatar_url || null,
        created_at: row.created_at,
      });
    } catch (err) {
      console.error('[LIBERTY] GET /users/me', err);
      return res.status(500).json({ message: err.message || 'Erro ao buscar perfil' });
    }
  });

  // PATCH /api/v1/users/me — atualizar perfil (avatar_url por URL)
  app.patch('/api/v1/users/me', auth.requireAuth, async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) {
      return res.status(503).json({ message: 'Banco indisponível' });
    }
    const { avatar_url } = req.body || {};
    const url = avatar_url != null ? String(avatar_url).trim() : null;
    if (url !== null && url.length > 0 && !/^https?:\/\//i.test(url)) {
      return res.status(400).json({ message: 'avatar_url deve ser uma URL (http ou https)' });
    }
    try {
      await db.query(
        'UPDATE users SET avatar_url = $1 WHERE id = $2',
        [url || null, req.userId]
      );
      const r = await db.query(
        'SELECT id, username, email, avatar_url FROM users WHERE id = $1 LIMIT 1',
        [req.userId]
      );
      const row = r.rows[0];
      return res.status(200).json({
        id: String(row.id),
        username: row.username,
        email: row.email || null,
        avatar_url: row.avatar_url || null,
      });
    } catch (err) {
      console.error('[LIBERTY] PATCH /users/me', err);
      return res.status(500).json({ message: err.message || 'Erro ao atualizar perfil' });
    }
  });

  // GET /api/v1/users/@me/relationships — lista de amigos (para modal de grupo)
  app.get('/api/v1/users/@me/relationships', auth.requireAuth, async (req, res) => {
    const userId = req.userId;
    if (!db.isConfigured() || !db.isConnected()) {
      return res.status(503).json({ message: 'Banco indisponível' });
    }
    try {
      const r = await db.query(
        `SELECT u.id, u.username FROM users u
         INNER JOIN friendships f ON (f.friend_id = u.id AND f.user_id = $1::uuid) OR (f.user_id = u.id AND f.friend_id = $2::uuid)
         WHERE f.status = 'accepted' AND u.id != $3::uuid`,
        [userId, userId, userId]
      );
      const list = r.rows.map((row) => ({ id: String(row.id), username: row.username }));
      return res.status(200).json(list);
    } catch (err) {
      console.error('[LIBERTY] GET @me/relationships', err);
      return res.status(500).json({ message: err.message || 'Erro ao listar amigos' });
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

  // Static + rota raiz
  app.use(express.static(STATIC_DIR));
  app.get('/', (_req, res) => res.sendFile(path.join(STATIC_DIR, 'index.html')));

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`LIBERTY listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Falha ao iniciar:', err);
  process.exit(1);
});

