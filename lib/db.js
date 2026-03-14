/**
 * LIBERTY - Pool de conexões PostgreSQL (Neon) com pg — ESM
 * Schema canônico: db/schema.sql. Modelos Rust alinhados: liberty-core/src/db_schema.rs
 * Tabelas: users, messages, friendships, server_members. Auto-join servidor Liberty.
 */

import { Pool } from 'pg';

// Tentar POSTGRES_URL primeiro; se não existir, usar DATABASE_URL
const connectionString = process.env.POSTGRES_URL != null && String(process.env.POSTGRES_URL).trim() !== ''
  ? String(process.env.POSTGRES_URL).trim()
  : (process.env.DATABASE_URL != null && String(process.env.DATABASE_URL).trim() !== ''
    ? String(process.env.DATABASE_URL).trim()
    : null);

if (!connectionString) {
  console.warn(
    '[db] POSTGRES_URL ou DATABASE_URL não definido.',
    'POSTGRES_URL:', typeof process.env.POSTGRES_URL,
    '| DATABASE_URL:', typeof process.env.DATABASE_URL,
    '— Defina uma delas em .env ou nas variáveis de ambiente.'
  );
}

function normalizeConnectionString(url) {
  if (!url || typeof url !== 'string') return url;
  try {
    const u = new URL(url);
    u.searchParams.set('sslmode', 'verify-full');
    return u.toString();
  } catch {
    return url.replace(/\bsslmode=require\b/i, 'sslmode=verify-full');
  }
}

const config = connectionString
  ? {
      connectionString: normalizeConnectionString(connectionString),
      ssl: connectionString.includes('sslmode=') || connectionString.includes('neon.tech')
        ? (process.env.PGSSL_REJECT_UNAUTHORIZED === 'true' ? { rejectUnauthorized: true } : { rejectUnauthorized: false })
        : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    }
  : null;

const pool = config ? new Pool(config) : null;

if (pool) {
  pool.on('error', (err) => {
    console.error('[pg pool error]', err.message, err.stack);
  });
}

const MAX_MESSAGES_PER_CHAT = 2000;

