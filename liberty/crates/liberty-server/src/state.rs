//! Application state management

use std::collections::HashMap;
use std::sync::Arc;
use dashmap::DashMap;
use sqlx::SqlitePool;
use tokio::sync::RwLock;
use uuid::Uuid;

use liberty_core::UserStatus;
use liberty_crypto::JwtConfig;

/// Connected client state
#[derive(Debug)]
pub struct ConnectedClient {
    pub user_id: Uuid,
    pub session_id: Uuid,
    pub status: UserStatus,
    pub connected_at: chrono::DateTime<chrono::Utc>,
    pub last_heartbeat: chrono::DateTime<chrono::Utc>,
    pub sequence: u64,
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
    
    /// Rate limiting counters
    pub rate_limits: DashMap<Uuid, u32>,
    
    /// Server version
    pub version: String,
}

impl AppState {
    pub fn new(db: SqlitePool) -> Self {
        // In production, use proper RSA keys
        let jwt = JwtConfig::new(
            b"liberty_secret_key_change_in_production",
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
    
    /// Check rate limit for a user
    pub fn check_rate_limit(&self, user_id: &Uuid, max_requests: u32) -> bool {
        if let Some(count) = self.rate_limits.get(user_id) {
            *count < max_requests
        } else {
            true
        }
    }
    
    /// Increment rate limit counter
    pub fn increment_rate_limit(&self, user_id: &Uuid) {
        self.rate_limits
            .entry(*user_id)
            .and_modify(|c| *c += 1)
            .or_insert(1);
    }
    
    /// Reset rate limit counter
    pub fn reset_rate_limit(&self, user_id: &Uuid) {
        self.rate_limits.remove(user_id);
    }
}
