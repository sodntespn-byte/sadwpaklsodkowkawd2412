/**
 * LIBERTY - Banco Postgres para Vercel (Neon)
 * Usado SOMENTE quando POSTGRES_URL ou DATABASE_URL está definido (deploy na Vercel).
 */

const { neon } = require('@neondatabase/serverless');

const MAX_MESSAGES = 2000;

function getSql() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) return null;
  return neon(url);
}

async function ensureTables(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS liberty_channel_messages (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      author TEXT NOT NULL,
      avatar TEXT,
      text TEXT NOT NULL,
      time TEXT NOT NULL,
      attachments JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS liberty_dm_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      author TEXT NOT NULL,
      avatar TEXT,
      text TEXT NOT NULL,
      time TEXT NOT NULL,
      attachments JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS liberty_friend_requests (
      id TEXT PRIMARY KEY,
      from_user_id TEXT NOT NULL,
      from_username TEXT NOT NULL,
      to_username TEXT NOT NULL,
      to_username_norm TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      accepted_by_user_id TEXT,
      accepted_by_username TEXT,
      accepted_at TIMESTAMPTZ,
      created_at BIGINT NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_channel_key ON liberty_channel_messages(server_id, channel_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_dm_conv ON liberty_dm_messages(conversation_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_fr_to ON liberty_friend_requests(to_username_norm, status)`;
}

async function getChannelMessages(serverId, channelId, limit = 500) {
  const sql = getSql();
  if (!sql) return [];
  await ensureTables(sql);
  const rows = await sql`
    SELECT id, author, avatar, text, time, attachments
    FROM liberty_channel_messages
    WHERE server_id = ${serverId} AND channel_id = ${channelId}
    ORDER BY created_at DESC
    LIMIT ${Math.min(limit, 1000)}
  `;
  return (rows || []).reverse().map((r) => ({
    id: r.id,
    author: r.author,
    avatar: r.avatar || null,
    text: r.text,
    time: r.time,
    attachments: r.attachments || []
  }));
}

async function addChannelMessage(msg) {
  const sql = getSql();
  if (!sql) throw new Error('No database');
  await ensureTables(sql);
  const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  await sql`
    INSERT INTO liberty_channel_messages (id, server_id, channel_id, author, avatar, text, time, attachments)
    VALUES (${msg.id}, ${msg.serverId}, ${msg.channelId}, ${msg.author}, ${msg.avatar || null}, ${msg.text}, ${time}, ${JSON.stringify(msg.attachments || [])})
  `;
  const count = await sql`
    SELECT COUNT(*)::int as c FROM liberty_channel_messages
    WHERE server_id = ${msg.serverId} AND channel_id = ${msg.channelId}
  `;
  if (count[0]?.c > MAX_MESSAGES) {
    await sql`
      DELETE FROM liberty_channel_messages
      WHERE server_id = ${msg.serverId} AND channel_id = ${msg.channelId}
      AND id IN (
        SELECT id FROM liberty_channel_messages
        WHERE server_id = ${msg.serverId} AND channel_id = ${msg.channelId}
        ORDER BY created_at ASC
        LIMIT ${count[0].c - MAX_MESSAGES}
      )
    `;
  }
  return { id: msg.id, author: msg.author, avatar: msg.avatar || null, text: msg.text, time, attachments: msg.attachments || [] };
}

async function getDMMessages(conversationId, limit = 500) {
  const sql = getSql();
  if (!sql) return [];
  await ensureTables(sql);
  const rows = await sql`
    SELECT id, author, avatar, text, time, attachments
    FROM liberty_dm_messages
    WHERE conversation_id = ${conversationId}
    ORDER BY created_at DESC
    LIMIT ${Math.min(limit, 1000)}
  `;
  return (rows || []).reverse().map((r) => ({
    id: r.id,
    author: r.author,
    avatar: r.avatar || null,
    text: r.text,
    time: r.time,
    attachments: r.attachments || []
  }));
}

async function addDMMessage(msg) {
  const sql = getSql();
  if (!sql) throw new Error('No database');
  await ensureTables(sql);
  const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  await sql`
    INSERT INTO liberty_dm_messages (id, conversation_id, author, avatar, text, time, attachments)
    VALUES (${msg.id}, ${msg.conversationId}, ${msg.author}, ${msg.avatar || null}, ${msg.text}, ${time}, ${JSON.stringify(msg.attachments || [])})
  `;
  const count = await sql`
    SELECT COUNT(*)::int as c FROM liberty_dm_messages WHERE conversation_id = ${msg.conversationId}
  `;
  if (count[0]?.c > MAX_MESSAGES) {
    await sql`
      DELETE FROM liberty_dm_messages WHERE conversation_id = ${msg.conversationId}
      AND id IN (
        SELECT id FROM liberty_dm_messages WHERE conversation_id = ${msg.conversationId}
        ORDER BY created_at ASC LIMIT ${count[0].c - MAX_MESSAGES}
      )
    `;
  }
  return { id: msg.id, author: msg.author, avatar: msg.avatar || null, text: msg.text, time, attachments: msg.attachments || [] };
}

async function getFriendRequestsReceived(username) {
  const sql = getSql();
  if (!sql) return [];
  await ensureTables(sql);
  const norm = (username || '').trim().toLowerCase();
  const rows = await sql`
    SELECT id, from_user_id, from_username, to_username, status, created_at
    FROM liberty_friend_requests
    WHERE to_username_norm = ${norm} AND status = 'pending'
    ORDER BY created_at DESC
  `;
  return (rows || []).map((r) => ({
    id: r.id,
    fromUserId: r.from_user_id,
    fromUsername: r.from_username,
    toUsername: r.to_username,
    status: r.status,
    createdAt: r.created_at
  }));
}

async function addFriendRequest(fromUserId, fromUsername, toUsername) {
  const sql = getSql();
  if (!sql) throw new Error('No database');
  await ensureTables(sql);
  const toNorm = (toUsername || '').trim().toLowerCase();
  const existing = await sql`
    SELECT 1 FROM liberty_friend_requests
    WHERE from_user_id = ${fromUserId} AND to_username_norm = ${toNorm} AND status = 'pending'
    LIMIT 1
  `;
  if (existing && existing.length > 0) return null;
  const id = 'fr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
  await sql`
    INSERT INTO liberty_friend_requests (id, from_user_id, from_username, to_username, to_username_norm, status, created_at)
    VALUES (${id}, ${fromUserId}, ${(fromUsername || '').trim()}, ${(toUsername || '').trim()}, ${toNorm}, 'pending', ${Date.now()})
  `;
  return { id, fromUserId, fromUsername: (fromUsername || '').trim(), toUsername: (toUsername || '').trim(), toUsernameNorm: toNorm, status: 'pending', createdAt: Date.now() };
}

async function acceptFriendRequest(requestId, acceptedByUserId, acceptedByUsername) {
  const sql = getSql();
  if (!sql) return null;
  await ensureTables(sql);
  const rows = await sql`
    UPDATE liberty_friend_requests
    SET status = 'accepted', accepted_by_user_id = ${acceptedByUserId}, accepted_by_username = ${(acceptedByUsername || '').trim()}, accepted_at = NOW()
    WHERE id = ${requestId} AND status = 'pending'
    RETURNING id, from_user_id, from_username, to_username, status, accepted_by_user_id, accepted_by_username
  `;
  if (!rows || rows.length === 0) return null;
  const r = rows[0];
  return { id: r.id, fromUserId: r.from_user_id, fromUsername: r.from_username, toUsername: r.to_username, status: 'accepted', acceptedByUserId: r.accepted_by_user_id, acceptedByUsername: r.accepted_by_username };
}

async function getFriendsForUser(userId) {
  const sql = getSql();
  if (!sql) return [];
  await ensureTables(sql);
  const rows = await sql`
    SELECT from_user_id, from_username, accepted_by_user_id, accepted_by_username
    FROM liberty_friend_requests
    WHERE status = 'accepted' AND (from_user_id = ${userId} OR accepted_by_user_id = ${userId})
  `;
  const seen = new Set();
  const friends = [];
  for (const r of rows || []) {
    const otherId = r.from_user_id === userId ? r.accepted_by_user_id : r.from_user_id;
    const otherName = r.from_user_id === userId ? r.accepted_by_username : r.from_username;
    if (otherId && otherName && !seen.has(otherId)) {
      seen.add(otherId);
      friends.push({ id: otherId, username: otherName, status: 'online' });
    }
  }
  return friends;
}

function isVercel() {
  return !!(process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.VERCEL || process.env.NETLIFY);
}

async function deleteUserData(userId, username) {
  const sql = getSql();
  if (!sql) return;
  await ensureTables(sql);
  const nameNorm = (username || '').trim().toLowerCase();
  await sql`DELETE FROM liberty_channel_messages WHERE LOWER(TRIM(author)) = ${nameNorm}`;
  await sql`DELETE FROM liberty_dm_messages WHERE LOWER(TRIM(author)) = ${nameNorm}`;
  await sql`
    DELETE FROM liberty_friend_requests
    WHERE from_user_id = ${userId}
       OR to_username_norm = ${nameNorm}
       OR accepted_by_user_id = ${userId}
  `;
}

module.exports = {
  getChannelMessages,
  addChannelMessage,
  getDMMessages,
  addDMMessage,
  getFriendRequestsReceived,
  addFriendRequest,
  acceptFriendRequest,
  getFriendsForUser,
  deleteUserData,
  isVercel,
  ensureTables
};
