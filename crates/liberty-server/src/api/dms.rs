//! Direct Messages API

use axum::{
    extract::State,
    http::StatusCode,
    Json,
    Extension,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;
use chrono::Utc;

use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct CreateDMRequest {
    pub recipient_id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct DMChannel {
    pub id: Uuid,
    pub r#type: String,
    pub recipients: Vec<DMRecipient>,
    pub last_message_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DMRecipient {
    pub id: Uuid,
    pub username: String,
    pub discriminator: String,
    pub avatar: Option<String>,
    pub status: String,
}

pub async fn list_dm_channels(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
) -> Result<Json<Vec<DMChannel>>, (StatusCode, Json<super::auth::ErrorResponse>)> {
    let rows = sqlx::query_as::<_, (String,)>(
        "SELECT channel_id FROM dm_recipients WHERE user_id = ?"
    )
    .bind(user_id.to_string())
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(super::auth::ErrorResponse {
        code: 500, message: e.to_string(),
    })))?;

    let mut channels = Vec::new();

    for (channel_id_str,) in rows {
        let channel_id = Uuid::parse_str(&channel_id_str).unwrap_or_default();

        let recipients = sqlx::query_as::<_, (String, String, String, Option<String>, String)>(
            r#"
            SELECT u.id, u.username, u.discriminator, u.avatar, u.status
            FROM dm_recipients dr
            JOIN users u ON u.id = dr.user_id
            WHERE dr.channel_id = ? AND dr.user_id != ?
            "#
        )
        .bind(&channel_id_str)
        .bind(user_id.to_string())
        .fetch_all(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(super::auth::ErrorResponse {
            code: 500, message: e.to_string(),
        })))?;

        let last_msg = sqlx::query_as::<_, (String,)>(
            "SELECT id FROM messages WHERE channel_id = ? ORDER BY created_at DESC LIMIT 1"
        )
        .bind(&channel_id_str)
        .fetch_optional(&state.db)
        .await
        .ok()
        .flatten();

        channels.push(DMChannel {
            id: channel_id,
            r#type: "dm".to_string(),
            recipients: recipients.into_iter().map(|(id, username, disc, avatar, status)| {
                DMRecipient {
                    id: Uuid::parse_str(&id).unwrap_or_default(),
                    username,
                    discriminator: disc,
                    avatar,
                    status,
                }
            }).collect(),
            last_message_id: last_msg.map(|(id,)| id),
        });
    }

    Ok(Json(channels))
}

pub async fn create_dm_channel(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
    Json(req): Json<CreateDMRequest>,
) -> Result<Json<DMChannel>, (StatusCode, Json<super::auth::ErrorResponse>)> {
    let existing = sqlx::query_as::<_, (String,)>(
        r#"
        SELECT dr1.channel_id FROM dm_recipients dr1
        JOIN dm_recipients dr2 ON dr1.channel_id = dr2.channel_id
        WHERE dr1.user_id = ? AND dr2.user_id = ?
        "#
    )
    .bind(user_id.to_string())
    .bind(req.recipient_id.to_string())
    .fetch_optional(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(super::auth::ErrorResponse {
        code: 500, message: e.to_string(),
    })))?;

    if let Some((channel_id_str,)) = existing {
        let channel_id = Uuid::parse_str(&channel_id_str).unwrap_or_default();
        let recipient = sqlx::query_as::<_, (String, String, String, Option<String>, String)>(
            "SELECT id, username, discriminator, avatar, status FROM users WHERE id = ?"
        )
        .bind(req.recipient_id.to_string())
        .fetch_one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(super::auth::ErrorResponse {
            code: 500, message: e.to_string(),
        })))?;

        return Ok(Json(DMChannel {
            id: channel_id,
            r#type: "dm".to_string(),
            recipients: vec![DMRecipient {
                id: Uuid::parse_str(&recipient.0).unwrap_or_default(),
                username: recipient.1,
                discriminator: recipient.2,
                avatar: recipient.3,
                status: recipient.4,
            }],
            last_message_id: None,
        }));
    }

    let channel_id = Uuid::new_v4();
    let now = Utc::now();

    sqlx::query(
        "INSERT INTO channels (id, name, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(channel_id.to_string())
    .bind("DM")
    .bind("dm")
    .bind(now.to_rfc3339())
    .bind(now.to_rfc3339())
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(super::auth::ErrorResponse {
        code: 500, message: e.to_string(),
    })))?;

    sqlx::query("INSERT INTO dm_recipients (channel_id, user_id) VALUES (?, ?)")
        .bind(channel_id.to_string())
        .bind(user_id.to_string())
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(super::auth::ErrorResponse {
            code: 500, message: e.to_string(),
        })))?;

    sqlx::query("INSERT INTO dm_recipients (channel_id, user_id) VALUES (?, ?)")
        .bind(channel_id.to_string())
        .bind(req.recipient_id.to_string())
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(super::auth::ErrorResponse {
            code: 500, message: e.to_string(),
        })))?;

    let recipient = sqlx::query_as::<_, (String, String, String, Option<String>, String)>(
        "SELECT id, username, discriminator, avatar, status FROM users WHERE id = ?"
    )
    .bind(req.recipient_id.to_string())
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(super::auth::ErrorResponse {
        code: 500, message: e.to_string(),
    })))?;

    Ok(Json(DMChannel {
        id: channel_id,
        r#type: "dm".to_string(),
        recipients: vec![DMRecipient {
            id: Uuid::parse_str(&recipient.0).unwrap_or_default(),
            username: recipient.1,
            discriminator: recipient.2,
            avatar: recipient.3,
            status: recipient.4,
        }],
        last_message_id: None,
    }))
}
