/**
 * LIBERTY - Rotas da API REST
 * Auth por username (senha opcional), mensagens, amizades
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { sanitizeString, sanitizeUsername } = require('../middleware/sanitize');
const crypto = require('crypto');

const SESSION_SECRET = process.env.SESSION_SECRET || 'liberty-default-change-in-production';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function createToken(userId) {
  const payload = JSON.stringify({ userId, exp: Date.now() + SESSION_MAX_AGE_MS });
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return Buffer.from(payload).toString('base64url') + '.' + sig;
}

function verifyToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    const sig = crypto.createHmac('sha256', SESSION_SECRET).update(parts[0]).digest('hex');
    if (sig !== parts[1] || payload.exp < Date.now()) return null;
    return payload.userId;
  } catch {
    return null;
  }
}

function authOptional(req, res, next) {
  const token = req.cookies?.liberty_token || req.headers.authorization?.replace(/^Bearer\s+/i, '');
  req.userId = verifyToken(token);
  next();
}

function authRequired(req, res, next) {
  if (!req.userId) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
}

// —— Auth: login por username (senha opcional) ——
router.post('/auth/register', async (req, res) => {
  try {
    const username = sanitizeUsername(req.body?.username || '');
    if (!username || username.length < 2) {
      return res.status(400).json({ error: 'Username inválido (mín. 2 caracteres)' });
    }
    const password = req.body?.password != null ? String(req.body.password) : null;
    let passwordHash = null;
    if (password && password.length > 0) {
      passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    }
    const user = await db.createUser(username, passwordHash);
    if (!user) return res.status(500).json({ error: 'Erro ao criar usuário' });
    const token = createToken(user.id);
    res.cookie('liberty_token', token, { httpOnly: true, maxAge: SESSION_MAX_AGE_MS, sameSite: 'lax' });
    res.status(201).json({
      ok: true,
      user: { id: user.id, username: user.username },
      token
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao registrar' });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const username = sanitizeUsername(req.body?.username || '');
    if (!username) {
      return res.status(400).json({ error: 'Username obrigatório' });
    }
    let user = await db.getUserByUsername(username);
    if (!user) {
      user = await db.createUser(username, null);
      if (!user) return res.status(500).json({ error: 'Erro ao criar usuário' });
    } else {
      const password = req.body?.password != null ? String(req.body.password) : null;
      if (user.password_hash) {
        if (!password) {
          return res.status(400).json({ error: 'Esta conta exige senha' });
        }
        const hash = crypto.createHash('sha256').update(password).digest('hex');
        if (hash !== user.password_hash) {
          return res.status(401).json({ error: 'Senha incorreta' });
        }
      }
    }
    const token = createToken(user.id);
    res.cookie('liberty_token', token, { httpOnly: true, maxAge: SESSION_MAX_AGE_MS, sameSite: 'lax' });
    res.json({
      ok: true,
      user: { id: user.id, username: user.username },
      token
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

router.post('/auth/logout', (req, res) => {
  res.clearCookie('liberty_token');
  res.json({ ok: true });
});

router.get('/auth/me', authOptional, async (req, res) => {
  if (!req.userId || !db.pool) {
    return res.json({ user: null });
  }
  try {
    const r = await db.pool.query('SELECT id, username, created_at FROM liberty_users WHERE id = $1', [req.userId]);
    const user = r.rows[0];
    if (!user) return res.json({ user: null });
    res.json({ user: { id: user.id, username: user.username } });
  } catch (e) {
    res.json({ user: null });
  }
});

// —— Health ——
router.get('/health', (req, res) => {
  res.json({ ok: true, db: !!db.pool, ws: true });
});

// —— Mensagens de canal (chat_id = channel:serverId:channelId) ——
router.get('/servers/:serverId/channels/:channelId/messages', authOptional, async (req, res) => {
  try {
    const chatId = 'channel:' + req.params.serverId + ':' + req.params.channelId;
    const limit = Math.min(parseInt(req.query.limit, 10) || 500, 1000);
    const list = await db.getMessages(chatId, limit);
    res.json(list.map((m) => ({
      id: m.id,
      author: m.author,
      avatar: null,
      text: m.text || m.content,
      time: m.time,
      attachments: []
    })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao buscar mensagens' });
  }
});

router.post('/servers/:serverId/channels/:channelId/messages', authRequired, async (req, res) => {
  try {
    const chatId = 'channel:' + req.params.serverId + ':' + req.params.channelId;
    const body = req.body || {};
    const id = body.id || require('crypto').randomUUID();
    const content = sanitizeString(body.text != null ? body.text : body.content || '(arquivo)');
    const authorId = req.userId;
    const row = await db.addMessage(id, content, authorId, chatId);
    const room = 'channel:' + req.params.serverId + ':' + req.params.channelId;
    req.app.get('io').to(room).emit('message', { type: 'message', room, message: { id: row.id, author: row.author, avatar: null, text: row.text, time: row.time, attachments: [] } });
    res.status(201).json({ ok: true, time: row.time });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao salvar mensagem' });
  }
});

// —— Mensagens DM (chat_id = conversationId) ——
router.get('/dm/:conversationId/messages', authOptional, async (req, res) => {
  try {
    const chatId = req.params.conversationId;
    const limit = Math.min(parseInt(req.query.limit, 10) || 500, 1000);
    const list = await db.getMessages(chatId, limit);
    res.json(list.map((m) => ({
      id: m.id,
      author: m.author,
      avatar: null,
      text: m.text || m.content,
      time: m.time,
      attachments: []
    })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao buscar mensagens DM' });
  }
});

router.post('/dm/:conversationId/messages', authRequired, async (req, res) => {
  try {
    const chatId = req.params.conversationId;
    const body = req.body || {};
    const id = body.id || require('crypto').randomUUID();
    const content = sanitizeString(body.text != null ? body.text : body.content || '(arquivo)');
    const authorId = req.userId;
    const row = await db.addMessage(id, content, authorId, chatId);
    const room = 'dm:' + chatId;
    req.app.get('io').to(room).emit('message', { type: 'message', room, message: { id: row.id, author: row.author, avatar: null, text: row.text, time: row.time, attachments: [] } });
    res.status(201).json({ ok: true, time: row.time });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao salvar mensagem DM' });
  }
});

// —— Amizades ——
router.post('/friend-requests', authRequired, async (req, res) => {
  try {
    const body = req.body || {};
    const fromUserId = req.userId;
    const fromUsernameResult = await db.pool.query('SELECT username FROM liberty_users WHERE id = $1', [fromUserId]);
    const fromUsername = fromUsernameResult.rows[0]?.username || body.fromUsername || '';
    const toUsername = sanitizeUsername(body.toUsername || '');
    if (!toUsername) {
      return res.status(400).json({ error: 'toUsername obrigatório' });
    }
    const req_ = await db.addFriendRequest(fromUserId, fromUsername, toUsername);
    if (!req_) {
      return res.status(409).json({ error: 'Convite já enviado ou usuário não encontrado' });
    }
    res.status(201).json({ ok: true, request: req_ });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao enviar convite' });
  }
});

router.get('/friend-requests/received/:username', authOptional, async (req, res) => {
  try {
    const username = decodeURIComponent(req.params.username || '');
    const list = await db.getFriendRequestsReceivedByUsername(username);
    res.json(list);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao buscar convites' });
  }
});

router.post('/friend-requests/:id/accept', authRequired, async (req, res) => {
  try {
    const id = req.params.id;
    const acceptedByUserId = req.userId;
    const r = await db.pool.query('SELECT username FROM liberty_users WHERE id = $1', [acceptedByUserId]);
    const acceptedByUsername = r.rows[0]?.username || '';
    const req_ = await db.acceptFriendRequest(id, acceptedByUserId, acceptedByUsername);
    if (!req_) {
      return res.status(404).json({ error: 'Convite não encontrado ou já aceito' });
    }
    res.json({ ok: true, request: req_ });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao aceitar convite' });
  }
});

router.get('/friends/:userId', authOptional, async (req, res) => {
  try {
    const userId = req.params.userId;
    const list = await db.getFriendsForUser(userId);
    res.json(list);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao buscar amigos' });
  }
});

router.post('/account/delete', authRequired, async (req, res) => {
  try {
    const body = req.body || {};
    const userId = req.userId;
    const username = sanitizeUsername(body.username || '');
    if (!username) {
      return res.status(400).json({ error: 'username obrigatório' });
    }
    await db.deleteUserData(userId, username);
    res.clearCookie('liberty_token');
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao apagar dados' });
  }
});

module.exports = router;
