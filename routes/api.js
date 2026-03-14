/**
 * LIBERTY - Rotas da API REST — ESM
 * Auth por username + senha (bcrypt), mensagens, amizades. Emits Socket.io para real-time.
 */

import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import db from '../lib/db.js';
import { sanitizeString, sanitizeUsername } from '../lib/sanitize.js';

const router = express.Router();

const SESSION_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'liberty-default-change-in-production';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

if (!process.env.SESSION_SECRET && !process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.warn('[API] SESSION_SECRET ou JWT_SECRET não definido; defina em produção.');
}

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
  if (req.userId) return next();
  const raw = req.headers.authorization;
  const bearerToken = raw && raw.startsWith('Bearer ') ? raw.slice(7).trim() : '';
  const xToken = (req.headers['x-auth-token'] || req.headers['X-Auth-Token'] || '').trim();
  const bodyToken = (req.body && (req.body.token || req.body.access_token)) ? String(req.body.token || req.body.access_token).trim() : '';
  const queryToken = (req.query && (req.query.token || req.query.access_token)) ? String(req.query.token || req.query.access_token).trim() : '';
  const token = req.cookies?.liberty_token || bearerToken || xToken || bodyToken || queryToken || '';
  req.userId = verifyToken(token || null);
  if (process.env.NODE_ENV !== 'production' && (req.path === '/auth/me' || req.path.includes('messages'))) {
    if (token) {
      console.log('[API] Token recebido para', req.method, req.path, '— userId:', req.userId || 'inválido/expirado');
    } else {
      console.log('[API] Requisição sem token (cookie ou Bearer) para', req.method, req.path);
    }
  }
  next();
}