async function ensureTables() {
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS liberty_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT UNIQUE NOT NULL,
        username_norm TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        avatar_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_users_username_norm ON liberty_users(username_norm);
    `);
    try {
      await client.query(`ALTER TABLE liberty_users ADD COLUMN avatar_url TEXT`);
    } catch (e) {
      if (e.code !== '42701') {}
    }
    try {
      await client.query(`ALTER TABLE liberty_users ADD COLUMN banner_url TEXT`);
    } catch (e) {
      if (e.code !== '42701') {}
    }
    await client.query(`
      CREATE TABLE IF NOT EXISTS liberty_servers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS liberty_server_members (
        server_id TEXT NOT NULL REFERENCES liberty_servers(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES liberty_users(id) ON DELETE CASCADE,
        joined_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (server_id, user_id)
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS liberty_messages (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        author_id UUID NOT NULL REFERENCES liberty_users(id) ON DELETE CASCADE,
        chat_id TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_messages_chat_created ON liberty_messages(chat_id, created_at);
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS liberty_friend_requests (
        id TEXT PRIMARY KEY,
        from_user_id UUID NOT NULL REFERENCES liberty_users(id) ON DELETE CASCADE,
        from_username TEXT NOT NULL,
        to_user_id UUID REFERENCES liberty_users(id) ON DELETE CASCADE,
        to_username TEXT,
        to_username_norm TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        accepted_by_user_id UUID,
        accepted_by_username TEXT,
        accepted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_fr_to_norm ON liberty_friend_requests(to_username_norm, status);
      CREATE INDEX IF NOT EXISTS idx_fr_from ON liberty_friend_requests(from_user_id);
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS friendships (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES liberty_users(id) ON DELETE CASCADE,
        friend_id UUID NOT NULL REFERENCES liberty_users(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, friend_id)
      );
      CREATE INDEX IF NOT EXISTS idx_friendships_user ON friendships(user_id);
      CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships(friend_id);
      CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);
    `);
    await client.query(`
      INSERT INTO liberty_servers (id, name) VALUES ('liberty-main-server', 'Liberty')
      ON CONFLICT (id) DO NOTHING;
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS liberty_invites (
        code TEXT PRIMARY KEY,
        server_id TEXT NOT NULL REFERENCES liberty_servers(id) ON DELETE CASCADE,
        created_by_user_id UUID REFERENCES liberty_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_invites_server ON liberty_invites(server_id);
    `);
  } finally {
    client.release();
  }
}

async function getUserByUsername(username) {
  if (!pool) return null;
  const norm = (username || '').trim().toLowerCase();
  const r = await pool.query(
    'SELECT id, username, password_hash, avatar_url, banner_url, created_at FROM liberty_users WHERE username_norm = $1 LIMIT 1',
    [norm]
  );
  return r.rows[0] || null;
}

async function getUserById(userId) {
  if (!pool || !userId) return null;
  const r = await pool.query(
    'SELECT id, username, avatar_url, banner_url, created_at FROM liberty_users WHERE id = $1 LIMIT 1',
    [userId]
  );
  return r.rows[0] || null;
}

async function updateUserAvatar(userId, avatarUrl) {
  if (!pool) throw new Error('No database');
  await pool.query('UPDATE liberty_users SET avatar_url = $1 WHERE id = $2', [avatarUrl || null, userId]);
  return getUserById(userId);
}

async function updateUserBanner(userId, bannerUrl) {
  if (!pool) throw new Error('No database');
  await pool.query('UPDATE liberty_users SET banner_url = $1 WHERE id = $2', [bannerUrl || null, userId]);
  return getUserById(userId);
}

async function updateUserProfile(userId, { avatar_url: avatarUrl, banner_url: bannerUrl }) {
  if (!pool) throw new Error('No database');
  if (avatarUrl !== undefined) {
    await pool.query('UPDATE liberty_users SET avatar_url = $1 WHERE id = $2', [avatarUrl ?? null, userId]);
  }
  if (bannerUrl !== undefined) {
    await pool.query('UPDATE liberty_users SET banner_url = $1 WHERE id = $2', [bannerUrl ?? null, userId]);
  }
  return getUserById(userId);
}

async function createUser(username, passwordHash = null) {
  if (!pool) throw new Error('No database');
  const name = (username || '').trim();
  const norm = name.toLowerCase();
  const r = await pool.query(
    `INSERT INTO liberty_users (username, username_norm, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, username, password_hash, created_at`,
    [name, norm, passwordHash]
  );
  const user = r.rows[0];
  if (user) await addMemberToServer('liberty-main-server', user.id);
  return user;
}

async function addMemberToServer(serverId, userId) {
  if (!pool) return;
  await pool.query(
    'INSERT INTO liberty_server_members (server_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [serverId, userId]
  );
}

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function createInvite(serverId, userId) {
  if (!pool) return null;
  const serverRow = await pool.query('SELECT id, name FROM liberty_servers WHERE id = $1', [serverId]);
  if (!serverRow.rows[0]) return null;
  let code = generateInviteCode();
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      await pool.query(
        'INSERT INTO liberty_invites (code, server_id, created_by_user_id) VALUES ($1, $2, $3)',
        [code, serverId, userId]
      );
      return { code, server_id: serverId, server_name: serverRow.rows[0].name };
    } catch (e) {
      if (e.code === '23505') {
        code = generateInviteCode();
        continue;
      }
      throw e;
    }
  }
  return null;
}

async function getInviteByCode(code) {
  if (!pool || !code) return null;
  const r = await pool.query(
    `SELECT i.code, i.server_id, s.name AS server_name
     FROM liberty_invites i
     JOIN liberty_servers s ON s.id = i.server_id
     WHERE i.code = $1`,
    [String(code).trim().toUpperCase()]
  );
  return r.rows[0] || null;
}

async function getServerMemberCount(serverId) {
  if (!pool) return 0;
  const r = await pool.query('SELECT COUNT(*)::int AS c FROM liberty_server_members WHERE server_id = $1', [serverId]);
  return r.rows[0]?.c ?? 0;
}

async function isMemberOfServer(serverId, userId) {
  if (!pool || !userId) return false;
  const r = await pool.query(
    'SELECT 1 FROM liberty_server_members WHERE server_id = $1 AND user_id = $2',
    [serverId, userId]
  );
  return !!r.rows[0];
}

async function getMessages(chatId, limit = 500) {
  if (!pool) return [];
  const r = await pool.query(
    `SELECT m.id, m.content, m.author_id, m.chat_id, m.created_at,
      u.username AS author,
      u.avatar_url AS avatar
     FROM liberty_messages m
     LEFT JOIN liberty_users u ON u.id = m.author_id
     WHERE m.chat_id = $1 ORDER BY m.created_at ASC LIMIT $2`,
    [chatId, Math.min(limit, 1000)]
  );
  return (r.rows || []).map((row) => ({
    id: row.id,
    content: row.content,
    author_id: row.author_id,
    author: row.author || 'User',
    avatar: row.avatar || null,
    chat_id: row.chat_id,
    created_at: row.created_at,
    time: row.created_at ? new Date(row.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
    text: row.content
  }));
}

async function addMessage(id, content, authorId, chatId) {
  if (!pool) throw new Error('No database');
  const safeContent = (content || '').toString().trim().slice(0, 50000);
  try {
    await pool.query(
      'INSERT INTO liberty_messages (id, content, author_id, chat_id) VALUES ($1, $2, $3, $4)',
      [id, safeContent || '(arquivo)', authorId, chatId]
    );
  } catch (err) {
    console.error('[db] addMessage falhou:', err.message, 'code:', err.code, 'detail:', err.detail, 'constraint:', err.constraint);
    throw err;
  }
  const countResult = await pool.query('SELECT COUNT(*)::int AS c FROM liberty_messages WHERE chat_id = $1', [chatId]);
  const count = countResult.rows[0]?.c || 0;
  if (count > MAX_MESSAGES_PER_CHAT) {
    await pool.query(
      `DELETE FROM liberty_messages WHERE id IN (
        SELECT id FROM liberty_messages WHERE chat_id = $1 ORDER BY created_at ASC LIMIT $2
      )`,
      [chatId, count - MAX_MESSAGES_PER_CHAT]
    );
  }
  const authorResult = await pool.query('SELECT username, avatar_url FROM liberty_users WHERE id = $1', [authorId]);
  const author = authorResult.rows[0]?.username || '';
  const avatar = authorResult.rows[0]?.avatar_url || null;
  return {
    id,
    content: safeContent || '(arquivo)',
    author_id: authorId,
    author,
    avatar,
    chat_id: chatId,
    created_at: new Date(),
    time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    text: safeContent || '(arquivo)'
  };
}

async function getFriendRequestsReceivedByUsername(username) {
  if (!pool) return [];
  const norm = (username || '').trim().toLowerCase();
  const r = await pool.query(
    `SELECT id, from_user_id, from_username, to_username, status, created_at
     FROM liberty_friend_requests WHERE to_username_norm = $1 AND status = 'pending' ORDER BY created_at DESC`,
    [norm]
  );
  return (r.rows || []).map((row) => ({
    id: row.id,
    fromUserId: row.from_user_id,
    fromUsername: row.from_username,
    toUsername: row.to_username,
    status: row.status,
    createdAt: row.created_at
  }));
}

async function addFriendRequest(fromUserId, fromUsername, toUsername) {
  if (!pool) throw new Error('No database');
  const toUser = await getUserByUsername(toUsername);
  if (!toUser) return null;
  const toUserId = toUser.id;
  const toNorm = (toUsername || '').trim().toLowerCase();
  const existing = await pool.query(
    `SELECT 1 FROM liberty_friend_requests
     WHERE from_user_id = $1 AND (to_user_id = $2 OR to_username_norm = $3) AND status = 'pending' LIMIT 1`,
    [fromUserId, toUserId, toNorm]
  );
  if (existing.rows.length > 0) return null;
  const id = 'fr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
  await pool.query(
    `INSERT INTO liberty_friend_requests (id, from_user_id, from_username, to_user_id, to_username, to_username_norm, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
    [id, fromUserId, (fromUsername || '').trim(), toUserId, (toUsername || '').trim(), toNorm]
  );
  return {
    id,
    fromUserId,
    fromUsername: (fromUsername || '').trim(),
    toUserId,
    toUsername: (toUsername || '').trim(),
    toUsernameNorm: toNorm,
    status: 'pending',
    createdAt: Date.now()
  };
}

async function acceptFriendRequest(requestId, acceptedByUserId, acceptedByUsername) {
  if (!pool) return null;
  const r = await pool.query(
    `UPDATE liberty_friend_requests
     SET status = 'accepted', accepted_by_user_id = $2, accepted_by_username = $3, accepted_at = NOW()
     WHERE id = $1 AND status = 'pending'
     RETURNING id, from_user_id, from_username, to_user_id, to_username, status`,
    [requestId, acceptedByUserId, (acceptedByUsername || '').trim()]
  );
  if (!r.rows.length) return null;
  const row = r.rows[0];
  return {
    id: row.id,
    fromUserId: row.from_user_id,
    fromUsername: row.from_username,
    toUserId: row.to_user_id,
    toUsername: row.to_username,
    status: 'accepted',
    acceptedByUserId,
    acceptedByUsername: (acceptedByUsername || '').trim()
  };
}

async function getFriendsForUser(userId) {
  if (!pool) return [];
  const r = await pool.query(
    `SELECT u.id, u.username FROM liberty_users u
     WHERE u.id IN (
       SELECT from_user_id FROM liberty_friend_requests WHERE status = 'accepted' AND accepted_by_user_id = $1
       UNION
       SELECT accepted_by_user_id FROM liberty_friend_requests WHERE status = 'accepted' AND from_user_id = $2
     ) AND u.id != $3`,
    [userId, userId, userId]
  );
  return (r.rows || []).map((row) => ({ id: row.id, username: row.username, status: 'online' }));
}

async function deleteUserData(userId, username) {
  if (!pool) return;
  const norm = (username || '').trim().toLowerCase();
  await pool.query('DELETE FROM liberty_messages WHERE author_id = $1', [userId]);
  await pool.query('DELETE FROM liberty_server_members WHERE user_id = $1', [userId]);
  await pool.query(
    `DELETE FROM liberty_friend_requests WHERE from_user_id = $1 OR accepted_by_user_id = $1 OR to_username_norm = $2`,
    [userId, norm]
  );
  await pool.query('DELETE FROM friendships WHERE user_id = $1 OR friend_id = $1', [userId]);
}

// —— Tabela friendships (user_id = quem enviou, friend_id = quem recebe) ——
async function friendsRequest(userId, friendIdentifier) {
  if (!pool) throw new Error('No database');
  const friendId = await resolveFriendId(friendIdentifier);
  if (!friendId) return null;
  if (friendId === userId) return 'self';
  const existing = await pool.query(
    `SELECT 1 FROM friendships WHERE user_id = $1 AND friend_id = $2 AND status = 'pending' LIMIT 1`,
    [userId, friendId]
  );
  if (existing.rows.length > 0) return 'duplicate';
  const existingAccepted = await pool.query(
    `SELECT 1 FROM friendships WHERE ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)) AND status = 'accepted' LIMIT 1`,
    [userId, friendId]
  );
  if (existingAccepted.rows.length > 0) return 'already_friends';
  const existingRow = await pool.query(
    'SELECT id, status FROM friendships WHERE user_id = $1 AND friend_id = $2 LIMIT 1',
    [userId, friendId]
  );
  if (existingRow.rows.length > 0) {
    if (existingRow.rows[0].status === 'rejected') {
      await pool.query('UPDATE friendships SET status = $1, created_at = NOW() WHERE user_id = $2 AND friend_id = $3', ['pending', userId, friendId]);
    } else {
      return 'duplicate';
    }
  } else {
    await pool.query(
      'INSERT INTO friendships (user_id, friend_id, status) VALUES ($1, $2, $3)',
      [userId, friendId, 'pending']
    );
  }
  const r = await pool.query(
    'SELECT f.id, f.user_id, f.friend_id, f.status, f.created_at, u.username AS friend_username FROM friendships f JOIN liberty_users u ON u.id = f.friend_id WHERE f.user_id = $1 AND f.friend_id = $2 AND f.status = $3 ORDER BY f.created_at DESC LIMIT 1',
    [userId, friendId, 'pending']
  );
  const row = r.rows[0];
  return row ? { id: row.id, user_id: row.user_id, friend_id: row.friend_id, status: row.status, created_at: row.created_at, friend_username: row.friend_username } : null;
}

async function resolveFriendId(identifier) {
  if (!pool || identifier == null) return null;
  const s = String(identifier).trim();
  if (!s) return null;
  if (/^[0-9a-f-]{36}$/i.test(s)) {
    const r = await pool.query('SELECT id FROM liberty_users WHERE id = $1 LIMIT 1', [s]);
    return r.rows[0]?.id || null;
  }
  const user = await getUserByUsername(s);
  return user?.id || null;
}

async function getFriendsPending(userId) {
  if (!pool) return [];
  const r = await pool.query(
    `SELECT f.id, f.user_id, f.friend_id, f.status, f.created_at, u.username AS from_username
     FROM friendships f JOIN liberty_users u ON u.id = f.user_id
     WHERE f.friend_id = $1 AND f.status = 'pending' ORDER BY f.created_at DESC`,
    [userId]
  );
  return (r.rows || []).map((row) => ({
    id: row.id,
    user_id: row.user_id,
    friend_id: row.friend_id,
    status: row.status,
    created_at: row.created_at,
    from_username: row.from_username
  }));
}

async function friendsAccept(id, userId) {
  if (!pool) return null;
  const r = await pool.query(
    `UPDATE friendships SET status = 'accepted' WHERE id = $1 AND friend_id = $2 AND status = 'pending' RETURNING id, user_id, friend_id, status`,
    [id, userId]
  );
  if (!r.rows.length) return null;
  const row = r.rows[0];
  return { id: row.id, user_id: row.user_id, friend_id: row.friend_id, status: row.status };
}

async function getFriendsList(userId) {
  if (!pool) return [];
  const r = await pool.query(
    `SELECT u.id, u.username, u.avatar_url, u.banner_url
     FROM liberty_users u
     WHERE u.id IN (
       SELECT friend_id FROM friendships WHERE user_id = $1 AND status = 'accepted'
       UNION
       SELECT user_id FROM friendships WHERE friend_id = $1 AND status = 'accepted'
     ) AND u.id != $1`,
    [userId, userId]
  );
  return (r.rows || []).map((row) => ({ id: row.id, username: row.username, avatar: row.avatar_url || null, banner: row.banner_url || null, status: 'online' }));
}

export default {
  pool,
  ensureTables,
  getUserByUsername,
  getUserById,
  updateUserAvatar,
  updateUserBanner,
  updateUserProfile,
  createUser,
  addMemberToServer,
  createInvite,
  getInviteByCode,
  getServerMemberCount,
  isMemberOfServer,
  getMessages,
  addMessage,
  getFriendRequestsReceivedByUsername,
  addFriendRequest,
  acceptFriendRequest,
  getFriendsForUser,
  deleteUserData,
  friendsRequest,
  getFriendsPending,
  friendsAccept,
  getFriendsList
};
