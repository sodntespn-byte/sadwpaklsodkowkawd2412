/**
 * LIBERTY - Pool de conexões PostgreSQL (Neon)
 * Garante persistência de mensagens e amizades após F5.
 */

const { Pool } = require('pg');

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.warn('POSTGRES_URL ou DATABASE_URL não definido. Defina em .env para usar o banco.');
}

const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: { rejectUnauthorized: true },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    })
  : null;

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
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_users_username_norm ON liberty_users(username_norm);
    `);
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
    // Servidor global Liberty
    await client.query(`
      INSERT INTO liberty_servers (id, name) VALUES ('liberty-main-server', 'Liberty')
      ON CONFLICT (id) DO NOTHING;
    `);
  } finally {
    client.release();
  }
}

async function getUserByUsername(username) {
  if (!pool) return null;
  const norm = (username || '').trim().toLowerCase();
  const r = await pool.query(
    'SELECT id, username, password_hash, created_at FROM liberty_users WHERE username_norm = $1 LIMIT 1',
    [norm]
  );
  return r.rows[0] || null;
}

async function createUser(username, passwordHash = null) {
  if (!pool) throw new Error('No database');
  const name = (username || '').trim();
  const norm = name.toLowerCase();
  const r = await pool.query(
    `INSERT INTO liberty_users (username, username_norm, password_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (username_norm) DO UPDATE SET username = EXCLUDED.username
     RETURNING id, username, password_hash, created_at`,
    [name, norm, passwordHash]
  );
  const user = r.rows[0];
  if (user) {
    await addMemberToServer('liberty-main-server', user.id);
  }
  return user;
}

async function addMemberToServer(serverId, userId) {
  if (!pool) return;
  await pool.query(
    'INSERT INTO liberty_server_members (server_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [serverId, userId]
  );
}

async function getMessages(chatId, limit = 500) {
  if (!pool) return [];
  const r = await pool.query(
    `SELECT id, content, author_id, chat_id, created_at,
      (SELECT username FROM liberty_users u WHERE u.id = m.author_id) AS author
     FROM liberty_messages m
     WHERE chat_id = $1
     ORDER BY created_at ASC
     LIMIT $2`,
    [chatId, Math.min(limit, 1000)]
  );
  return (r.rows || []).map((row) => ({
    id: row.id,
    content: row.content,
    author_id: row.author_id,
    author: row.author,
    chat_id: row.chat_id,
    created_at: row.created_at,
    time: row.created_at ? new Date(row.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
    text: row.content
  }));
}

async function addMessage(id, content, authorId, chatId) {
  if (!pool) throw new Error('No database');
  const safeContent = (content || '').toString().trim().slice(0, 50000);
  await pool.query(
    'INSERT INTO liberty_messages (id, content, author_id, chat_id) VALUES ($1, $2, $3, $4)',
    [id, safeContent || '(arquivo)', authorId, chatId]
  );
  const countResult = await pool.query(
    'SELECT COUNT(*)::int AS c FROM liberty_messages WHERE chat_id = $1',
    [chatId]
  );
  const count = countResult.rows[0]?.c || 0;
  if (count > MAX_MESSAGES_PER_CHAT) {
    await pool.query(
      `DELETE FROM liberty_messages WHERE id IN (
        SELECT id FROM liberty_messages WHERE chat_id = $1 ORDER BY created_at ASC LIMIT $2
      )`,
      [chatId, count - MAX_MESSAGES_PER_CHAT]
    );
  }
  const authorResult = await pool.query('SELECT username FROM liberty_users WHERE id = $1', [authorId]);
  const author = authorResult.rows[0]?.username || '';
  return {
    id,
    content: safeContent || '(arquivo)',
    author_id: authorId,
    author,
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
     FROM liberty_friend_requests
     WHERE to_username_norm = $1 AND status = 'pending'
     ORDER BY created_at DESC`,
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
     RETURNING id, from_user_id, from_username, to_username, status`,
    [requestId, acceptedByUserId, (acceptedByUsername || '').trim()]
  );
  if (!r.rows.length) return null;
  const row = r.rows[0];
  return {
    id: row.id,
    fromUserId: row.from_user_id,
    fromUsername: row.from_username,
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
       SELECT accepted_by_user_id FROM liberty_friend_requests WHERE status = 'accepted' AND from_user_id = $1
     )
     AND u.id != $1`,
    [userId, userId]
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
}

module.exports = {
  pool,
  ensureTables,
  getUserByUsername,
  createUser,
  addMemberToServer,
  getMessages,
  addMessage,
  getFriendRequestsReceivedByUsername,
  addFriendRequest,
  acceptFriendRequest,
  getFriendsForUser,
  deleteUserData
};
