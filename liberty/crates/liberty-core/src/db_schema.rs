//! Modelos alinhados ao schema PostgreSQL (db/schema.sql).
//! Fonte de verdade: db/schema.sql. Use estes tipos para integração com o mesmo banco do server.js.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Usuário (liberty_users)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbUser {
    pub id: Uuid,
    pub username: String,
    pub username_norm: String,
    pub password_hash: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Servidor (liberty_servers) — id é TEXT no banco (ex: "liberty-main-server")
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbServer {
    pub id: String,
    pub name: String,
    pub created_at: Option<DateTime<Utc>>,
}

/// Membro do servidor (liberty_server_members)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbServerMember {
    pub server_id: String,
    pub user_id: Uuid,
    pub joined_at: Option<DateTime<Utc>>,
}

/// Mensagem (liberty_messages) — id e chat_id são TEXT no banco
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbMessage {
    pub id: String,
    pub content: String,
    pub author_id: Uuid,
    pub chat_id: String,
    pub created_at: Option<DateTime<Utc>>,
}

/// Status de amizade (liberty_friend_requests.status)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum FriendshipStatus {
    Pending,
    Accepted,
}

/// Pedido/amizade (liberty_friend_requests)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbFriendRequest {
    pub id: String,
    pub from_user_id: Uuid,
    pub from_username: String,
    pub to_user_id: Option<Uuid>,
    pub to_username: Option<String>,
    pub to_username_norm: Option<String>,
    pub status: String,
    pub accepted_by_user_id: Option<Uuid>,
    pub accepted_by_username: Option<String>,
    pub accepted_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
}
