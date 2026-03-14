// Deploy Fix v3 - AES Backend Only
import 'dotenv/config';
import pathMod from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import http from 'http';
import express from 'express';
import { WebSocketServer } from 'ws';
import db from './db/index.js';

// Banco: preferir DATABASE_URL do .env; fallback Neon (evite commitar senhas — use .env em produção)
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_hA4T1qFgXSjp@ep-shy-bird-andk4mtt-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
}

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

const __dirname = pathMod.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 80;
const STATIC_DIR = pathMod.join(__dirname, 'static');

app.use(express.json());
const server = http.createServer(app);

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
wss.on('connection', (ws, req) => {

  // Enviar hello imediatamente para o front iniciar heartbeat e enviar authenticate
  ws.send(
    JSON.stringify({
      op: 'hello',
      d: { heartbeat_interval: 41250, server_version: '1.0.0' },
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
            'SELECT id, COALESCE(username, nome) AS username, email FROM users WHERE id = $1',
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
    } catch (err) {
      console.error('[Gateway] Mensagem inválida:', err.message);
    }
  });

  ws.on('close', () => {
    // WebSocket desconectado (silenciado)
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
        email VARCHAR(255),
        password_hash VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    // Migrações: tabela users pode já existir com outro esquema (nome, username, etc.)
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS nome VARCHAR(32)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(32)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now()`);
    try {
      await client.query(`UPDATE users SET username = nome WHERE (username IS NULL OR username = '') AND nome IS NOT NULL`);
    } catch (e) { /* ignore */ }
    try {
      await client.query(`UPDATE users SET nome = username WHERE (nome IS NULL OR nome = '') AND username IS NOT NULL`);
    } catch (e) { /* ignore */ }
    try {
      await client.query(`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`);
    } catch (e) { if (e.code !== '42701') console.warn('[LIBERTY] Migração password_hash:', e.message); }
    try {
      await client.query(`ALTER TABLE users ALTER COLUMN email DROP NOT NULL`);
    } catch (e) { if (e.code !== '42701') console.warn('[LIBERTY] Migração email:', e.message); }
    try {
      await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_username_key ON users (username)`);
    } catch (e) { if (e.code !== '42P07') console.warn('[LIBERTY] Índice username:', e.message); }
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
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS friendships (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(user_id, friend_id)
      );
    `);
    console.log('[LIBERTY] Tabelas verificadas/criadas: users, servers, chats, chat_members, messages');
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

async function start() {
  if (db.isConfigured()) {
    console.log('[LIBERTY] Conectando ao banco...');
    const connected = await db.connect();
    if (connected) {
      await ensureTables();
      console.log('🚀 Banco de Dados conectado com sucesso!');
    } else {
      console.warn('[LIBERTY] Banco indisponível. Verifique DATABASE_URL e SSL.');
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

  app.post('/api/v1/auth/register', async (req, res) => {
    if (!db.isConnected()) {
      return res.status(503).json({ success: false, message: 'Banco de dados indisponível. Tente mais tarde.' });
    }
    const pool = db.getPool();
    if (!pool) {
      return res.status(503).json({ success: false, message: 'Banco de dados indisponível. Tente mais tarde.' });
    }
    const { username } = req.body || {};
    const name = username ? String(username).trim() : '';
    if (!name || name.length < 2) {
      return res.status(400).json({ success: false, message: 'username é obrigatório (mín. 2 caracteres)' });
    }
    try {
      const r = await pool.query(
        `INSERT INTO users (id, nome, username, email, password_hash)
         VALUES (gen_random_uuid(), $1, $1, $2, NULL)
         RETURNING id, nome, username, email, created_at`,
        [name, name.toLowerCase() + '@liberty.local']
      );
      const row = r.rows[0];
      const user = { id: String(row.id), username: row.username ?? row.nome, email: row.email };
      const access_token = `liberty_${row.id}`;
      return res.status(201).json({
        success: true,
        user,
        access_token,
        refresh_token: access_token,
      });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ success: false, message: 'Email ou nome de usuário já em uso' });
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
    const { username } = req.body || {};
    const name = username ? String(username).trim() : '';
    if (!name) {
      return res.status(400).json({ success: false, message: 'username é obrigatório' });
    }
    try {
      const r = await pool.query(
        'SELECT id, nome, username, email, password_hash FROM users WHERE (username = $1 OR nome = $1)',
        [name]
      );
      const row = r.rows[0];
      if (!row) {
        return res.status(401).json({ success: false, message: 'Usuário não encontrado' });
      }
      const user = { id: String(row.id), username: row.username ?? row.nome, email: row.email };
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
        'SELECT id, nome, username, email FROM users WHERE id = $1',
        [userId]
      );
      const row = r.rows[0];
      if (!row) {
        return res.status(401).json({ success: false, message: 'Usuário não encontrado' });
      }
      const user = { id: String(row.id), username: row.username ?? row.nome, email: row.email };
      return res.status(200).json({ success: true, user });
    } catch (err) {
      console.error('[LIBERTY] /users/@me erro:', err);
      return res.status(500).json({ success: false, message: err.message || 'Erro ao obter usuário' });
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
        `SELECT DISTINCT u.id, COALESCE(u.username, u.nome) AS username
         FROM users u
         WHERE u.id IN (
           SELECT user_id FROM chat_members WHERE chat_id IN (SELECT id FROM chats WHERE server_id = $1::uuid)
           UNION
           SELECT owner_id FROM servers WHERE id = $1::uuid AND owner_id IS NOT NULL
         )
         ORDER BY COALESCE(u.username, u.nome) ASC`,
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
    if (!db.isConnected()) {
      return res.status(503).json({ success: false, message: 'Banco de dados indisponível. Tente mais tarde.' });
    }
    const { channelId } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    try {
      const r = await db.query(
        'SELECT * FROM messages WHERE channel_id = $1::uuid ORDER BY created_at ASC LIMIT $2',
        [channelId, limit]
      );
      const messages = r.rows.map((row) => ({
        ...row,
        id: String(row.id),
        channel_id: String(row.channel_id),
        author_id: row.author_id ? String(row.author_id) : null,
        content: decrypt(row.content),
      }));
      return res.status(200).json(messages);
    } catch (err) {
      console.error('ERRO SQL:', err.message);
      console.error('ERRO CRÍTICO NO NEON (GET messages):', err.message, err.stack);
      console.error('[LIBERTY] GET /channels/:channelId/messages erro:', err);
      return res.status(500).json({ success: false, message: err.message || 'Erro ao carregar mensagens' });
    }
  });

  // POST /api/v1/channels/:channelId/messages — cria mensagem persistente no Neon (content, channel_id, author_id)
  app.post('/api/v1/channels/:channelId/messages', async (req, res) => {
    const userId = req.user?.id || getUserIdFromAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Não autorizado' });
    }
    if (!db.isConnected()) {
      return res.status(503).json({ success: false, message: 'Banco de dados indisponível. Tente mais tarde.' });
    }
    const { channelId } = req.params;
    const { content } = req.body || {};
    if (!content || !String(content).trim()) {
      return res.status(400).json({ success: false, message: 'content é obrigatório' });
    }
    console.log('Tentando salvar mensagem no canal:', channelId);
    try {
      const encryptedContent = encrypt(String(content).trim());
      const insert = await db.query(
        'INSERT INTO messages (content, channel_id, author_id) VALUES ($1, $2, $3) RETURNING *',
        [encryptedContent, channelId, userId]
      );
      const row = insert.rows[0];
      const userR = await db.query('SELECT COALESCE(username, nome) AS username FROM users WHERE id = $1', [row.author_id]);
      const username = userR.rows[0]?.username || 'User';
      const message = {
        id: String(row.id),
        channel_id: String(row.channel_id),
        author_id: row.author_id ? String(row.author_id) : null,
        author_username: username,
        author: row.author_id ? { id: String(row.author_id), username } : null,
        content: decrypt(row.content),
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
      console.log('Mensagem guardada no DB:', row.content);
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
    try {
      const r = await pool.query(
        'DELETE FROM messages WHERE id = $1::uuid AND author_id = $2::uuid RETURNING channel_id',
        [id, userId]
      );
      const row = r.rows[0];
      if (!row) {
        return res.status(404).json({ success: false, message: 'Mensagem não encontrada ou não é sua.' });
      }

      const wssInstance = req.app.get('wss');
      if (wssInstance && wssInstance.clients) {
        const payload = JSON.stringify({
          op: 'message_deleted',
          d: { message_id: id },
        });
        wssInstance.clients.forEach((client) => {
          if (client.readyState === 1) {
            client.send(payload);
          }
        });
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
        `SELECT DISTINCT u.id, COALESCE(u.username, u.nome) AS username
         FROM users u
         WHERE u.id IN (
           SELECT user_id FROM chat_members WHERE chat_id IN (SELECT id FROM chats WHERE server_id = $1::uuid)
           UNION
           SELECT owner_id FROM servers WHERE id = $1::uuid AND owner_id IS NOT NULL
         )
         ORDER BY COALESCE(u.username, u.nome) ASC`,
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
        `SELECT f.id, u.id AS user_id, COALESCE(u.username, u.nome) AS username
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

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('[LIBERTY] PATCH /relationships/:id/accept erro:', err);
      return res.status(500).json({ success: false, message: err.message || 'Erro ao aceitar pedido' });
    }
  });

  // POST /api/v1/relationships — adicionar amigo por username
  app.post('/api/v1/relationships', async (req, res) => {
    const userId = req.user?.id || getUserIdFromAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Não autorizado' });
    }
    if (!db.isConnected() || !db.getPool()) {
      return res.status(503).json({ success: false, message: 'Banco de dados indisponível. Tente mais tarde.' });
    }
    const { username } = req.body || {};
    if (!username || !String(username).trim()) {
      return res.status(400).json({ success: false, message: 'username é obrigatório' });
    }
    const pool = db.getPool();
    try {
      const userR = await pool.query(
        'SELECT id, COALESCE(username, nome) AS username FROM users WHERE (username = $1 OR nome = $1)',
        [String(username).trim()]
      );
      const friendRow = userR.rows[0];
      if (!friendRow) {
        return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
      }
      const friendId = String(friendRow.id);
      if (friendId === userId) {
        return res.status(400).json({ success: false, message: 'Você não pode adicionar a si mesmo.' });
      }
      // Pedido pendente (apenas um registro, status 'pending')
      await pool.query(
        `INSERT INTO friendships (user_id, friend_id, status)
         VALUES ($1::uuid, $2::uuid, 'pending')
         ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'pending'`,
        [userId, friendId]
      );

      const friend = { id: friendId, username: friendRow.username };

      // Notificar o outro usuário em tempo real, se estiver online
      const wssInstance = req.app.get('wss');
      if (wssInstance && wssInstance.clients) {
        const payload = JSON.stringify({
          op: 'friend_added',
          d: { user: { id: userId, username: req.currentUserUsername || null } },
        });
        wssInstance.clients.forEach((client) => {
          if (client.readyState === 1 && client.userId === friendId) {
            client.send(payload);
          }
        });
      }

      return res.status(201).json({ success: true, friend });
    } catch (err) {
      console.error('[LIBERTY] POST /relationships erro:', err);
      return res.status(500).json({ success: false, message: err.message || 'Erro ao adicionar amigo' });
    }
  });

  // GET /api/v1/relationships — lista de amigos
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
      const r = await pool.query(
        `SELECT u.id, COALESCE(u.username, u.nome) AS username
         FROM friendships f
         JOIN users u ON u.id = f.friend_id
         WHERE f.user_id = $1::uuid AND f.status = 'accepted'
         ORDER BY COALESCE(u.username, u.nome) ASC`,
        [userId]
      );
      const friends = r.rows.map((row) => ({
        id: String(row.id),
        username: row.username,
      }));
      return res.status(200).json(friends);
    } catch (err) {
      console.error('[LIBERTY] GET /relationships erro:', err);
      return res.status(500).json({ success: false, message: err.message || 'Erro ao listar amigos' });
    }
  });

  app.use(express.static(STATIC_DIR, { index: 'index.html' }));
  app.get('*', (_req, res) => {
    try {
      res.sendFile(pathMod.join(STATIC_DIR, 'index.html'));
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`LIBERTY listening on port ${PORT}`);
    if (db.isConnected()) console.log('PostgreSQL: conectado');
    else if (db.isConfigured()) console.log('PostgreSQL: indisponível');
    else console.log('PostgreSQL: defina DATABASE_URL no .env');
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

