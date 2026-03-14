/**
 * Inicialização do banco: cria tabelas liberty_* (via lib/db) e as tabelas usadas pelo server.js (users, servers, chats, messages, chat_members, group_members, friendships).
 */

import libDb from '../lib/db.js';

export async function init() {
  if (!libDb.pool) return;
  await libDb.ensureTables();

  const client = await libDb.pool.connect();
  try {
    // Tabelas usadas pelo server.js (schema alternativo ao liberty_*)
    await client.query(`
      CREATE TABLE IF NOT EXISTS servers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        owner_id UUID
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT UNIQUE NOT NULL,
        email TEXT,
        password_hash TEXT,
        avatar_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS chats (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT,
        type TEXT NOT NULL,
        server_id UUID REFERENCES servers(id) ON DELETE CASCADE
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_members (
        chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT DEFAULT 'member',
        PRIMARY KEY (chat_id, user_id)
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        content TEXT NOT NULL,
        chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        channel_id UUID,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS group_members (
        chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (chat_id, user_id)
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS friendships (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'accepted',
        PRIMARY KEY (user_id, friend_id)
      );
    `);

    try {
      await client.query(`ALTER TABLE users ADD COLUMN avatar_url TEXT`);
    } catch (e) {
      if (e.code !== '42701') console.warn('[init] users.avatar_url:', e.message);
    }
    try {
      await client.query(`ALTER TABLE messages ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE SET NULL`);
    } catch (e) {
      if (e.code !== '42701') console.warn('[init] messages.user_id:', e.message);
    }
    try {
      await client.query(`ALTER TABLE users ADD COLUMN device_id TEXT`);
    } catch (e) {
      if (e.code !== '42701') console.warn('[init] users.device_id:', e.message);
    }
  } finally {
    client.release();
  }
}
