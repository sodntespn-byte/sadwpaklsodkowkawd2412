//! Reactions API

use axum::{
    extract::{State, Path},
    http::StatusCode,
    Json,
    Extension,
};
use std::sync::Arc;
use uuid::Uuid;

use crate::state::AppState;

pub async fn add_reaction(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
    Path((channel_id, message_id, emoji)): Path<(Uuid, Uuid, String)>,
) -> Result<StatusCode, (StatusCode, Json<super::auth::ErrorResponse>)> {
    let msg_exists = sqlx::query_as::<_, (String,)>(
        "SELECT id FROM messages WHERE id = ? AND channel_id = ?"
    )
    .bind(message_id.to_string())
    .bind(channel_id.to_string())
    .fetch_optional(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(super::auth::ErrorResponse {
        code: 500, message: e.to_string(),
    })))?;

    if msg_exists.is_none() {
        return Err((StatusCode::NOT_FOUND, Json(super::auth::ErrorResponse {
            code: 404, message: "Message not found".to_string(),
        })));
    }

    sqlx::query(
        "INSERT OR IGNORE INTO reactions (message_id, emoji_name, user_id) VALUES (?, ?, ?)"
    )
    .bind(message_id.to_string())
    .bind(&emoji)
    .bind(user_id.to_string())
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(super::auth::ErrorResponse {
        code: 500, message: e.to_string(),
    })))?;

    let event = liberty_proto::ServerMessage::ReactionAdded {
        channel_id,
        message_id,
        emoji: liberty_core::Emoji {
            id: None,
            name: emoji,
            animated: false,
        },
        user_id,
    };

    if let Ok(json) = serde_json::to_string(&event) {
        let server_id_row = sqlx::query_as::<_, (Option<String>,)>(
            "SELECT server_id FROM channels WHERE id = ?"
        )
        .bind(channel_id.to_string())
        .fetch_optional(&state.db)
        .await
        .ok()
        .flatten();

        if let Some((Some(sid_str),)) = server_id_row {
            if let Ok(sid) = Uuid::parse_str(&sid_str) {
                state.broadcast_to_server(&sid, &json).await;
            }
        }
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn remove_reaction(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
    Path((channel_id, message_id, emoji)): Path<(Uuid, Uuid, String)>,
) -> Result<StatusCode, (StatusCode, Json<super::auth::ErrorResponse>)> {
    sqlx::query(
        "DELETE FROM reactions WHERE message_id = ? AND emoji_name = ? AND user_id = ?"
    )
    .bind(message_id.to_string())
    .bind(&emoji)
    .bind(user_id.to_string())
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(super::auth::ErrorResponse {
        code: 500, message: e.to_string(),
    })))?;

    let event = liberty_proto::ServerMessage::ReactionRemoved {
        channel_id,
        message_id,
        emoji: liberty_core::Emoji {
            id: None,
            name: emoji,
            animated: false,
        },
        user_id,
    };

    if let Ok(json) = serde_json::to_string(&event) {
        let server_id_row = sqlx::query_as::<_, (Option<String>,)>(
            "SELECT server_id FROM channels WHERE id = ?"
        )
        .bind(channel_id.to_string())
        .fetch_optional(&state.db)
        .await
        .ok()
        .flatten();

        if let Some((Some(sid_str),)) = server_id_row {
            if let Ok(sid) = Uuid::parse_str(&sid_str) {
                state.broadcast_to_server(&sid, &json).await;
            }
        }
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn get_reactions(
    State(state): State<Arc<AppState>>,
    Path((channel_id, message_id, emoji)): Path<(Uuid, Uuid, String)>,
) -> Result<Json<Vec<ReactionUser>>, (StatusCode, Json<super::auth::ErrorResponse>)> {
    let rows = sqlx::query_as::<_, (String,)>(
        "SELECT user_id FROM reactions WHERE message_id = ? AND emoji_name = ?"
    )
    .bind(message_id.to_string())
    .bind(&emoji)
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(super::auth::ErrorResponse {
        code: 500, message: e.to_string(),
    })))?;

    let mut users = Vec::new();
    for (uid_str,) in rows {
        let user = sqlx::query_as::<_, (String, String, String, Option<String>)>(
            "SELECT id, username, discriminator, avatar FROM users WHERE id = ?"
        )
        .bind(&uid_str)
        .fetch_optional(&state.db)
        .await
        .ok()
        .flatten();

        if let Some((id, username, disc, avatar)) = user {
            users.push(ReactionUser {
                id: Uuid::parse_str(&id).unwrap_or_default(),
                username,
                discriminator: disc,
                avatar,
            });
        }
    }

    Ok(Json(users))
}

#[derive(serde::Serialize)]
pub struct ReactionUser {
    pub id: Uuid,
    pub username: String,
    pub discriminator: String,
    pub avatar: Option<String>,
}
