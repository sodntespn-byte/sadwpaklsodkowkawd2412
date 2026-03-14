// Deploy Fix v3 - AES Backend Only
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import http from 'http';
import express from 'express';
import { WebSocketServer } from 'ws';
import db from './db/index.js';

dotenv.config();

// URL do banco: use .env (DATABASE_URL, BANCO_DADOS ou DB_URL). Nunca coloque senha no código.
// Square Cloud injeta BANCO_DADOS no deploy; localmente defina DATABASE_URL no .env

const ENCRYPTION_KEY_RAW = (process.env.ENCRYPTION_KEY || 'liberty-default-encryption-key-32chars').padEnd(
  32,
  '0'
);
const ENCRYPTION_KEY = Buffer.from(ENCRYPTION_KEY_RAW.slice(0, 32));
const IV_LENGTH = 16;

function encrypt(text) {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return iv.toString('base64') + ':' + encrypted;
  } catch (err) {
    console.error('ERRO SQL:', err.message);
    return text;
  }
}

function decrypt(payload) {
  try {
    if (!payload || typeof payload !== 'string' || !payload.includes(':')) return payload;
    const [ivStr, data] = payload.split(':');
    const iv = Buffer.from(ivStr, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(data, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('ERRO SQL:', err.message);
    return payload;
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 80;
const STATIC_DIR = path.join(__dirname, 'static');

app.use(express.json());
const server = http.createServer(app);

// Cache em memória das últimas mensagens por canal
// Mantém até MESSAGE_CACHE_LIMIT mensagens por canal, em ordem cronológica (mais antiga -> mais recente)
const MESSAGE_CACHE_LIMIT = 50;
const messageCache = new Map(); // channelId => [{ id, channel_id, author_id, author_username?, content, created_at, updated_at, author? }]

// Rate limiting: mensagens por usuário (30/min)
const messageRateLimit = new Map(); // userId -> { count, resetAt }
const MESSAGE_RATE_LIMIT = 30;
const MESSAGE_RATE_WINDOW_MS = 60 * 1000;

function checkMessageRateLimit(userId) {
  const now = Date.now();
  let entry = messageRateLimit.get(userId);
  if (!entry) {
    messageRateLimit.set(userId, { count: 1, resetAt: now + MESSAGE_RATE_WINDOW_MS });
    return true;
  }
  if (now >= entry.resetAt) {
    entry.count = 1;
    entry.resetAt = now + MESSAGE_RATE_WINDOW_MS;
    return true;
  }
  entry.count++;
  return entry.count <= MESSAGE_RATE_LIMIT;
}

function sanitizeContent(str) {
  if (str == null || typeof str !== 'string') return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
}

// Middleware de autenticação e JSON para rotas /api/*
app.use(authMiddleware);
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json');
  }
  next();
});

// Gateway WebSocket nativo (path /ws) — compatível com websocket.js do front
const wss = new WebSocketServer({ server, path: '/ws' });
console.log('Gateway rodando no path /ws');
app.set('wss', wss);

const userConnections = new Map();
const chatSubscriptions = new Map(); // chatId -> Set<ws>

function addUserConnection(userId, ws) {
  if (!userId) return;
  let set = userConnections.get(userId);
  if (!set) {
    set = new Set();
    userConnections.set(userId, set);
  }
  set.add(ws);
}
function removeUserConnection(userId, ws) {
  const set = userConnections.get(userId);
  if (set) {
    set.delete(ws);
    if (set.size === 0) userConnections.delete(userId);
  }
}
function sendToUser(userId, payload) {
  const set = userConnections.get(userId);
  if (!set) return;
  const str = typeof payload === 'string' ? payload : JSON.stringify(payload);
  set.forEach((client) => {
    if (client.readyState === 1) client.send(str);
  });
}

function subscribeToChat(chatId, ws) {
  if (!chatId) return;
  let set = chatSubscriptions.get(chatId);
  if (!set) {
    set = new Set();
    chatSubscriptions.set(chatId, set);
  }
  set.add(ws);
  if (!ws.subscribedChats) ws.subscribedChats = new Set();
  ws.subscribedChats.add(chatId);
}
function unsubscribeFromChat(chatId, ws) {
  const set = chatSubscriptions.get(chatId);
  if (set) {
    set.delete(ws);
    if (set.size === 0) chatSubscriptions.delete(chatId);
  }
  if (ws.subscribedChats) ws.subscribedChats.delete(chatId);
}
function broadcastToChat(chatId, payload) {
  const set = chatSubscriptions.get(chatId);
  const str = typeof payload === 'string' ? payload : JSON.stringify(payload);
  if (set && set.size > 0) {
    set.forEach((client) => {
      if (client.readyState === 1) client.send(str);
    });
  } else {
    const wssInstance = app.get('wss');
    if (wssInstance?.clients) {
      wssInstance.clients.forEach((client) => {
        if (client.readyState === 1) client.send(str);
      });
    }
  }
}

wss.on('connection', (ws, req) => {

  // Enviar hello (heartbeat 30s para evitar 1006 na Square Cloud)
  ws.send(
    JSON.stringify({
      op: 'hello',
      d: { heartbeat_interval: 30000, server_version: '1.0.0' },
    })
  );

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      const { op, d } = msg;

      if (op === 'authenticate' && d && d.token) {
        const token = String(d.token).trim();
        const userId = token.startsWith('liberty_') ? token.slice(8) : null;
        if (!userId) {
          ws.send(JSON.stringify({ op: 'auth_failed', d: { reason: 'Token inválido' } }));
          return;
        }
        if (!db.isConnected() || !db.getPool()) {
          ws.send(JSON.stringify({ op: 'auth_failed', d: { reason: 'Banco indisponível' } }));
          return;
        }
        try {
          const r = await db.getPool().query(
            'SELECT id, username, email FROM users WHERE id = $1',
            [userId]
          );
          const row = r.rows[0];
          if (!row) {
            ws.send(JSON.stringify({ op: 'auth_failed', d: { reason: 'Usuário não encontrado' } }));
            return;
          }
          const user = { id: String(row.id), username: row.username, email: row.email };
          const session_id = `session_${row.id}_${Date.now()}`;
          ws.userId = String(row.id);
          addUserConnection(ws.userId, ws);
          ws.send(
            JSON.stringify({
              op: 'authenticated',
              d: { session_id, user },
            })
          );
          // console.log('[Gateway] Autenticado:', user.username);
        } catch (err) {
          console.error('[Gateway] Erro ao validar token:', err.message);
          ws.send(JSON.stringify({ op: 'auth_failed', d: { reason: 'Erro ao validar token' } }));
        }
        return;
      }

      if (op === 'heartbeat' && d) {
        ws.send(JSON.stringify({ op: 'heartbeat_ack', d: { seq: d.seq } }));
        return;
      }

      if ((op === 'webrtc_offer' || op === 'webrtc_answer' || op === 'webrtc_ice') && d && ws.userId) {
        const target = d.target_user_id || d.to;
        if (target && d.payload !== undefined) {
          sendToUser(target, { op, d: { from_user_id: ws.userId, payload: d.payload } });
        }
        return;
      }
      if (op === 'webrtc_reject' && d && ws.userId) {
        const target = d.target_user_id || d.to;
        if (target) sendToUser(target, { op: 'webrtc_reject', d: { from_user_id: ws.userId } });
        return;
      }
      if (op === 'subscribe_channel' && d && d.chat_id) {
        subscribeToChat(String(d.chat_id).trim(), ws);
        return;
      }
      if (op === 'unsubscribe_channel' && d && d.chat_id) {
        unsubscribeFromChat(String(d.chat_id).trim(), ws);
        return;
      }
      if (op === 'stream_started' && d && ws.userId) {
        const target = d.target_user_id || d.to;
        if (target) sendToUser(target, { op: 'stream_started', d: { from_user_id: ws.userId, stream_type: d.stream_type || 'screen' } });
        return;
      }
      if (op === 'stream_stopped' && d && ws.userId) {
        const target = d.target_user_id || d.to;
        if (target) sendToUser(target, { op: 'stream_stopped', d: { from_user_id: ws.userId } });
        return;
      }
    } catch (err) {
      console.error('[Gateway] Mensagem inválida:', err.message);
    }
  });

  ws.on('close', () => {
    if (ws.userId) removeUserConnection(ws.userId, ws);
    if (ws.subscribedChats) {
      ws.subscribedChats.forEach((chatId) => unsubscribeFromChat(chatId, ws));
    }
  });
});

