/**
 * LIBERTY — Servidor único: express + http + socket.io.
 * Sem dados em memória: usuários, mensagens e amigos vêm exclusivamente do Neon (SQL).
 * Estado apenas de conexão Socket (quem está online) para broadcast.
 */
import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import http from 'http';
import express from 'express';
import helmet from 'helmet';
import bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import { Server as SocketIOServer } from 'socket.io';
import db from './db/index.js';
import { init as dbInit } from './db/init.js';
import * as auth from './auth.js';
import * as ws from './ws.js';
import apiRouter from './routes/api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3000;
const STATIC_DIR = path.join(__dirname, 'static');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "wss:", "ws:", "https://libretranslate.com"],
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
app.use(cookieParser());
app.use(auth.middleware);
app.use('/api', apiRouter);

const server = http.createServer(app);

// —— Helpers (somente leitura/escrita no Neon, nenhum array em memória) ——
async function getDefaultChatId() {
  if (!db.isConfigured() || !db.isConnected()) return null;
  try {
    const existing = await db.query(
      `SELECT id FROM chats WHERE name = $1 AND type = 'channel' ORDER BY created_at ASC LIMIT 1`,
      ['global-chat']
    );
    if (existing.rows[0]?.id) return String(existing.rows[0].id);
    let serverId = null;
    const s = await db.query(`SELECT id FROM servers ORDER BY created_at ASC LIMIT 1`);
    if (s.rows[0]?.id) serverId = s.rows[0].id;
    else {
      const ins = await db.query(`INSERT INTO servers (name) VALUES ($1) RETURNING id`, ['Global Server']);
      serverId = ins.rows[0].id;
    }
    const insChat = await db.query(
      `INSERT INTO chats (name, type, server_id) VALUES ($1, 'channel', $2) RETURNING id`,
      ['global-chat', serverId]
    );
    return String(insChat.rows[0].id);
  } catch (err) {
    console.error('[server] getDefaultChatId:', err.message);
    return null;
  }
}

