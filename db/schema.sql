-- LIBERTY - Schema canônico PostgreSQL (Neon)
-- Fonte única de verdade. server.js (lib/db.js) usa este schema via ensureTables().
-- Sincronize crates/liberty-core/src/models.rs com estas tabelas.

-- Users (login por username; senha opcional)
CREATE TABLE IF NOT EXISTS liberty_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  username_norm TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_username_norm ON liberty_users(username_norm);

-- Servers (servidor global Liberty)
CREATE TABLE IF NOT EXISTS liberty_servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Server members (auto-join Liberty para novos usuários)
CREATE TABLE IF NOT EXISTS liberty_server_members (
  server_id TEXT NOT NULL REFERENCES liberty_servers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES liberty_users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (server_id, user_id)
);

-- Messages (canal: chat_id = 'channel:serverId:channelId'; DM: chat_id = conversationId)
CREATE TABLE IF NOT EXISTS liberty_messages (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES liberty_users(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_chat_created ON liberty_messages(chat_id, created_at);

-- Friendships (pending | accepted)
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

-- Amizades (user_id = quem enviou, friend_id = quem recebe, status = pending | accepted | rejected)
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

INSERT INTO liberty_servers (id, name) VALUES ('liberty-main-server', 'Liberty')
ON CONFLICT (id) DO NOTHING;