async function ensureTables() {
  if (!db.isConnected()) return;
  const pool = db.getPool();
  if (!pool) return;
  let client;
  try {
    client = await pool.connect();
  } catch (e) {
    console.error('[LIBERTY] Erro ao obter client para ensureTables:', e.message);
    return;
  }
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(32) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS servers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
        region VARCHAR(50),
        icon VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS chats (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100),
        type VARCHAR(20) NOT NULL DEFAULT 'channel',
        server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL DEFAULT 'member',
        joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(chat_id, user_id)
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        author TEXT NOT NULL,
        chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS friendships (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(user_id, friend_id)
      );
    `);
    await client.query(`
      ALTER TABLE friendships
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending';
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS group_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(chat_id, user_id)
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_group_members_chat ON group_members(chat_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);`);
    try {
      await client.query(`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`);
    } catch (e) {
      if (e.code !== '42701') console.warn('[LIBERTY] Migração users.password_hash:', e.message);
    }
    try {
      await client.query(`ALTER TABLE users ALTER COLUMN email DROP NOT NULL`);
    } catch (e) {
      if (e.code !== '42701') console.warn('[LIBERTY] Migração users.email:', e.message);
    }
    console.log('[LIBERTY] Tabelas verificadas/criadas: users, servers, chats, chat_members, messages, group_members');
  } catch (err) {
    console.error('[LIBERTY] Erro ao garantir tabelas:', err.message);
  } finally {
    client.release();
  }
}

function getUserIdFromAuth(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  if (!token.startsWith('liberty_')) return null;
  const id = token.slice(8).trim();
  if (!id) return null;
  return id;
}

/** Preenche req.user.id com o ID do usuário autenticado (token) para uso nas rotas. */
function authMiddleware(req, res, next) {
  const id = getUserIdFromAuth(req);
  req.user = id ? { id } : null;
  next();
}

function pushMessageToCache(channelId, message) {
  const key = String(channelId);
  const existing = messageCache.get(key) || [];
  existing.push(message);
  while (existing.length > MESSAGE_CACHE_LIMIT) {
    existing.shift();
  }
  messageCache.set(key, existing);
}

function getCachedMessages(channelId, limit) {
  const key = String(channelId);
  const existing = messageCache.get(key);
  if (!existing || existing.length === 0) return null;
  if (!limit || existing.length <= limit) return existing;
  return existing.slice(existing.length - limit);
}

async function start() {
  if (db.isConfigured()) {
    console.log('[LIBERTY] Conectando ao Neon...');
    try {
      await db.connect();
      await ensureTables();
      console.log('🚀 Banco de Dados conectado com sucesso!');
    } catch (err) {
      console.warn('[LIBERTY] Banco:', err.message);
    }
  }

  app.get('/api/health', (_req, res) => {
    try {
      res.json({
        ok: true,
        database: db.isConnected() ? 'connected' : 'disconnected',
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ═══════════════════════════════════════════
  //  FRIENDSHIPS (simple friends system)
  // ═══════════════════════════════════════════

  function requireAuth(req, res) {
    const userId = req.user?.id || getUserIdFromAuth(req);
    if (!userId) {
      res.status(401).json({ success: false, message: 'Não autorizado' });
      return null;
    }
    if (!db.isConnected() || !db.getPool()) {
      res
        .status(503)
        .json({ success: false, message: 'Banco de dados indisponível. Tente mais tarde.' });
      return null;
    }
    return String(userId).trim();
  }

  async function handleAddFriend(req, res) {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const { username, friend_id } = req.body || {};
    if (!username && !friend_id) {
      return res
        .status(400)
        .json({ success: false, message: 'É necessário informar username ou friend_id.' });
    }

    const pool = db.getPool();
    try {
      let targetUser = null;
      if (friend_id) {
        const r = await pool.query('SELECT id, username FROM users WHERE id = $1::uuid', [
          friend_id,
        ]);
        targetUser = r.rows[0] || null;
      } else if (username) {
        const r = await pool.query('SELECT id, username FROM users WHERE username = $1', [
          String(username).trim(),
        ]);
        targetUser = r.rows[0] || null;
      }

      if (!targetUser) {
        return res
          .status(404)
          .json({ success: false, message: 'Usuário não encontrado para amizade.' });
      }

      const targetId = String(targetUser.id);
      if (targetId === userId) {
        return res
          .status(400)
          .json({ success: false, message: 'Você não pode adicionar a si mesmo.' });
      }

      const fr = await pool.query(
        `INSERT INTO friendships (user_id, friend_id, status)
         VALUES ($1::uuid, $2::uuid, 'pending')
         ON CONFLICT (user_id, friend_id)
         DO UPDATE SET status = EXCLUDED.status
         RETURNING id, user_id, friend_id, status, created_at`,
        [userId, targetId]
      );
      const row = fr.rows[0];

      return res.status(201).json({
        success: true,
        friendship: {
          id: String(row.id),
          user_id: String(row.user_id),
          friend_id: String(row.friend_id),
          status: row.status,
          created_at: row.created_at,
          friend: { id: targetId, username: targetUser.username },
        },
      });
    } catch (err) {
      console.error('[FRIENDS] POST /friends/add erro:', err);
      return res
        .status(500)
        .json({ success: false, message: err.message || 'Erro ao adicionar amigo' });
    }
  }

  async function handleListFriends(req, res) {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const pool = db.getPool();
    try {
      const accepted = await pool.query(
        `SELECT f.id,
                CASE WHEN f.user_id = $1::uuid THEN f.friend_id ELSE f.user_id END AS other_id,
                f.status,
                f.created_at
         FROM friendships f
         WHERE (f.user_id = $1::uuid OR f.friend_id = $1::uuid)
           AND f.status = 'accepted'`,
        [userId]
      );

      const pending = await pool.query(
        `SELECT f.id,
                CASE WHEN f.friend_id = $1::uuid THEN f.user_id ELSE f.friend_id END AS other_id,
                f.status,
                f.created_at,
                (f.friend_id = $1::uuid) AS incoming
         FROM friendships f
         WHERE (f.user_id = $1::uuid OR f.friend_id = $1::uuid)
           AND f.status = 'pending'`,
        [userId]
      );

      const allUserIds = [
        ...new Set([
          ...accepted.rows.map((r) => String(r.other_id)),
          ...pending.rows.map((r) => String(r.other_id)),
        ]),
      ];

      let usersMap = new Map();
      if (allUserIds.length > 0) {
        const usersR = await pool.query(
          `SELECT id, username FROM users WHERE id = ANY($1::uuid[])`,
          [allUserIds]
        );
        usersMap = new Map(usersR.rows.map((u) => [String(u.id), u.username]));
      }

      const acceptedList = accepted.rows.map((r) => ({
        id: String(r.id),
        user_id: userId,
        friend_id: String(r.other_id),
        status: r.status,
        created_at: r.created_at,
        username: usersMap.get(String(r.other_id)) || 'User',
      }));

      const pendingList = pending.rows.map((r) => ({
        id: String(r.id),
        user_id: userId,
        friend_id: String(r.other_id),
        status: r.status,
        created_at: r.created_at,
        incoming: Boolean(r.incoming),
        username: usersMap.get(String(r.other_id)) || 'User',
      }));

      return res.status(200).json({
        success: true,
        accepted: acceptedList,
        pending: pendingList,
      });
    } catch (err) {
      console.error('[FRIENDS] GET /friends erro:', err);
      return res
        .status(500)
        .json({ success: false, message: err.message || 'Erro ao listar amigos' });
    }
  }

  async function handleAcceptFriend(req, res) {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const { friend_id, friendship_id } = req.body || {};
    if (!friend_id && !friendship_id) {
      return res
        .status(400)
        .json({ success: false, message: 'É necessário informar friend_id ou friendship_id.' });
    }

    const pool = db.getPool();
    try {
      let row = null;
      if (friendship_id) {
        const r = await pool.query(
          `UPDATE friendships
           SET status = 'accepted'
           WHERE id = $1::uuid
             AND friend_id = $2::uuid
             AND status = 'pending'
           RETURNING id, user_id, friend_id, status, created_at`,
          [friendship_id, userId]
        );
        row = r.rows[0] || null;
      } else {
        const r = await pool.query(
          `UPDATE friendships
           SET status = 'accepted'
           WHERE user_id = $1::uuid
             AND friend_id = $2::uuid
             AND status = 'pending'
           RETURNING id, user_id, friend_id, status, created_at`,
          [friend_id, userId]
        );
        row = r.rows[0] || null;
      }

      if (!row) {
        return res
          .status(404)
          .json({ success: false, message: 'Pedido de amizade não encontrado ou já aceito.' });
      }

      // Garante amizade recíproca
      await pool.query(
        `INSERT INTO friendships (user_id, friend_id, status)
         VALUES ($1::uuid, $2::uuid, 'accepted')
         ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'accepted'`,
        [row.friend_id, row.user_id]
      );

      const wssInstance = req.app.get('wss');
      if (wssInstance && wssInstance.clients) {
        const payload = JSON.stringify({
          op: 'friendship_accepted',
          d: { friendship_id: String(row.id), user_id: String(row.user_id), friend_id: String(row.friend_id) },
        });
        wssInstance.clients.forEach((client) => {
          if (client.readyState === 1 && (client.userId === userId || client.userId === String(row.user_id))) {
            client.send(payload);
          }
        });
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('[FRIENDS] PUT /friends/accept erro:', err);
      return res
        .status(500)
        .json({ success: false, message: err.message || 'Erro ao aceitar amizade' });
    }
  }

  // Rotas de friends (versão com prefixo /api/v1 e /api)
  app.post('/api/v1/friends/add', handleAddFriend);
  app.post('/api/friends/add', handleAddFriend);
  app.get('/api/v1/friends', handleListFriends);
  app.get('/api/friends', handleListFriends);
  app.put('/api/v1/friends/accept', handleAcceptFriend);
  app.put('/api/friends/accept', handleAcceptFriend);

  const UUID_REGEX_SIMPLE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // Chat simples: /api/messages — aceita chat_id no body; senão usa canal do Liberty
  app.post('/api/messages', async (req, res) => {
    if (!db.isConnected()) {
      return res
        .status(503)
        .json({ success: false, message: 'Banco de dados indisponível. Tente mais tarde.' });
    }
    const { content, author: bodyAuthor, chat_id: bodyChatId } = req.body || {};
    if (!content || !String(content).trim()) {
      return res.status(400).json({ success: false, message: 'content é obrigatório' });
    }

    const author = String(bodyAuthor || 'User').trim() || 'User';
    const safeContent = String(content).trim().replace(/</g, '&lt;');

    try {
      const pool = db.getPool();
      if (!pool) {
        return res
          .status(503)
          .json({ success: false, message: 'Conexão com banco de dados indisponível.' });
      }

      let chatId = null;
      if (bodyChatId && UUID_REGEX_SIMPLE.test(String(bodyChatId).trim())) {
        const check = await pool.query('SELECT id FROM chats WHERE id = $1::uuid', [String(bodyChatId).trim()]);
        if (check.rows[0]?.id) chatId = String(check.rows[0].id);
      }
      if (!chatId) {
        await ensureLibertyServer();
        const chatResult = await pool.query(
          `SELECT c.id FROM chats c
           INNER JOIN servers s ON s.id = c.server_id AND s.name = 'Liberty'
           WHERE c.type = 'channel'
           ORDER BY c.created_at ASC LIMIT 1`
        );
        chatId = chatResult.rows[0]?.id;
        if (!chatId) {
          const fallback = await pool.query(`SELECT id FROM chats ORDER BY created_at ASC LIMIT 1`);
          chatId = fallback.rows[0]?.id;
        }
      }
      if (!chatId) {
        return res
          .status(503)
          .json({ success: false, message: 'Nenhum canal disponível. Informe chat_id no body ou use o servidor Liberty.' });
      }
      chatId = String(chatId);

      const insert = await pool.query(
        `INSERT INTO messages (content, author, chat_id)
         VALUES ($1, $2, $3::uuid)
         RETURNING id, content, author, created_at`,
        [safeContent, author, chatId]
      );
      const row = insert.rows[0];

      const message = {
        id: String(row.id),
        channel_id: chatId,
        content: row.content,
        author_username: row.author,
        created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      };

      broadcastToChat(chatId, { op: 'message_created', d: { message } });
      return res.status(201).json({ success: true, message });
    } catch (err) {
      console.error('[LIBERTY] POST /api/messages erro:', err);
      return res
        .status(500)
        .json({ success: false, message: err.message || 'Erro ao salvar mensagem' });
    }
  });

  app.get('/api/messages', async (req, res) => {
    if (!db.isConnected()) {
      return res
        .status(503)
        .json({ success: false, message: 'Banco de dados indisponível. Tente mais tarde.' });
    }
    try {
      const pool = db.getPool();
      if (!pool) {
        return res
          .status(503)
          .json({ success: false, message: 'Conexão com banco de dados indisponível.' });
      }

      let chatId = req.query.channel_id || req.query.chat_id;
      if (chatId && UUID_REGEX_SIMPLE.test(String(chatId).trim())) {
        const check = await pool.query('SELECT id FROM chats WHERE id = $1::uuid', [String(chatId).trim()]);
        if (!check.rows[0]?.id) chatId = null;
        else chatId = String(check.rows[0].id);
      }
      if (!chatId) {
        const chatResult = await pool.query(
          `SELECT id FROM chats ORDER BY created_at ASC LIMIT 1`
        );
        chatId = chatResult.rows[0]?.id ? String(chatResult.rows[0].id) : null;
      }
      if (!chatId) {
        return res.status(200).json([]);
      }
      const result = await pool.query(
        `SELECT id, content, author, created_at
         FROM messages
         WHERE chat_id = $1::uuid
         ORDER BY created_at ASC
         LIMIT 50`,
        [chatId]
      );

      const messages = result.rows.map((row) => ({
        id: String(row.id),
        content: row.content,
        author_username: row.author,
        created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      }));

      return res.status(200).json(messages);
    } catch (err) {
      console.error('[LIBERTY] GET /api/messages erro:', err);
      return res
        .status(500)
        .json({ success: false, message: err.message || 'Erro ao carregar mensagens' });
    }
  });

  async function ensureLibertyServer() {
    if (!db.isConnected() || !db.getPool()) return null;
    const pool = db.getPool();
    const existing = await pool.query(`SELECT id FROM servers WHERE name = $1 LIMIT 1`, ['Liberty']);
    if (existing.rows[0]?.id) return String(existing.rows[0].id);
    const ins = await pool.query(
      `INSERT INTO servers (name, owner_id) VALUES ($1, NULL) RETURNING id`,
      ['Liberty']
    );
    const serverId = ins.rows[0].id;
    await pool.query(
      `INSERT INTO chats (name, type, server_id) VALUES ('general', 'channel', $1::uuid) RETURNING id`,
      [serverId]
    );
    return String(serverId);
  }

  async function ensureUserInLibertyServer(userId) {
    if (!db.isConnected() || !db.getPool()) return;
    const pool = db.getPool();
    const serverRow = await pool.query(`SELECT id FROM servers WHERE name = $1 LIMIT 1`, ['Liberty']);
    const serverId = serverRow.rows[0]?.id;
    if (!serverId) return;
    const chatRow = await pool.query(
      `SELECT id FROM chats WHERE server_id = $1::uuid AND type = 'channel' LIMIT 1`,
      [serverId]
    );
    const chatId = chatRow.rows[0]?.id;
    if (!chatId) return;
    await pool.query(
      `INSERT INTO chat_members (chat_id, user_id, role) VALUES ($1::uuid, $2::uuid, 'member') ON CONFLICT (chat_id, user_id) DO NOTHING`,
      [chatId, userId]
    );
  }

  app.post('/api/v1/auth/register', async (req, res) => {
    if (!db.isConnected()) {
      return res.status(503).json({ success: false, message: 'Banco de dados indisponível. Tente mais tarde.' });
    }
    const pool = db.getPool();
    if (!pool) {
      return res.status(503).json({ success: false, message: 'Banco de dados indisponível. Tente mais tarde.' });
    }
    const { username, email, password } = req.body || {};
    const name = username ? String(username).trim() : '';
    if (!name || name.length < 2) {
      return res.status(400).json({ success: false, message: 'username é obrigatório (mín. 2 caracteres)' });
    }
    try {
      await ensureLibertyServer();
      const emailVal = email && String(email).trim() ? String(email).trim().toLowerCase() : null;
      const password_hash =
        password && String(password).trim()
          ? crypto.createHash('sha256').update(String(password).trim()).digest('hex')
          : null;
      const r = await pool.query(
        `INSERT INTO users (username, email, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, username, email, created_at`,
        [name, emailVal || null, password_hash]
      );
      const row = r.rows[0];
      const user = { id: String(row.id), username: row.username, email: row.email };
      await ensureUserInLibertyServer(row.id);
      const access_token = `liberty_${row.id}`;
      return res.status(201).json({
        success: true,
        user,
        access_token,
        refresh_token: access_token,
      });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ success: false, message: 'Nome de usuário (ou email) já em uso' });
      }
      console.error('[LIBERTY] register', err.message);
      return res.status(500).json({ success: false, message: err.message || 'Erro ao criar conta' });
    }
  });

  app.post('/api/v1/auth/login', async (req, res) => {
    if (!db.isConnected()) {
      return res.status(503).json({ success: false, message: 'Banco de dados indisponível. Tente mais tarde.' });
    }
    const pool = db.getPool();
    if (!pool) {
      return res.status(503).json({ success: false, message: 'Banco de dados indisponível. Tente mais tarde.' });
    }
    const { username, password } = req.body || {};
    const name = username ? String(username).trim() : '';
    if (!name) {
      return res.status(400).json({ success: false, message: 'username é obrigatório' });
    }
    try {
      const r = await pool.query(
        'SELECT id, username, email, password_hash FROM users WHERE username = $1',
        [name]
      );
      const row = r.rows[0];
      if (!row) {
        return res.status(401).json({ success: false, message: 'Usuário ou senha inválidos' });
      }
      if (row.password_hash) {
        if (!password || crypto.createHash('sha256').update(String(password)).digest('hex') !== row.password_hash) {
          return res.status(401).json({ success: false, message: 'Usuário ou senha inválidos' });
        }
      }
      await ensureLibertyServer();
      await ensureUserInLibertyServer(row.id);
      const user = { id: String(row.id), username: row.username, email: row.email };
      const access_token = `liberty_${row.id}`;
      return res.status(200).json({
        success: true,
        user,
        access_token,
        refresh_token: access_token,
      });
    } catch (err) {
      console.error('[LIBERTY] login', err.message);
      return res.status(500).json({ success: false, message: err.message || 'Erro ao fazer login' });
    }
  });

  // Perfil: GET /api/v1/users/@me (api.js chama esta URL)
  app.get('/api/v1/users/@me', async (req, res) => {
    const userId = req.user?.id || getUserIdFromAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Não autorizado' });
    }
    if (!db.isConnected()) {
      return res.status(503).json({ success: false, message: 'Banco de dados indisponível. Tente mais tarde.' });
    }
    const pool = db.getPool();
    if (!pool) {
      return res.status(503).json({ success: false, message: 'Banco de dados indisponível. Tente mais tarde.' });
    }
    try {
      const r = await pool.query(
        'SELECT id, username, email FROM users WHERE id = $1',
        [userId]
      );
      const row = r.rows[0];
      if (!row) {
        return res.status(401).json({ success: false, message: 'Usuário não encontrado' });
      }
      const user = { id: String(row.id), username: row.username, email: row.email };
      return res.status(200).json({ success: true, user });
    } catch (err) {
      console.error('[LIBERTY] /users/@me erro:', err);
      return res.status(500).json({ success: false, message: err.message || 'Erro ao obter usuário' });
    }
  });

  // GET /api/v1/users/@me/channels — DMs existentes + amigos aceitos (para iniciar conversa)
  app.get('/api/v1/users/@me/channels', async (req, res) => {
    const userId = req.user?.id || getUserIdFromAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Não autorizado' });
    }
    if (!db.isConnected() || !db.getPool()) {
      return res.status(503).json({ success: false, message: 'Banco de dados indisponível. Tente mais tarde.' });
    }
    const pool = db.getPool();
    try {
      const channels = [];

      const dmChats = await pool.query(
        `SELECT c.id AS chat_id
         FROM chats c
         INNER JOIN chat_members cm ON cm.chat_id = c.id
         WHERE c.type = 'dm' AND cm.user_id = $1::uuid`,
        [userId]
      );

      for (const row of dmChats.rows) {
        const other = await pool.query(
          `SELECT u.id, u.username
           FROM chat_members cm
           INNER JOIN users u ON u.id = cm.user_id
           WHERE cm.chat_id = $1::uuid AND cm.user_id != $2::uuid`,
          [row.chat_id, userId]
        );
        const otherUser = other.rows[0];
        if (otherUser) {
          channels.push({
            id: String(row.chat_id),
            type: 'dm',
            recipients: [{ id: String(otherUser.id), username: otherUser.username }],
          });
        }
      }

      const accepted = await pool.query(
        `SELECT u.id, u.username
         FROM friendships f
         INNER JOIN users u ON u.id = CASE WHEN f.user_id = $1::uuid THEN f.friend_id ELSE f.user_id END
         WHERE (f.user_id = $1::uuid OR f.friend_id = $1::uuid) AND f.status = 'accepted'`,
        [userId]
      );

      const groupChats = await pool.query(
        `SELECT c.id AS chat_id, c.name FROM chats c
         INNER JOIN group_members gm ON gm.chat_id = c.id
         WHERE c.type = 'group_dm' AND gm.user_id = $1::uuid`,
        [userId]
      );
      for (const row of groupChats.rows) {
        const members = await pool.query(
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

      const existingRecipientIds = new Set(
        channels.filter((c) => c.type === 'dm' && c.recipients?.[0]).map((c) => c.recipients[0].id)
      );
      for (const row of accepted.rows) {
        const id = String(row.id);
        if (existingRecipientIds.has(id)) continue;
        channels.push({
          id: null,
          type: 'dm',
          recipients: [{ id, username: row.username }],
        });
      }

      return res.status(200).json(channels);
    } catch (err) {
      console.error('[LIBERTY] GET /users/@me/channels erro:', err);
      return res.status(500).json({ success: false, message: err.message || 'Erro ao listar canais' });
    }
  });

  // POST /api/v1/users/@me/channels — get-or-create DM (recipient_id) ou grupo (recipient_ids[])
  app.post('/api/v1/users/@me/channels', async (req, res) => {
    const userId = req.user?.id || getUserIdFromAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Não autorizado' });
    }
    if (!db.isConnected() || !db.getPool()) {
      return res.status(503).json({ success: false, message: 'Banco de dados indisponível. Tente mais tarde.' });
    }
    const body = req.body || {};
    const recipientIds = Array.isArray(body.recipient_ids) ? body.recipient_ids.filter(Boolean).map(String) : [];
    const singleId = body.recipient_id ? String(body.recipient_id).trim() : null;

    if (recipientIds.length >= 2) {
      const name = (body.name && String(body.name).trim()) || null;
      const pool = db.getPool();
      try {
        const ins = await pool.query(
          `INSERT INTO chats (name, type, server_id) VALUES ($1, 'group_dm', NULL) RETURNING id`,
          [name]
        );
        const chatId = ins.rows[0].id;
        const allIds = [userId, ...recipientIds];
        for (const uid of allIds) {
          await pool.query(
            `INSERT INTO group_members (chat_id, user_id) VALUES ($1::uuid, $2::uuid) ON CONFLICT (chat_id, user_id) DO NOTHING`,
            [chatId, uid]
          );
        }
        const members = await pool.query(
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
        return res.status(500).json({ success: false, message: err.message || 'Erro ao criar grupo' });
      }
    }

    if (!singleId) {
      return res.status(400).json({ success: false, message: 'Envie recipient_id (DM) ou recipient_ids (array com 2+) para grupo.' });
    }
    if (singleId === userId) {
      return res.status(400).json({ success: false, message: 'Não é possível abrir DM consigo mesmo.' });
    }
    const pool = db.getPool();
    try {
      const existing = await pool.query(
        `SELECT c.id
         FROM chats c
         WHERE c.type = 'dm' AND c.server_id IS NULL
           AND (SELECT COUNT(*) FROM chat_members WHERE chat_id = c.id) = 2
           AND EXISTS (SELECT 1 FROM chat_members WHERE chat_id = c.id AND user_id = $1::uuid)
           AND EXISTS (SELECT 1 FROM chat_members WHERE chat_id = c.id AND user_id = $2::uuid)`,
        [userId, singleId]
      );

      let chatId;
      if (existing.rows[0]) {
        chatId = existing.rows[0].id;
      } else {
        const ins = await pool.query(
          `INSERT INTO chats (name, type, server_id) VALUES (NULL, 'dm', NULL) RETURNING id`,
          []
        );
        chatId = ins.rows[0].id;
        await pool.query(
          `INSERT INTO chat_members (chat_id, user_id) VALUES ($1::uuid, $2::uuid), ($1::uuid, $3::uuid)`,
          [chatId, userId, singleId]
        );
      }

      const userR = await pool.query(
        'SELECT id, username FROM users WHERE id = $1::uuid',
        [singleId]
      );
      const recipient = userR.rows[0] || { id: recipientId, username: 'User' };

      return res.status(200).json({
        id: String(chatId),
        type: 'dm',
        recipients: [{ id: String(recipient.id), username: recipient.username }],
      });
    } catch (err) {
      console.error('[LIBERTY] POST /users/@me/channels erro:', err);
      return res.status(500).json({ success: false, message: err.message || 'Erro ao criar canal DM' });
    }
  });

  // POST /api/v1/groups — criar grupo (name, member_ids[]); cria chat type group_dm e group_members
  app.post('/api/v1/groups', async (req, res) => {
    const userId = req.user?.id || getUserIdFromAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Não autorizado' });
    }
    if (!db.isConnected() || !db.getPool()) {
      return res.status(503).json({ success: false, message: 'Banco de dados indisponível. Tente mais tarde.' });
    }
    const body = req.body || {};
    const name = (body.name && String(body.name).trim()) || null;
    const memberIds = Array.isArray(body.member_ids) ? body.member_ids.filter(Boolean).map(String) : [];
    if (memberIds.length < 1) {
      return res.status(400).json({ success: false, message: 'member_ids deve ter pelo menos um membro.' });
    }
    const pool = db.getPool();
    try {
      const ins = await pool.query(
        `INSERT INTO chats (name, type, server_id) VALUES ($1, 'group_dm', NULL) RETURNING id`,
        [name]
      );
      const chatId = ins.rows[0].id;
      const allIds = [userId, ...memberIds];
      for (const uid of allIds) {
        await pool.query(
          `INSERT INTO group_members (chat_id, user_id) VALUES ($1::uuid, $2::uuid) ON CONFLICT (chat_id, user_id) DO NOTHING`,
          [chatId, uid]
        );
      }
      const members = await pool.query(
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
      console.error('[LIBERTY] POST /groups erro:', err);
      return res.status(500).json({ success: false, message: err.message || 'Erro ao criar grupo' });
    }
  });

  // POST /api/v1/servers — criar servidor e canal padrão '#general'
  app.post('/api/v1/servers', async (req, res) => {
    const userId = getUserIdFromAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Não autorizado' });
    }
    if (!db.isConnected() || !db.getPool()) {
      return res.status(503).json({ success: false, message: 'Banco de dados indisponível. Tente mais tarde.' });
    }
    const { name, region, icon } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'name é obrigatório' });
    }
    const pool = db.getPool();
    try {
      const serverR = await pool.query(
        `INSERT INTO servers (name, owner_id)
         VALUES ($1, $2::uuid)
         RETURNING id, name, owner_id, created_at`,
        [String(name).trim(), userId]
      );
      const serverRow = serverR.rows[0];
      if (!serverRow) {
        console.error('[LIBERTY] POST /servers: INSERT retornou nenhuma linha');
        return res.status(500).json({ success: false, message: 'Erro ao criar servidor' });
      }
      const serverId = serverRow.id;

      const chatR = await pool.query(
        `INSERT INTO chats (name, type, server_id)
         VALUES ('general', 'channel', $1)
         RETURNING id, name, type, server_id, created_at`,
        [serverId]
      );
      const chatRow = chatR.rows[0];
      await pool.query(
        `INSERT INTO chat_members (chat_id, user_id, role)
         VALUES ($1, $2, 'member')
         ON CONFLICT (chat_id, user_id) DO NOTHING`,
        [chatRow.id, userId]
      );

      const server = {
        id: String(serverRow.id),
        name: serverRow.name,
        icon: null,
        owner_id: String(serverRow.owner_id),
        created_at: serverRow.created_at,
        channels: [
          {
            id: String(chatRow.id),
            name: chatRow.name,
            type: chatRow.type,
            channel_type: 'text',
            server_id: String(serverId),
            created_at: chatRow.created_at,
          },
        ],
      };

      const wssInstance = req.app.get('wss');
      if (wssInstance && wssInstance.clients) {
        const payload = JSON.stringify({ op: 'server_created', d: { server } });
        wssInstance.clients.forEach((client) => {
          if (client.readyState === 1 && client.userId !== userId) client.send(payload);
        });
      }

      return res.status(201).json({ success: true, server });
    } catch (err) {
      console.error('[LIBERTY] POST /servers erro:', err);
      console.error('[LIBERTY] POST /servers stack:', err.stack);
      return res.status(500).json({ success: false, message: err.message || 'Erro ao criar servidor' });
    }
  });

  // GET /api/v1/servers — listar servidores do usuário (owner_id = token)
  app.get('/api/v1/servers', async (req, res) => {
    const userId = req.user?.id || getUserIdFromAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Não autorizado' });
    }
    if (!db.isConnected() || !db.getPool()) {
      return res.status(503).json({ success: false, message: 'Banco de dados indisponível. Tente mais tarde.' });
    }
    const pool = db.getPool();
    try {
      const r = await pool.query(
        'SELECT id, name, owner_id, created_at FROM servers WHERE owner_id = $1::uuid ORDER BY created_at DESC',
        [userId.trim()]
      );
      const servers = r.rows.map((row) => ({
        id: String(row.id),
        name: row.name,
        icon: row.icon ?? null,
        owner_id: row.owner_id ? String(row.owner_id) : null,
        created_at: row.created_at,
      }));
      return res.status(200).json(servers);
    } catch (err) {
      console.error('[LIBERTY] GET /servers', err.message);
      return res.status(500).json({ success: false, message: err.message || 'Erro ao listar servidores' });
    }
  });

  // GET /api/v1/servers/:serverId — detalhes do servidor + canais
  app.get('/api/v1/servers/:serverId', async (req, res) => {
    const userId = getUserIdFromAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Não autorizado' });
    }
    if (!db.isConnected() || !db.getPool()) {
      return res.status(503).json({ success: false, message: 'Banco de dados indisponível. Tente mais tarde.' });
    }
    const { serverId } = req.params;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!serverId || !uuidRegex.test(serverId)) {
      return res.status(400).json({ success: false, message: 'serverId inválido (esperado UUID)' });
    }
    const pool = db.getPool();
    try {
      const serverR = await pool.query(
        'SELECT id, name, owner_id, created_at FROM servers WHERE id = $1::uuid',
        [serverId]
      );
      const serverRow = serverR.rows[0];
      if (!serverRow) {
        return res.status(404).json({ success: false, message: 'Servidor não encontrado' });
      }
      const channelsR = await pool.query(
        'SELECT id, name, type, server_id, created_at FROM chats WHERE server_id = $1::uuid ORDER BY created_at ASC',
        [serverId]
      );
      const channels = channelsR.rows.map((row) => ({
        id: String(row.id),
        name: row.name,
        type: row.type,
        channel_type: row.type === 'channel' ? 'text' : row.type,
        server_id: String(row.server_id),
        created_at: row.created_at,
      }));
      const ownerId = serverRow.owner_id ? String(serverRow.owner_id) : null;
      const membersR = await pool.query(
        `SELECT DISTINCT u.id, u.username
         FROM users u
         WHERE u.id IN (
           SELECT user_id FROM chat_members WHERE chat_id IN (SELECT id FROM chats WHERE server_id = $1::uuid)
           UNION
           SELECT owner_id FROM servers WHERE id = $1::uuid AND owner_id IS NOT NULL
         )
         ORDER BY u.username ASC`,
        [serverId]
      );
      const members = membersR.rows.map((row) => ({
        user_id: String(row.id),
        user: { id: String(row.id), username: row.username },
        username: row.username,
        role: ownerId && String(row.id) === ownerId ? 'owner' : 'member',
      }));
      const server = {
        id: String(serverRow.id),
        name: serverRow.name,
        icon: null,
        owner_id: serverRow.owner_id ? String(serverRow.owner_id) : null,
        created_at: serverRow.created_at,
      };
      return res.status(200).json({ server, channels, members });
    } catch (err) {
      console.error('[LIBERTY] GET /servers/:serverId erro:', err);
      console.error('[LIBERTY] GET /servers/:serverId stack:', err.stack);
      return res.status(500).json({ success: false, message: err.message || 'Erro ao carregar servidor' });
    }
  });

  // GET /api/v1/servers/:serverId/channels — lista de canais (inclui #geral / #general)
  app.get('/api/v1/servers/:serverId/channels', async (req, res) => {
    const userId = getUserIdFromAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Não autorizado' });
    }
    if (!db.isConnected() || !db.getPool()) {
      return res.status(503).json({ success: false, message: 'Banco de dados indisponível. Tente mais tarde.' });
    }
    const { serverId } = req.params;
    const pool = db.getPool();
    try {
      const r = await pool.query(
        'SELECT id, name, type, server_id, created_at FROM chats WHERE server_id = $1::uuid ORDER BY created_at ASC',
        [serverId]
      );
      const channels = r.rows.map((row) => ({
        id: String(row.id),
        name: row.name,
        type: row.type,
        channel_type: row.type === 'channel' ? 'text' : row.type,
        server_id: String(row.server_id),
        created_at: row.created_at,
      }));
      if (channels.length === 0) {
        const serverR = await pool.query('SELECT id FROM servers WHERE id = $1::uuid', [serverId]);
        if (serverR.rows[0] && serverR.rows[0].id) {
          const ins = await pool.query(
            `INSERT INTO chats (name, type, server_id) VALUES ('general', 'channel', $1::uuid) RETURNING id, name, type, server_id, created_at`,
            [serverId]
          );
          const row = ins.rows[0];
          channels.push({
            id: String(row.id),
            name: row.name,
            type: row.type,
            channel_type: 'text',
            server_id: String(row.server_id),
            created_at: row.created_at,
          });
        }
      }
      return res.status(200).json(channels);
    } catch (err) {
      console.error('[LIBERTY] GET /servers/:serverId/channels erro:', err);
      console.error('[LIBERTY] GET /servers/:serverId/channels stack:', err.stack);
      return res.status(500).json({ success: false, message: err.message || 'Erro ao listar canais' });
    }
  });

  // GET /api/v1/channels/:channelId/messages — histórico em ordem cronológica (channel_id)
  app.get('/api/v1/channels/:channelId/messages', async (req, res) => {
    const userId = req.user?.id || getUserIdFromAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Não autorizado' });
    }
    const { channelId } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const before = req.query.before;
    const after = req.query.after;

    // Caminho rápido: se não houver paginação (before/after), tentar somente o cache em memória
    if (!before && !after) {
      const cached = getCachedMessages(channelId, limit);
      if (cached) {
        return res.status(200).json(cached);
      }
    }

    // Fallback para o banco quando não há cache ou quando é uma consulta paginada
    if (!db.isConnected()) {
      return res.status(503).json({ success: false, message: 'Banco de dados indisponível. Tente mais tarde.' });
    }

    try {
      const r = await db.query(
        'SELECT id, content, author, created_at FROM messages WHERE chat_id = $1::uuid ORDER BY created_at ASC LIMIT $2',
        [channelId, limit]
      );
      const messages = r.rows.map((row) => ({
        id: String(row.id),
        channel_id: channelId,
        author_id: null,
        author_username: row.author,
        content: row.content,
        created_at: row.created_at,
      }));

      // Popular o cache em memória apenas para o carregamento inicial (sem before/after)
      if (!before && !after) {
        messageCache.set(String(channelId), messages.slice(-MESSAGE_CACHE_LIMIT));
      }

      return res.status(200).json(messages);
    } catch (err) {
      console.error('ERRO SQL:', err.message);
      console.error('ERRO CRÍTICO NO NEON (GET messages):', err.message, err.stack);
      console.error('[LIBERTY] GET /channels/:channelId/messages erro:', err);
      return res.status(500).json({ success: false, message: err.message || 'Erro ao carregar mensagens' });
    }
  });

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // POST /api/v1/channels/:channelId/messages — cria mensagem persistente no Neon (content, author, chat_id)
  app.post('/api/v1/channels/:channelId/messages', async (req, res) => {
    const userId = req.user?.id || getUserIdFromAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Não autorizado' });
    }
    if (!checkMessageRateLimit(userId)) {
      return res.status(429).json({ success: false, message: 'Muitas mensagens. Aguarde um minuto.' });
    }
    if (!db.isConnected()) {
      return res.status(503).json({ success: false, message: 'Banco de dados indisponível. Tente mais tarde.' });
    }
    const channelId = req.params.channelId;
    if (!channelId || !UUID_REGEX.test(String(channelId).trim())) {
      return res.status(400).json({ success: false, message: 'ID do canal (channelId) inválido ou ausente.' });
    }
    const chatId = String(channelId).trim();
    const { content } = req.body || {};
    if (!content || !String(content).trim()) {
      return res.status(400).json({ success: false, message: 'content é obrigatório' });
    }
    console.log('Tentando salvar mensagem no canal:', chatId);
    try {
      let username = 'User';
      try {
        const userR = await db.query('SELECT username FROM users WHERE id = $1', [userId]);
        if (userR.rows[0]?.username) username = userR.rows[0].username;
      } catch (_) {}
      const safeContent = sanitizeContent(String(content).trim());
      const insert = await db.query(
        'INSERT INTO messages (content, author, chat_id) VALUES ($1, $2, $3::uuid) RETURNING id, content, author, created_at',
        [safeContent, username, chatId]
      );
      const row = insert.rows[0];
      const message = {
        id: String(row.id),
        channel_id: chatId,
        author_id: userId,
        author_username: row.author,
        author: { id: userId, username: row.author },
        content: row.content,
        created_at: row.created_at,
        updated_at: row.created_at,
      };
      console.log('Mensagem guardada no DB (author=%s, chat_id=%s)', row.author, chatId);
      pushMessageToCache(chatId, message);

      broadcastToChat(chatId, { op: 'message_created', d: { message } });

      return res.status(201).json(message);
    } catch (err) {
      console.error('ERRO SQL:', err.message);
      console.error('ERRO CRÍTICO NO NEON:', err.message, err.stack);
      console.error('[LIBERTY] POST /channels/:channelId/messages erro:', err);
      return res.status(500).json({ success: false, message: err.message || 'Erro ao salvar mensagem' });
    }
  });

  // DELETE /api/v1/messages/:id — remove mensagem se for do autor e notifica via WebSocket
  app.delete('/api/v1/messages/:id', async (req, res) => {
    const userId = req.user?.id || getUserIdFromAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Não autorizado' });
    }
    if (!db.isConnected() || !db.getPool()) {
      return res.status(503).json({ success: false, message: 'Banco de dados indisponível. Tente mais tarde.' });
    }
    const { id } = req.params;
    const pool = db.getPool();
    let username = null;
    try {
      const u = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
      username = u.rows[0]?.username;
    } catch (_) {}
    if (!username) {
      return res.status(403).json({ success: false, message: 'Usuário não encontrado.' });
    }
    try {
      const r = await pool.query(
        'DELETE FROM messages WHERE id = $1 AND author = $2 RETURNING id, chat_id',
        [id, username]
      );
      const row = r.rows[0];
      if (!row) {
        return res.status(404).json({ success: false, message: 'Mensagem não encontrada ou não é sua.' });
      }

      const chatId = row.chat_id ? String(row.chat_id) : null;
      if (chatId) {
        broadcastToChat(chatId, { op: 'message_deleted', d: { message_id: id } });
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('ERRO SQL:', err.message);
      console.error('[LIBERTY] DELETE /messages/:id erro:', err);
      return res.status(500).json({ success: false, message: err.message || 'Erro ao deletar mensagem' });
    }
  });

  // GET /api/v1/servers/:serverId/members — membros do servidor (owner + membros dos canais)
  app.get('/api/v1/servers/:serverId/members', async (req, res) => {
    const userId = getUserIdFromAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Não autorizado' });
    }
    if (!db.isConnected() || !db.getPool()) {
      return res.status(503).json({ success: false, message: 'Banco de dados indisponível. Tente mais tarde.' });
    }
    const { serverId } = req.params;
    const pool = db.getPool();
    try {
      const serverR = await pool.query(
        'SELECT owner_id FROM servers WHERE id = $1::uuid',
        [serverId]
      );
      const ownerId = serverR.rows[0]?.owner_id ? String(serverR.rows[0].owner_id) : null;
      const r = await pool.query(
        `SELECT DISTINCT u.id, u.username
         FROM users u
         WHERE u.id IN (
           SELECT user_id FROM chat_members WHERE chat_id IN (SELECT id FROM chats WHERE server_id = $1::uuid)
           UNION
           SELECT owner_id FROM servers WHERE id = $1::uuid AND owner_id IS NOT NULL
         )
         ORDER BY u.username ASC`,
        [serverId]
      );
      const members = r.rows.map((row) => ({
        user_id: String(row.id),
        user: { id: String(row.id), username: row.username },
        username: row.username,
        role: ownerId && String(row.id) === ownerId ? 'owner' : 'member',
      }));
      return res.status(200).json(members);
    } catch (err) {
      console.error('[LIBERTY] GET /servers/:serverId/members erro:', err);
      return res.status(500).json({ success: false, message: err.message || 'Erro ao listar membros' });
    }
  });

  // GET /api/v1/relationships/pending — pedidos pendentes recebidos
  app.get('/api/v1/relationships/pending', async (req, res) => {
    const userId = req.user?.id || getUserIdFromAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Não autorizado' });
    }
    if (!db.isConnected() || !db.getPool()) {
      return res.status(503).json({ success: false, message: 'Banco de dados indisponível. Tente mais tarde.' });
    }
    const pool = db.getPool();
    try {
      const r = await pool.query(
        `SELECT f.id, u.id AS user_id, u.username
         FROM friendships f
         JOIN users u ON u.id = f.user_id
         WHERE f.friend_id = $1::uuid AND f.status = 'pending'
         ORDER BY f.created_at ASC`,
        [userId]
      );
      return res.status(200).json(r.rows);
    } catch (err) {
      console.error('ERRO SQL:', err.message);
      console.error('[LIBERTY] GET /relationships/pending erro:', err);
      return res.status(500).json({ success: false, message: err.message || 'Erro ao listar pendentes' });
    }
  });

  // PATCH /api/v1/relationships/:id/accept — aceitar pedido pendente
  app.patch('/api/v1/relationships/:id/accept', async (req, res) => {
    const userId = req.user?.id || getUserIdFromAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Não autorizado' });
    }
    if (!db.isConnected() || !db.getPool()) {
      return res.status(503).json({ success: false, message: 'Banco de dados indisponível. Tente mais tarde.' });
    }
    const { id } = req.params;
    const pool = db.getPool();
    try {
      const relR = await pool.query(
        `SELECT user_id, friend_id, status
         FROM friendships
         WHERE id = $1::uuid AND friend_id = $2::uuid`,
        [id, userId]
      );
      const rel = relR.rows[0];
      if (!rel || rel.status !== 'pending') {
        return res.status(404).json({ success: false, message: 'Pedido não encontrado ou já tratado' });
      }

      await pool.query(
        `UPDATE friendships SET status = 'accepted' WHERE id = $1::uuid`,
        [id]
      );

      await pool.query(
        `INSERT INTO friendships (user_id, friend_id, status)
         VALUES ($1::uuid, $2::uuid, 'accepted')
         ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'accepted'`,
        [userId, rel.user_id]
      );

      const wssInstance = req.app.get('wss');
      if (wssInstance && wssInstance.clients) {
        const payload = JSON.stringify({
          op: 'friendship_accepted',
          d: { friendship_id: id, user_id: String(rel.user_id), friend_id: String(rel.friend_id) },
        });
        wssInstance.clients.forEach((client) => {
          if (client.readyState === 1 && (client.userId === userId || client.userId === String(rel.user_id))) {
            client.send(payload);
          }
        });
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('[LIBERTY] PATCH /relationships/:id/accept erro:', err);
      return res.status(500).json({ success: false, message: err.message || 'Erro ao aceitar pedido' });
    }
  });

  // DELETE /api/v1/relationships/:id — remover/cancelar amizade ou pedido
  app.delete('/api/v1/relationships/:id', async (req, res) => {
    const userId = req.user?.id || getUserIdFromAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Não autorizado' });
    }
    if (!db.isConnected() || !db.getPool()) {
      return res.status(503).json({ success: false, message: 'Banco de dados indisponível. Tente mais tarde.' });
    }
    const { id } = req.params;
    const pool = db.getPool();
    try {
      const r = await pool.query(
        'DELETE FROM friendships WHERE id = $1::uuid AND (user_id = $2::uuid OR friend_id = $2::uuid) RETURNING id',
        [id, userId]
      );
      if (!r.rows[0]) {
        return res.status(404).json({ success: false, message: 'Pedido/amizade não encontrado.' });
      }
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('[LIBERTY] DELETE /relationships/:id erro:', err);
      return res.status(500).json({ success: false, message: err.message || 'Erro ao remover' });
    }
  });

  // POST /api/v1/relationships — adicionar amigo por username ou user_id
  app.post('/api/v1/relationships', async (req, res) => {
    const userId = req.user?.id || getUserIdFromAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Não autorizado' });
    }
    if (!db.isConnected() || !db.getPool()) {
      return res.status(503).json({ success: false, message: 'Banco de dados indisponível. Tente mais tarde.' });
    }
    const { username, user_id: bodyUserId } = req.body || {};
    const byUsername = username != null && String(username).trim() !== '';
    const byId = bodyUserId != null && String(bodyUserId).trim() !== '';
    if (!byUsername && !byId) {
      return res.status(400).json({ success: false, message: 'username ou user_id é obrigatório' });
    }
    const pool = db.getPool();
    try {
      let friendRow = null;
      if (byId) {
        const r = await pool.query('SELECT id, username FROM users WHERE id = $1::uuid', [
          String(bodyUserId).trim(),
        ]);
        friendRow = r.rows[0] || null;
      } else {
        const r = await pool.query('SELECT id, username FROM users WHERE username = $1', [
          String(username).trim(),
        ]);
        friendRow = r.rows[0] || null;
      }
      if (!friendRow) {
        return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
      }
      const friendId = String(friendRow.id);
      if (friendId === userId) {
        return res.status(400).json({ success: false, message: 'Você não pode adicionar a si mesmo.' });
      }
      const ins = await pool.query(
        `INSERT INTO friendships (user_id, friend_id, status)
         VALUES ($1::uuid, $2::uuid, 'pending')
         ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'pending'
         RETURNING id, user_id, friend_id, status, created_at`,
        [userId, friendId]
      );
      const row = ins.rows[0];
      const friendship = {
        id: String(row.id),
        user_id: String(row.user_id),
        friend_id: String(row.friend_id),
        status: row.status,
        friend: { id: friendId, username: friendRow.username },
      };

      const wssInstance = req.app.get('wss');
      if (wssInstance && wssInstance.clients) {
        const payloadRecipient = JSON.stringify({
          op: 'friend_added',
          d: { user: { id: userId, username: req.currentUserUsername || null } },
        });
        const payloadSender = JSON.stringify({
          op: 'friendship_pending_sent',
          d: { friendship },
        });
        wssInstance.clients.forEach((client) => {
          if (client.readyState !== 1) return;
          if (client.userId === friendId) client.send(payloadRecipient);
          else if (client.userId === userId) client.send(payloadSender);
        });
      }

      return res.status(201).json({ success: true, friend: friendship.friend });
    } catch (err) {
      console.error('[LIBERTY] POST /relationships erro:', err);
      return res.status(500).json({ success: false, message: err.message || 'Erro ao adicionar amigo' });
    }
  });

  // GET /api/v1/relationships — lista de amigos e pendentes (type: 1=accepted, 3=pending_incoming, 4=pending_outgoing)
  app.get('/api/v1/relationships', async (req, res) => {
    const userId = req.user?.id || getUserIdFromAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Não autorizado' });
    }
    if (!db.isConnected() || !db.getPool()) {
      return res.status(503).json({ success: false, message: 'Banco de dados indisponível. Tente mais tarde.' });
    }
    const pool = db.getPool();
    try {
      const acceptedR = await pool.query(
        `SELECT f.id, f.user_id, f.friend_id,
                CASE WHEN f.user_id = $1::uuid THEN f.friend_id ELSE f.user_id END AS other_id
         FROM friendships f
         WHERE (f.user_id = $1::uuid OR f.friend_id = $1::uuid) AND f.status = 'accepted'`,
        [userId]
      );
      const pendingR = await pool.query(
        `SELECT f.id, f.user_id, f.friend_id,
                CASE WHEN f.user_id = $1::uuid THEN f.friend_id ELSE f.user_id END AS other_id,
                (f.friend_id = $1::uuid) AS incoming
         FROM friendships f
         WHERE (f.user_id = $1::uuid OR f.friend_id = $1::uuid) AND f.status = 'pending'`,
        [userId]
      );
      const allIds = [
        ...new Set([
          ...acceptedR.rows.map((r) => String(r.other_id)),
          ...pendingR.rows.map((r) => String(r.other_id)),
        ]),
      ];
      let users = {};
      if (allIds.length > 0) {
        const u = await pool.query(
          'SELECT id, username FROM users WHERE id = ANY($1::uuid[])',
          [allIds]
        );
        u.rows.forEach((row) => {
          users[String(row.id)] = { id: String(row.id), username: row.username };
        });
      }
      const list = [];
      acceptedR.rows.forEach((r) => {
        const otherId = String(r.other_id);
        list.push({
          id: String(r.id),
          type: 1,
          user: users[otherId] || { id: otherId, username: 'User' },
        });
      });
      pendingR.rows.forEach((r) => {
        const otherId = String(r.other_id);
        list.push({
          id: String(r.id),
          type: r.incoming ? 3 : 4,
          user: users[otherId] || { id: otherId, username: 'User' },
        });
      });
      return res.status(200).json(list);
    } catch (err) {
      console.error('[LIBERTY] GET /relationships erro:', err);
      return res.status(500).json({ success: false, message: err.message || 'Erro ao listar amigos' });
    }
  });

  app.use(express.static(STATIC_DIR, { index: 'index.html' }));
  app.get('*', (_req, res) => {
    try {
      res.sendFile(path.join(STATIC_DIR, 'index.html'));
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`LIBERTY listening on port ${PORT}`);
    if (db.isConnected()) console.log('PostgreSQL: conectado');
    else if (db.isConfigured()) console.log('PostgreSQL: indisponível');
    else console.log('PostgreSQL: usando fallback de URL');
  });
}

start().catch((err) => {
  console.error('Falha ao iniciar:', err);
  process.exit(1);
});

// Tratamento global de erros não capturados para evitar que o processo morra silenciosamente
process.on('uncaughtException', (err) => {
  console.error('[GLOBAL] uncaughtException:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[GLOBAL] unhandledRejection:', reason);
});