async function start() {
  const JWT_SECRET = process.env.JWT_SECRET || 'chave-temporaria-liberty';
  if (!process.env.JWT_SECRET) process.env.JWT_SECRET = JWT_SECRET;

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
    pingTimeout: 60000,
    pingInterval: 25000,
  });
  app.set('io', io);

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    const payload = token ? auth.verify(token) : null;
    socket.userId = payload && payload.sub ? String(payload.sub) : null;
    next();
  });

  // Estado apenas de conexão (socketId → userId/username); não armazena dados de aplicação
  const socketToUser = new Map();
  const userIdToSockets = new Map();

  function addOnline(socketId, userId, username) {
    socketToUser.set(socketId, { userId, username: username || userId });
    if (!userIdToSockets.has(userId)) userIdToSockets.set(userId, new Set());
    userIdToSockets.get(userId).add(socketId);
  }

  function removeOnline(socketId) {
    const u = socketToUser.get(socketId);
    socketToUser.delete(socketId);
    if (u && userIdToSockets.has(u.userId)) {
      userIdToSockets.get(u.userId).delete(socketId);
      if (userIdToSockets.get(u.userId).size === 0) userIdToSockets.delete(u.userId);
    }
  }

  function broadcastUserList() {
    const seen = new Set();
    const list = [];
    for (const u of socketToUser.values()) {
      if (seen.has(u.userId)) continue;
      seen.add(u.userId);
      list.push({ userId: u.userId, username: u.username || u.userId });
    }
    io.emit('user_list', list);
  }

  function emitToUser(userId, event, data) {
    const set = userIdToSockets.get(userId);
    if (set) set.forEach((sid) => io.to(sid).emit(event, data));
  }

  app.locals.emitMessage = function (message) {
    ws.emitMessage(message);
    if (message && message.chat_id) io.to(message.chat_id).emit('message', { type: 'message', data: message });
  };

  io.on('connection', (socket) => {
    socket.on('auth', async (payload) => {
      const userId = socket.userId || (payload && (payload.userId || payload.user_id));
      if (!userId) return;
      let username = (payload && (payload.username || '')) || String(userId);
      if (db.isConfigured() && db.isConnected()) {
        try {
          let u = await db.query('SELECT id, username FROM liberty_users WHERE id = $1::uuid LIMIT 1', [userId]);
          if (!u.rows[0]) u = await db.query('SELECT id, username FROM users WHERE id = $1::uuid LIMIT 1', [userId]);
          if (!u.rows[0]) return;
          username = u.rows[0].username || username;
        } catch (_) { return; }
      }
      addOnline(socket.id, String(userId), String(username));
      socket.join('user:' + String(userId));
      io.emit('user-joined', { userId: String(userId), username: String(username) });
      broadcastUserList();
    });

    socket.on('subscribe', (payload) => {
      const room = payload && (payload.room || payload.chat_id || payload.chatId);
      if (room) socket.join(room);
    });
    socket.on('unsubscribe', (payload) => {
      const room = payload && (payload.room || payload.chat_id || payload.chatId);
      if (room) socket.leave(room);
    });

    socket.on('call-user', (payload) => {
      if (!socket.userId) return;
      const toUserId = payload && payload.toUserId;
      const offer = payload && payload.offer;
      if (!toUserId || !offer) return;
      const fromUsername = (payload.fromUsername != null) ? payload.fromUsername : (socketToUser.get(socket.id)?.username || socket.userId);
      emitToUser(toUserId, 'incoming-call', { fromUserId: socket.userId, fromUsername, offer });
    });
    socket.on('make-answer', (payload) => {
      if (!socket.userId) return;
      const toUserId = payload && payload.toUserId;
      const answer = payload && payload.answer;
      if (!toUserId || !answer) return;
      emitToUser(toUserId, 'call-answer', { fromUserId: socket.userId, answer });
    });
    socket.on('ice-candidates', (payload) => {
      if (!socket.userId) return;
      const toUserId = payload && payload.toUserId;
      const candidate = payload && payload.candidate;
      if (!toUserId || !candidate) return;
      emitToUser(toUserId, 'call-ice-candidate', { fromUserId: socket.userId, candidate });
    });
    socket.on('call-ended', (payload) => {
      if (!socket.userId) return;
      const toUserId = payload && payload.toUserId;
      if (toUserId) emitToUser(toUserId, 'call-ended', { fromUserId: socket.userId });
    });

    socket.on('disconnect', () => {
      const u = socketToUser.get(socket.id);
      if (u) io.emit('user-left', { userId: u.userId, username: u.username });
      removeOnline(socket.id);
      broadcastUserList();
    });
  });

  // —— Rotas HTTP: tudo via Neon, sem arrays em memória ——

  // POST /api/messages — JWT obrigatório, INSERT no Neon, retorna objeto criado, depois io.emit para todos
  app.post('/api/messages', auth.requireAuth, async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) {
      return res.status(503).json({ message: 'Banco indisponível' });
    }
    const { content } = req.body || {};
    if (!content || !String(content).trim()) {
      return res.status(400).json({ message: 'content é obrigatório' });
    }
    const safeContent = String(content).trim().replace(/</g, '&lt;');
    const userId = req.userId;
    try {
      const chatId = await getDefaultChatId();
      if (!chatId) {
        return res.status(503).json({ message: 'Chat padrão indisponível' });
      }
      const result = await db.query(
        `INSERT INTO messages (content, chat_id, user_id)
         VALUES ($1, $2, $3)
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
      const created = {
        id: String(row.id),
        content: row.content,
        author: username,
        author_username: username,
        username,
        avatar_url: avatarUrl,
        channelId: 'default-channel',
        timestamp: row.created_at || new Date(),
        chat_id: chatId,
      };
      io.emit('message', { type: 'message', data: created });
      return res.status(201).json({
        id: created.id,
        content: created.content,
        author_username: username,
        username,
        avatar_url: avatarUrl,
        created_at: new Date(created.timestamp).toISOString(),
      });
    } catch (err) {
      console.error('[API] POST /api/messages:', err.message);
      return res.status(500).json({ message: err.message || 'Erro ao salvar mensagem' });
    }
  });

  // GET /api/messages — histórico direto do Neon
  app.get('/api/messages', async (_req, res) => {
    if (!db.isConfigured() || !db.isConnected()) {
      return res.status(503).json({ message: 'Banco indisponível' });
    }
    try {
      const chatId = await getDefaultChatId();
      if (!chatId) return res.status(200).json([]);
      const result = await db.query(
        `SELECT m.id, m.content, m.created_at, m.user_id,
          u.username AS author_username, u.avatar_url AS avatar_url
         FROM messages m
         LEFT JOIN users u ON u.id = m.user_id
         WHERE m.chat_id = $1 ORDER BY m.created_at ASC LIMIT 50`,
        [chatId]
      );
      const response = result.rows.map((row) => ({
        id: String(row.id),
        content: String(row.content || '').trim().replace(/</g, '&lt;'),
        author_username: row.author_username || 'User',
        username: row.author_username || 'User',
        avatar_url: row.avatar_url || null,
        created_at: (row.created_at && new Date(row.created_at).toISOString()) || new Date().toISOString(),
      }));
      return res.status(200).json(response);
    } catch (err) {
      console.error('[API] GET /api/messages:', err.message);
      return res.status(500).json({ message: err.message || 'Erro ao carregar mensagens' });
    }
  });

  // GET /api/users/me — perfil do usuário autenticado (Neon), ID real do banco
  app.get('/api/users/me', auth.requireAuth, async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) {
      return res.status(503).json({ message: 'Banco indisponível' });
    }
    try {
      let r = await db.query(
        'SELECT id, username, email, avatar_url, created_at FROM users WHERE id = $1::uuid LIMIT 1',
        [req.userId]
      );
      if (!r.rows[0]) {
        r = await db.query(
          'SELECT id, username, avatar_url, created_at FROM liberty_users WHERE id = $1::uuid LIMIT 1',
          [req.userId]
        );
      }
      const row = r.rows[0];
      if (!row) return res.status(404).json({ message: 'Usuário não encontrado' });
      return res.status(200).json({
        id: String(row.id),
        username: row.username,
        email: row.email != null ? row.email : null,
        avatar_url: row.avatar_url != null ? row.avatar_url : null,
        created_at: row.created_at,
      });
    } catch (err) {
      console.error('[API] GET /api/users/me:', err.message);
      return res.status(500).json({ message: err.message || 'Erro ao buscar perfil' });
    }
  });

  // POST /api/friends — adicionar amigo por username (verifica no banco, INSERT em friendships)
  app.post('/api/friends', auth.requireAuth, async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) {
      return res.status(503).json({ message: 'Banco indisponível' });
    }
    const { username } = req.body || {};
    const name = username != null ? String(username).trim() : '';
    if (!name) return res.status(400).json({ message: 'username é obrigatório' });
    const myId = req.userId;
    try {
      let r = await db.query('SELECT id FROM users WHERE username = $1 LIMIT 1', [name]);
      if (!r.rows[0]) r = await db.query('SELECT id FROM liberty_users WHERE username = $1 LIMIT 1', [name]);
      const friend = r.rows[0];
      if (!friend) return res.status(404).json({ message: 'Usuário não encontrado' });
      const friendId = friend.id;
      if (friendId === myId) return res.status(400).json({ message: 'Não é possível adicionar a si mesmo' });
      await db.query(
        `INSERT INTO friendships (user_id, friend_id, status)
         VALUES ($1::uuid, $2::uuid, 'accepted')
         ON CONFLICT (user_id, friend_id) DO NOTHING`,
        [myId, friendId]
      );
      return res.status(201).json({ success: true, friend_id: String(friendId), username: name });
    } catch (err) {
      if (err.code === '23503') return res.status(404).json({ message: 'Usuário não encontrado' });
      console.error('[API] POST /api/friends:', err.message);
      return res.status(500).json({ message: err.message || 'Erro ao adicionar amigo' });
    }
  });

  // GET /api/friends — lista de amigos do Neon (friendships + users)
  app.get('/api/friends', auth.requireAuth, async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) {
      return res.status(503).json({ message: 'Banco indisponível' });
    }
    const userId = req.userId;
    try {
      const r = await db.query(
        `SELECT u.id, u.username, u.avatar_url
         FROM users u
         INNER JOIN friendships f ON (f.friend_id = u.id AND f.user_id = $1::uuid) OR (f.user_id = u.id AND f.friend_id = $1::uuid)
         WHERE f.status = 'accepted' AND u.id != $1::uuid`,
        [userId]
      );
      const list = r.rows.map((row) => ({
        id: String(row.id),
        username: row.username,
        avatar_url: row.avatar_url || null,
      }));
      return res.status(200).json(list);
    } catch (err) {
      console.error('[API] GET /api/friends:', err.message);
      return res.status(500).json({ message: err.message || 'Erro ao listar amigos' });
    }
  });

  // Rotas legadas /api/v1/ (auth, channels, etc.) mantidas para compatibilidade
  async function ensureLibertyServer() {
    if (!db.isConnected()) return null;
    const existing = await db.query(`SELECT id FROM servers WHERE name = $1 LIMIT 1`, ['Liberty']);
    if (existing.rows[0]?.id) return String(existing.rows[0].id);
    const ins = await db.query(`INSERT INTO servers (name, owner_id) VALUES ($1, NULL) RETURNING id`, ['Liberty']);
    const serverId = ins.rows[0].id;
    await db.query(`INSERT INTO chats (name, type, server_id) VALUES ('general', 'channel', $1::uuid) RETURNING id`, [serverId]);
    return String(serverId);
  }

  async function ensureUserInLibertyServer(userId) {
    if (!db.isConnected()) return;
    const serverRow = await db.query(`SELECT id FROM servers WHERE name = $1 LIMIT 1`, ['Liberty']);
    const serverId = serverRow.rows[0]?.id;
    if (!serverId) return;
    const chatRow = await db.query(`SELECT id FROM chats WHERE server_id = $1::uuid AND type = 'channel' LIMIT 1`, [serverId]);
    const chatId = chatRow.rows[0]?.id;
    if (!chatId) return;
    await db.query(
      `INSERT INTO chat_members (chat_id, user_id, role) VALUES ($1::uuid, $2::uuid, 'member') ON CONFLICT (chat_id, user_id) DO NOTHING`,
      [chatId, userId]
    );
  }

  app.post('/api/v1/auth/register', async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) return res.status(503).json({ message: 'Banco indisponível' });
    const { username, email, password, device_id: deviceId } = req.body || {};
    const name = username ? String(username).trim() : '';
    if (!name || name.length < 2) return res.status(400).json({ message: 'username é obrigatório (mín. 2 caracteres)' });
    try {
      const existing = await db.query(
        `SELECT 1 FROM users WHERE username = $1 OR (email IS NOT NULL AND email = $2) LIMIT 1`,
        [name, email && String(email).trim() ? String(email).trim().toLowerCase() : null]
      );
      if (existing.rows.length > 0) return res.status(400).json({ message: 'Nome de usuário ou email já em uso' });
      await ensureLibertyServer();
      const emailVal = email && String(email).trim() ? String(email).trim().toLowerCase() : null;
      const password_hash = password && String(password).trim() ? await bcrypt.hash(String(password).trim(), 10) : null;
      const deviceIdVal = deviceId && String(deviceId).trim() ? String(deviceId).trim() : null;
      const r = await db.query(
        `INSERT INTO users (username, email, password_hash, device_id) VALUES ($1, $2, $3, $4) RETURNING id, username, email, created_at`,
        [name, emailVal, password_hash, deviceIdVal]
      );
      const row = r.rows[0];
      await ensureUserInLibertyServer(row.id);
      const user = { id: String(row.id), username: row.username, email: row.email };
      const access_token = auth.sign(user);
      return res.status(201).json({ success: true, user, access_token, refresh_token: access_token, trusted_device: !!deviceIdVal });
    } catch (err) {
      if (err.code === '23505') return res.status(400).json({ message: 'Nome de usuário ou email já em uso' });
      console.error('[API] register', err.message);
      return res.status(500).json({ message: err.message || 'Erro ao criar conta' });
    }
  });

  app.post('/api/v1/auth/login', async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) return res.status(503).json({ message: 'Banco indisponível' });
    const { username, password, device_id: deviceId } = req.body || {};
    const name = username ? String(username).trim() : '';
    if (!name) return res.status(400).json({ message: 'username é obrigatório' });
    try {
      const r = await db.query(`SELECT id, username, email, password_hash, device_id FROM users WHERE username = $1 LIMIT 1`, [name]);
      const row = r.rows[0];
      if (!row) return res.status(401).json({ message: 'Usuário ou senha inválidos' });
      if (row.password_hash) {
        const passOk = typeof password === 'string' && password.trim().length > 0 && (await bcrypt.compare(password.trim(), row.password_hash));
        if (!passOk) return res.status(401).json({ message: 'Usuário ou senha inválidos' });
      }
      const deviceIdVal = deviceId && String(deviceId).trim() ? String(deviceId).trim() : null;
      const trustedDevice = !!row.device_id && !!deviceIdVal && row.device_id === deviceIdVal;
      if (deviceIdVal && !row.device_id) {
        await db.query(`UPDATE users SET device_id = $1 WHERE id = $2`, [deviceIdVal, row.id]);
      }
      await ensureLibertyServer();
      await ensureUserInLibertyServer(row.id);
      const user = { id: String(row.id), username: row.username, email: row.email };
      const access_token = auth.sign(user);
      return res.status(200).json({ success: true, user, access_token, refresh_token: access_token, trusted_device: trustedDevice });
    } catch (err) {
      console.error('[API] login', err.message);
      return res.status(500).json({ message: err.message || 'Erro ao fazer login' });
    }
  });

  app.get('/api/v1/default-chat', async (_req, res) => {
    try {
      const chatId = await getDefaultChatId();
      if (!chatId) return res.status(404).json({ message: 'Chat padrão indisponível' });
      return res.status(200).json({ chat_id: chatId });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/v1/users/me', auth.requireAuth, async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) return res.status(503).json({ message: 'Banco indisponível' });
    try {
      const r = await db.query('SELECT id, username, email, avatar_url, created_at FROM users WHERE id = $1 LIMIT 1', [req.userId]);
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
      console.error('[API] GET /users/me', err.message);
      return res.status(500).json({ message: err.message || 'Erro ao buscar perfil' });
    }
  });

  app.patch('/api/v1/users/me', auth.requireAuth, async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) return res.status(503).json({ message: 'Banco indisponível' });
    const { avatar_url } = req.body || {};
    const url = avatar_url != null ? String(avatar_url).trim() : null;
    if (url !== null && url.length > 0 && !/^https?:\/\//i.test(url)) {
      return res.status(400).json({ message: 'avatar_url deve ser uma URL (http ou https)' });
    }
    try {
      await db.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [url || null, req.userId]);
      const r = await db.query('SELECT id, username, email, avatar_url FROM users WHERE id = $1 LIMIT 1', [req.userId]);
      const row = r.rows[0];
      if (io) io.emit('profile-updated', { userId: String(req.userId), avatar_url: row?.avatar_url || null });
      return res.status(200).json({
        id: String(row.id),
        username: row.username,
        email: row.email || null,
        avatar_url: row.avatar_url || null,
      });
    } catch (err) {
      console.error('[API] PATCH /users/me', err.message);
      return res.status(500).json({ message: err.message || 'Erro ao atualizar perfil' });
    }
  });

  app.get('/api/v1/users/@me/relationships', auth.requireAuth, async (req, res) => {
    if (!db.isConfigured() || !db.isConnected()) return res.status(503).json({ message: 'Banco indisponível' });
    try {
      const r = await db.query(
        `SELECT u.id, u.username FROM users u
         INNER JOIN friendships f ON (f.friend_id = u.id AND f.user_id = $1::uuid) OR (f.user_id = u.id AND f.friend_id = $1::uuid)
         WHERE f.status = 'accepted' AND u.id != $1::uuid`,
        [req.userId]
      );
      return res.status(200).json(r.rows.map((row) => ({ id: String(row.id), username: row.username })));
    } catch (err) {
      console.error('[API] GET @me/relationships', err.message);
      return res.status(500).json({ message: err.message || 'Erro ao listar amigos' });
    }
  });

  app.get('/favicon.ico', (req, res) => {
    const p = path.join(STATIC_DIR, 'favicon.ico');
    if (fs.existsSync(p)) res.sendFile(p);
    else res.status(204).end();
  });

  app.use(express.static(STATIC_DIR, { index: false }));
  app.get('/', (_req, res) => res.sendFile(path.join(STATIC_DIR, 'index.html')));

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`LIBERTY listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Falha ao iniciar:', err);
  process.exit(1);
});