function authRequired(req, res, next) {
  if (!req.userId) {
    console.log('[API] 401 Não autorizado —', req.method, req.path, '| token ausente ou inválido');
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
}

function getIo(req) {
  return req.app.get('io');
}

// Todas as rotas podem receber token via cookie ou Authorization: Bearer
router.use(authOptional);

// —— Auth ——
router.post('/auth/register', async (req, res) => {
  try {
    const username = sanitizeUsername(req.body?.username || '');
    if (!username || username.length < 2) return res.status(400).json({ error: 'Username inválido (mín. 2 caracteres)' });
    const existing = await db.getUserByUsername(username);
    if (existing) {
      console.log('[API] register — nome já em uso:', username);
      return res.status(400).json({ error: 'Este nome de usuário já está em uso. Escolha outro.' });
    }
    const password = req.body?.password != null ? String(req.body.password) : null;
    let passwordHash = null;
    if (password && password.length > 0) {
      passwordHash = await bcrypt.hash(password, 10);
    }
    const user = await db.createUser(username, passwordHash);
    if (!user) return res.status(500).json({ error: 'Erro ao criar usuário' });
    const token = createToken(user.id);
    res.cookie('liberty_token', token, { httpOnly: true, maxAge: SESSION_MAX_AGE_MS, sameSite: 'lax' });
    res.status(201).json({ ok: true, user: { id: user.id, username: user.username, avatar_url: user.avatar_url || null, banner_url: user.banner_url || null }, token });
  } catch (e) {
    if (e.code === '23505') {
      console.log('[API] register — constraint duplicata:', req.body?.username);
      return res.status(400).json({ error: 'Este nome de usuário já está em uso. Escolha outro.' });
    }
    console.error('[API] register', e);
    res.status(500).json({ error: 'Erro ao registrar' });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const username = sanitizeUsername(req.body?.username || '');
    if (!username) {
      console.log('[API] login falhou — username vazio');
      return res.status(400).json({ error: 'Username obrigatório' });
    }
    const user = await db.getUserByUsername(username);
    if (!user) {
      console.log('[API] login falhou — usuário não encontrado:', username);
      return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }
    if (user.password_hash) {
      const password = req.body?.password != null ? String(req.body.password).trim() : '';
      if (!password) {
        console.log('[API] login falhou — senha vazia para usuário:', username);
        return res.status(401).json({ error: 'Usuário ou senha inválidos' });
      }
      const isBcrypt = user.password_hash.startsWith('$2');
      const passwordOk = isBcrypt
        ? await bcrypt.compare(password, user.password_hash)
        : crypto.createHash('sha256').update(password).digest('hex') === user.password_hash;
      if (!passwordOk) {
        console.log('[API] login falhou — senha incorreta para usuário:', username);
        return res.status(401).json({ error: 'Usuário ou senha inválidos' });
      }
    }
    const token = createToken(user.id);
    res.cookie('liberty_token', token, { httpOnly: true, maxAge: SESSION_MAX_AGE_MS, sameSite: 'lax' });
    res.json({ ok: true, user: { id: user.id, username: user.username, avatar_url: user.avatar_url || null, banner_url: user.banner_url || null }, token });
  } catch (e) {
    console.error('[API] login erro:', e);
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

router.post('/auth/logout', (req, res) => {
  res.clearCookie('liberty_token');
  res.json({ ok: true });
});

router.get('/auth/me', authOptional, async (req, res) => {
  if (!req.userId || !db.pool) return res.json({ user: null });
  try {
    const user = await db.getUserById(req.userId);
    if (!user) return res.json({ user: null });
    res.json({ user: { id: user.id, username: user.username, avatar_url: user.avatar_url || null, banner_url: user.banner_url || null } });
  } catch (e) {
    res.json({ user: null });
  }
});

function isValidProfileUrl(url, field) {
  if (url == null || url === '') return true;
  const s = String(url).trim();
  if (s.startsWith('data:image/') && s.includes(';base64,')) return s.length <= 600000;
  if (/^https?:\/\//i.test(s)) return true;
  return false;
}

router.patch('/auth/me', authRequired, async (req, res) => {
  try {
    const { avatar_url, banner_url } = req.body || {};
    const avatarUrl = avatar_url != null ? String(avatar_url).trim() : undefined;
    const bannerUrl = banner_url != null ? String(banner_url).trim() : undefined;
    if (avatarUrl !== undefined && avatarUrl !== '' && !isValidProfileUrl(avatarUrl, 'avatar_url')) {
      return res.status(400).json({ error: 'avatar_url deve ser uma URL (http ou https) ou uma imagem em base64 (data:image/...)' });
    }
    if (bannerUrl !== undefined && bannerUrl !== '' && !isValidProfileUrl(bannerUrl, 'banner_url')) {
      return res.status(400).json({ error: 'banner_url deve ser uma URL (http ou https) ou uma imagem em base64 (data:image/...)' });
    }
    const user = await db.updateUserProfile(req.userId, {
      avatar_url: avatarUrl !== undefined ? (avatarUrl || null) : undefined,
      banner_url: bannerUrl !== undefined ? (bannerUrl || null) : undefined
    });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    const ioMe = getIo(req);
    if (ioMe) ioMe.emit('profile-updated', { userId: req.userId, avatar_url: user.avatar_url || null, banner_url: user.banner_url || null });
    res.json({ user: { id: user.id, username: user.username, avatar_url: user.avatar_url || null, banner_url: user.banner_url || null } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao atualizar perfil' });
  }
});

router.patch('/auth/update-profile', authRequired, async (req, res) => {
  try {
    const { avatar_url, banner_url } = req.body || {};
    const avatarUrl = avatar_url != null ? String(avatar_url).trim() : undefined;
    const bannerUrl = banner_url != null ? String(banner_url).trim() : undefined;
    if (avatarUrl !== undefined && avatarUrl !== '' && !isValidProfileUrl(avatarUrl, 'avatar_url')) {
      return res.status(400).json({ error: 'avatar_url deve ser uma URL (http ou https) ou uma imagem em base64 (data:image/...)' });
    }
    if (bannerUrl !== undefined && bannerUrl !== '' && !isValidProfileUrl(bannerUrl, 'banner_url')) {
      return res.status(400).json({ error: 'banner_url deve ser uma URL (http ou https) ou uma imagem em base64 (data:image/...)' });
    }
    const user = await db.updateUserProfile(req.userId, {
      avatar_url: avatarUrl !== undefined ? (avatarUrl || null) : undefined,
      banner_url: bannerUrl !== undefined ? (bannerUrl || null) : undefined
    });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    const io = getIo(req);
    if (io) io.emit('profile-updated', { userId: req.userId, avatar_url: user.avatar_url || null, banner_url: user.banner_url || null });
    res.json({ user: { id: user.id, username: user.username, avatar_url: user.avatar_url || null, banner_url: user.banner_url || null } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao atualizar perfil' });
  }
});

// —— Health ——
router.get('/health', (req, res) => {
  res.json({ ok: true, db: !!db.pool, ws: true });
});

// —— Convites de servidor ——
router.post('/servers/:serverId/invites', authRequired, async (req, res) => {
  try {
    const serverId = req.params.serverId;
    const isMember = await db.isMemberOfServer(serverId, req.userId);
    if (!isMember) return res.status(403).json({ error: 'Você não é membro deste servidor' });
    const inv = await db.createInvite(serverId, req.userId);
    if (!inv) return res.status(404).json({ error: 'Servidor não encontrado' });
    const base = (req.protocol + '://' + req.get('host') || '').replace(/\/$/, '');
    res.status(201).json({ code: inv.code, link: base + '/#invite/' + inv.code, server_id: inv.server_id, server_name: inv.server_name });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao criar convite' });
  }
});

router.get('/invites/:code', authOptional, async (req, res) => {
  try {
    const code = (req.params.code || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ error: 'Código inválido' });
    const inv = await db.getInviteByCode(code);
    if (!inv) return res.status(404).json({ error: 'Convite não encontrado ou expirado' });
    const memberCount = await db.getServerMemberCount(inv.server_id);
    res.json({ server: { id: inv.server_id, name: inv.server_name }, memberCount });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao buscar convite' });
  }
});

router.post('/invites/:code/join', authRequired, async (req, res) => {
  try {
    const code = (req.params.code || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ error: 'Código inválido' });
    const inv = await db.getInviteByCode(code);
    if (!inv) return res.status(404).json({ error: 'Convite não encontrado ou expirado' });
    const already = await db.isMemberOfServer(inv.server_id, req.userId);
    if (already) return res.status(409).json({ error: 'Você já é membro deste servidor', server: { id: inv.server_id, name: inv.server_name } });
    await db.addMemberToServer(inv.server_id, req.userId);
    const memberCount = await db.getServerMemberCount(inv.server_id);
    res.json({
      server: {
        id: inv.server_id,
        name: inv.server_name,
        channels: [
          { id: 'general', name: 'geral', type: 'text', categoryId: null, permissions: { view: ['@todos'], send: ['@todos'] } },
          { id: 'voz', name: 'voz', type: 'voice', categoryId: null, permissions: { view: ['@todos'], send: ['@todos'] } }
        ],
        categories: [],
        memberCount
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao entrar no servidor' });
  }
});

// —— Mensagens canal ——
router.get('/servers/:serverId/channels/:channelId/messages', authOptional, async (req, res) => {
  try {
    const chatId = 'channel:' + req.params.serverId + ':' + req.params.channelId;
    const limit = Math.min(parseInt(req.query.limit, 10) || 500, 1000);
    const list = await db.getMessages(chatId, limit);
    res.json(list.map((m) => ({ id: m.id, author: m.author, avatar: m.avatar || null, text: m.text || m.content, time: m.time, attachments: [] })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao buscar mensagens' });
  }
});

router.post('/servers/:serverId/channels/:channelId/messages', authRequired, async (req, res) => {
  try {
    const chatId = 'channel:' + req.params.serverId + ':' + req.params.channelId;
    const body = req.body || {};
    console.log('[api] POST channel message recebido:', { chatId, authorId: req.userId, textLength: (body.text || body.content || '').length });
    const id = body.id || crypto.randomUUID();
    const content = sanitizeString(body.text != null ? body.text : body.content || '(arquivo)');
    const row = await db.addMessage(id, content, req.userId, chatId);
    const room = 'channel:' + req.params.serverId + ':' + req.params.channelId;
    const msg = {
      id: row.id,
      author: row.author,
      avatar: row.avatar || null,
      text: row.text,
      time: row.time,
      attachments: [],
      content: row.text,
      username: row.author,
      avatar_url: row.avatar || null,
      timestamp: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
    };
    const msgPayload = { type: 'message', room, message: msg };
    const io = getIo(req);
    if (io) {
      io.to(room).emit('message', msgPayload);
      console.log('[api] Broadcast enviado para room:', room);
    } else {
      console.warn('[api] io não disponível, broadcast não enviado');
    }
    res.status(201).json({ ok: true, time: row.time });
  } catch (e) {
    console.error('[api] Erro ao salvar mensagem canal:', e.message, e.code || '', e.detail || '');
    res.status(500).json({ error: 'Erro ao salvar mensagem' });
  }
});

// —— Mensagens DM ——
router.get('/dm/:conversationId/messages', authOptional, async (req, res) => {
  try {
    const chatId = req.params.conversationId;
    const limit = Math.min(parseInt(req.query.limit, 10) || 500, 1000);
    const list = await db.getMessages(chatId, limit);
    res.json(list.map((m) => ({ id: m.id, author: m.author, avatar: m.avatar || null, text: m.text || m.content, time: m.time, attachments: [] })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao buscar mensagens DM' });
  }
});

router.post('/dm/:conversationId/messages', authRequired, async (req, res) => {
  try {
    const chatId = req.params.conversationId;
    const body = req.body || {};
    console.log('[api] POST DM message recebido:', { chatId, authorId: req.userId, textLength: (body.text || body.content || '').length });
    const id = body.id || crypto.randomUUID();
    const content = sanitizeString(body.text != null ? body.text : body.content || '(arquivo)');
    const row = await db.addMessage(id, content, req.userId, chatId);
    const room = 'dm:' + chatId;
    const msg = {
      id: row.id,
      author: row.author,
      avatar: row.avatar || null,
      text: row.text,
      time: row.time,
      attachments: [],
      content: row.text,
      username: row.author,
      avatar_url: row.avatar || null,
      timestamp: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
    };
    const msgPayload = { type: 'message', room, message: msg };
    const io = getIo(req);
    if (io) {
      io.to(room).emit('message', msgPayload);
      console.log('[api] Broadcast DM enviado para room:', room);
    } else {
      console.warn('[api] io não disponível, broadcast DM não enviado');
    }
    res.status(201).json({ ok: true, time: row.time });
  } catch (e) {
    console.error('[api] Erro ao salvar mensagem DM:', e.message, e.code || '', e.detail || '');
    res.status(500).json({ error: 'Erro ao salvar mensagem DM' });
  }
});

// —— Amizades (com emit real-time) ——
router.post('/friend-requests', authRequired, async (req, res) => {
  try {
    const fromUserId = req.userId;
    const fromUsernameResult = await db.pool.query('SELECT username FROM liberty_users WHERE id = $1', [fromUserId]);
    const fromUsername = fromUsernameResult.rows[0]?.username || '';
    const toUsername = sanitizeUsername(req.body?.toUsername || '');
    if (!toUsername) return res.status(400).json({ error: 'toUsername obrigatório' });
    const req_ = await db.addFriendRequest(fromUserId, fromUsername, toUsername);
    if (!req_) return res.status(409).json({ error: 'Convite já enviado ou usuário não encontrado' });
    const io = getIo(req);
    if (io && req_.toUserId) io.to('user:' + req_.toUserId).emit('friend:request', req_);
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
    if (!req_) return res.status(404).json({ error: 'Convite não encontrado ou já aceito' });
    const io = getIo(req);
    if (io) {
      io.to('user:' + req_.fromUserId).emit('friend:accepted', req_);
      if (req_.acceptedByUserId) io.to('user:' + req_.acceptedByUserId).emit('friend:accepted', req_);
    }
    res.json({ ok: true, request: req_ });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao aceitar convite' });
  }
});

router.get('/friends/:userId', authOptional, async (req, res) => {
  try {
    const list = await db.getFriendsForUser(req.params.userId);
    res.json(list);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao buscar amigos' });
  }
});

// —— Amizades (tabela friendships, rotas protegidas JWT). Busca apenas por nome exato. ——
router.post('/friends/request', authRequired, async (req, res) => {
  try {
    const userId = req.userId;
    const { username, id: friendIdParam } = req.body || {};
    let identifier = friendIdParam != null ? String(friendIdParam).trim() : (username != null ? String(username).trim() : '');
    if (!identifier) {
      return res.status(400).json({ error: 'Informe o nome de usuário' });
    }
    if (!/^[0-9a-f-]{36}$/i.test(identifier)) {
      identifier = identifier.split('#')[0].trim();
      if (!identifier) return res.status(400).json({ error: 'Informe o nome de usuário' });
    }
    const result = await db.friendsRequest(userId, identifier);
    if (result === 'self') {
      return res.status(400).json({ error: 'Você não pode adicionar a si mesmo' });
    }
    if (result === 'duplicate') {
      return res.status(409).json({ error: 'Já existe um pedido pendente para este usuário' });
    }
    if (result === 'already_friends') {
      return res.status(409).json({ error: 'Vocês já são amigos' });
    }
    if (!result) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    res.status(201).json({ ok: true, request: result });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao enviar solicitação' });
  }
});

router.get('/friends/pending', authRequired, async (req, res) => {
  try {
    const list = await db.getFriendsPending(req.userId);
    res.json(list);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao listar pedidos pendentes' });
  }
});

router.patch('/friends/accept', authRequired, async (req, res) => {
  try {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id da solicitação é obrigatório' });
    const result = await db.friendsAccept(id, req.userId);
    if (!result) {
      return res.status(404).json({ error: 'Solicitação não encontrada ou já aceita' });
    }
    res.json({ ok: true, request: result });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao aceitar solicitação' });
  }
});

router.get('/friends/list', authRequired, async (req, res) => {
  try {
    const list = await db.getFriendsList(req.userId);
    res.json(list);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao listar amigos' });
  }
});

router.post('/account/delete', authRequired, async (req, res) => {
  try {
    const username = sanitizeUsername(req.body?.username || '');
    if (!username) return res.status(400).json({ error: 'username obrigatório' });
    await db.deleteUserData(req.userId, username);
    res.clearCookie('liberty_token');
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao apagar dados' });
  }
});

export default router;
