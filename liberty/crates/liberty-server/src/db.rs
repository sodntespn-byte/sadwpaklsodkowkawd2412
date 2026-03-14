//! Database operations

use sqlx::SqlitePool;
use sqlx::sqlite::SqlitePoolOptions;
use anyhow::Result;

/// Initialize the database connection and create tables
pub async fn init_database() -> Result<SqlitePool> {
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:liberty.db?mode=rwc".to_string());
    
    let pool = SqlitePoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await?;
    
    // Create tables
    create_tables(&pool).await?;
    
    Ok(pool)
}

async fn create_tables(pool: &SqlitePool) -> Result<()> {
    // Users table
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            discriminator TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            avatar TEXT,
            banner TEXT,
            bio TEXT,
            status TEXT DEFAULT 'offline',
            custom_status TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            verified INTEGER DEFAULT 0,
            mfa_enabled INTEGER DEFAULT 0
        )
    "#).execute(pool).await?;
    
    // Servers table
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS servers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            icon TEXT,
            banner TEXT,
            owner_id TEXT NOT NULL,
            region TEXT DEFAULT 'us-east',
            afk_timeout INTEGER DEFAULT 300,
            afk_channel_id TEXT,
            system_channel_id TEXT,
            verification_level INTEGER DEFAULT 0,
            content_filter INTEGER DEFAULT 0,
            notification_level INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            max_members INTEGER,
            FOREIGN KEY (owner_id) REFERENCES users(id)
        )
    "#).execute(pool).await?;
    
    // Server members table
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS server_members (
            server_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            nickname TEXT,
            avatar TEXT,
            joined_at TEXT NOT NULL,
            premium_since TEXT,
            deaf INTEGER DEFAULT 0,
            mute INTEGER DEFAULT 0,
            pending INTEGER DEFAULT 0,
            PRIMARY KEY (server_id, user_id),
            FOREIGN KEY (server_id) REFERENCES servers(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    "#).execute(pool).await?;
    
    // Roles table
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS roles (
            id TEXT PRIMARY KEY,
            server_id TEXT NOT NULL,
            name TEXT NOT NULL,
            color INTEGER DEFAULT 0,
            hoist INTEGER DEFAULT 0,
            position INTEGER DEFAULT 0,
            permissions INTEGER DEFAULT 0,
            managed INTEGER DEFAULT 0,
            mentionable INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            FOREIGN KEY (server_id) REFERENCES servers(id)
        )
    "#).execute(pool).await?;
    
    // Member roles junction table
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS member_roles (
            server_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            role_id TEXT NOT NULL,
            PRIMARY KEY (server_id, user_id, role_id),
            FOREIGN KEY (server_id, user_id) REFERENCES server_members(server_id, user_id),
            FOREIGN KEY (role_id) REFERENCES roles(id)
        )
    "#).execute(pool).await?;
    
    // Channels table
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS channels (
            id TEXT PRIMARY KEY,
            server_id TEXT,
            parent_id TEXT,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            position INTEGER DEFAULT 0,
            topic TEXT,
            nsfw INTEGER DEFAULT 0,
            bitrate INTEGER,
            user_limit INTEGER,
            rate_limit INTEGER,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (server_id) REFERENCES servers(id),
            FOREIGN KEY (parent_id) REFERENCES channels(id)
        )
    "#).execute(pool).await?;
    
    // Messages table
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            channel_id TEXT NOT NULL,
            author_id TEXT NOT NULL,
            content TEXT NOT NULL,
            edited_at TEXT,
            tts INTEGER DEFAULT 0,
            mention_everyone INTEGER DEFAULT 0,
            pinned INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            FOREIGN KEY (channel_id) REFERENCES channels(id),
            FOREIGN KEY (author_id) REFERENCES users(id)
        )
    "#).execute(pool).await?;
    
    // Message mentions table
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS message_mentions (
            message_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            PRIMARY KEY (message_id, user_id),
            FOREIGN KEY (message_id) REFERENCES messages(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    "#).execute(pool).await?;
    
    // Attachments table
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS attachments (
            id TEXT PRIMARY KEY,
            message_id TEXT NOT NULL,
            filename TEXT NOT NULL,
            description TEXT,
            content_type TEXT NOT NULL,
            size INTEGER NOT NULL,
            url TEXT NOT NULL,
            proxy_url TEXT NOT NULL,
            height INTEGER,
            width INTEGER,
            ephemeral INTEGER DEFAULT 0,
            FOREIGN KEY (message_id) REFERENCES messages(id)
        )
    "#).execute(pool).await?;
    
    // Reactions table
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS reactions (
            message_id TEXT NOT NULL,
            emoji_id TEXT,
            emoji_name TEXT NOT NULL,
            emoji_animated INTEGER DEFAULT 0,
            user_id TEXT NOT NULL,
            PRIMARY KEY (message_id, emoji_name, user_id),
            FOREIGN KEY (message_id) REFERENCES messages(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    "#).execute(pool).await?;
    
    // Invites table
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS invites (
            code TEXT PRIMARY KEY,
            server_id TEXT NOT NULL,
            channel_id TEXT NOT NULL,
            inviter_id TEXT,
            target_user_id TEXT,
            target_type INTEGER,
            uses INTEGER DEFAULT 0,
            max_uses INTEGER,
            max_age INTEGER,
            temporary INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            expires_at TEXT,
            FOREIGN KEY (server_id) REFERENCES servers(id),
            FOREIGN KEY (channel_id) REFERENCES channels(id),
            FOREIGN KEY (inviter_id) REFERENCES users(id)
        )
    "#).execute(pool).await?;
    
    // Bans table
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS bans (
            server_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            reason TEXT,
            created_at TEXT NOT NULL,
            PRIMARY KEY (server_id, user_id),
            FOREIGN KEY (server_id) REFERENCES servers(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    "#).execute(pool).await?;
    
    // Create indexes
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id)")
        .execute(pool).await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_messages_author ON messages(author_id)")
        .execute(pool).await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_server_members_server ON server_members(server_id)")
        .execute(pool).await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_channels_server ON channels(server_id)")
        .execute(pool).await?;
    
    // Create default @everyone role for new servers
    // (This is handled in the create_server function)
    
    tracing::info!("✅ Database tables created");
    
    Ok(())
}
