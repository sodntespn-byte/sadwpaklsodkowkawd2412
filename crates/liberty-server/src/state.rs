//! Application state management

use std::collections::HashMap;
use std::sync::Arc;
use dashmap::DashMap;
use sqlx::SqlitePool;
use tokio::sync::{RwLock, mpsc};
use uuid::Uuid;

use liberty_core::UserStatus;
use liberty_crypto::JwtConfig;

/// Connected client state
pub struct ConnectedClient {
    pub user_id: Uuid,
    pub session_id: Uuid,
    pub status: UserStatus,
    pub connected_at: chrono::DateTime<chrono::Utc>,
    pub last_heartbeat: chrono::DateTime<chrono::Utc>,
    pub sequence: u64,
    /// Channel to push outbound JSON messages to this client's WebSocket
    pub tx: mpsc::Sender<String>,
}

/// Active voice connection
#[derive(Debug)]
pub struct VoiceConnection {
    pub user_id: Uuid,
    pub channel_id: Uuid,
    pub server_id: Option<Uuid>,
    pub session_id: Uuid,
    pub muted: bool,
    pub deafened: bool,
}

/// Application state shared across all handlers
pub struct AppState {
    /// Database pool
    pub db: SqlitePool,
    
    /// JWT configuration
    pub jwt: JwtConfig,
    
    /// Connected WebSocket clients (user_id -> client info)
    pub clients: DashMap<Uuid, ConnectedClient>,
    
    /// User to session mapping
    pub sessions: DashMap<Uuid, Uuid>,
    
    /// Active voice connections
    pub voice_connections: DashMap<Uuid, VoiceConnection>,
    
    /// Server member caches (server_id -> user_ids)
    pub server_members: RwLock<HashMap<Uuid, Vec<Uuid>>>,
    
    /// Typing indicators (channel_id -> (user_id, timestamp))
    pub typing: DashMap<Uuid, Vec<(Uuid, chrono::DateTime<chrono::Utc>)>>,
    
    /// Rate limiting: (request_count, window_start_timestamp_secs) per user
    pub rate_limits: DashMap<Uuid, (u32, i64)>,
    
    /// Server version
    pub version: String,
}

impl AppState {
    pub fn new(db: SqlitePool) -> Self {
        // Read JWT secret from environment variable; fallback only for local dev
        let secret_str = std::env::var("JWT_SECRET")
            .unwrap_or_else(|_| {
                tracing::warn!(
                    "JWT_SECRET env var not set — using insecure default. \
                     Set JWT_SECRET in production!"
                );
                "liberty_dev_secret_change_in_production".to_string()
            });
        let jwt = JwtConfig::new(
            secret_str.as_bytes(),
            "liberty",
            "liberty-users",
        );
        
        Self {
            db,
            jwt,
            clients: DashMap::new(),
            sessions: DashMap::new(),
            voice_connections: DashMap::new(),
            server_members: RwLock::new(HashMap::new()),
            typing: DashMap::new(),
            rate_limits: DashMap::new(),
            version: env!("CARGO_PKG_VERSION").to_string(),
        }
    }
    
    /// Check if a user is online
    pub fn is_user_online(&self, user_id: &Uuid) -> bool {
        self.clients.contains_key(user_id)
    }
    
    /// Get online users in a server
    pub async fn get_online_server_members(&self, server_id: &Uuid) -> Vec<Uuid> {
        let members = self.server_members.read().await;
        if let Some(member_ids) = members.get(server_id) {
            member_ids
                .iter()
                .filter(|id| self.clients.contains_key(id))
                .cloned()
                .collect()
        } else {
            Vec::new()
        }
    }
    
    /// Add typing indicator
    pub fn add_typing(&self, channel_id: Uuid, user_id: Uuid) {
        let now = chrono::Utc::now();
        self.typing
            .entry(channel_id)
            .or_insert_with(Vec::new)
            .push((user_id, now));
    }
    
    /// Clean up old typing indicators (older than 10 seconds)
    pub fn cleanup_typing(&self) {
        let now = chrono::Utc::now();
        for mut entry in self.typing.iter_mut() {
            entry.value_mut().retain(|(_, ts)| {
                (now - *ts).num_seconds() < 10
            });
        }
    }
    
    /// Broadcast a JSON string to every connected client whose user_id is in `recipients`.
    /// Silently drops the message for clients that are no longer connected.
    pub async fn broadcast_to(&self, recipients: &[Uuid], json: &str) {
        for uid in recipients {
            if let Some(client) = self.clients.get(uid) {
                let _ = client.tx.try_send(json.to_string());
            }
        }
    }

    /// Broadcast to all members of a server that are currently online.
    pub async fn broadcast_to_server(&self, server_id: &Uuid, json: &str) {
        let online = self.get_online_server_members(server_id).await;
        self.broadcast_to(&online, json).await;
    }

    /// Broadcast a message to all connected clients that have access to the channel
    /// (server members if server channel, or DM recipients if DM channel).
    pub async fn broadcast_for_channel(&self, channel_id: Uuid, json: &str) {
        let server_id_row: Option<(Option<String>,)> = sqlx::query_as(
            "SELECT server_id FROM channels WHERE id = ?"
        )
        .bind(channel_id.to_string())
        .fetch_optional(&self.db)
        .await
        .ok()
        .flatten();

        if let Some((Some(sid_str),)) = server_id_row {
            if let Ok(sid) = Uuid::parse_str(&sid_str) {
                self.broadcast_to_server(&sid, json).await;
                return;
            }
        }

        let recipients: Vec<Uuid> = sqlx::query_scalar::<_, String>(
            "SELECT user_id FROM dm_recipients WHERE channel_id = ?"
        )
        .bind(channel_id.to_string())
        .fetch_all(&self.db)
        .await
        .unwrap_or_default()
        .into_iter()
        .filter_map(|s| Uuid::parse_str(&s).ok())
        .collect();
        self.broadcast_to(&recipients, json).await;
    }

    /// Check and consume one rate limit slot. Returns true if allowed, false if rate limited.
    /// Uses a 60-second sliding window with max_per_minute requests per user.
    pub fn check_and_consume_rate_limit(&self, user_id: &Uuid, max_per_minute: u32) -> bool {
        let now = chrono::Utc::now().timestamp();
        self.rate_limits
            .entry(*user_id)
            .and_modify(|(count, window_start)| {
                if now - *window_start >= 60 {
                    *count = 0;
                    *window_start = now;
                }
                *count += 1;
            })
            .or_insert((1, now));

        if let Some((count, _)) = self.rate_limits.get(user_id) {
            *count <= max_per_minute
        } else {
            true
        }
    }

    /// Check rate limit for a user (legacy helper)
    pub fn check_rate_limit(&self, user_id: &Uuid, max_requests: u32) -> bool {
        if let Some((count, _)) = self.rate_limits.get(user_id) {
            *count < max_requests
        } else {
            true
        }
    }
    
    /// Increment rate limit counter (legacy)
    pub fn increment_rate_limit(&self, user_id: &Uuid) {
        let now = chrono::Utc::now().timestamp();
        self.rate_limits
            .entry(*user_id)
            .and_modify(|(c, w)| {
                if now - *w >= 60 {
                    *c = 0;
                    *w = now;
                }
                *c += 1;
            })
            .or_insert((1, now));
    }
    
    /// Reset rate limit counter
    pub fn reset_rate_limit(&self, user_id: &Uuid) {
        self.rate_limits.remove(user_id);
    }
}
