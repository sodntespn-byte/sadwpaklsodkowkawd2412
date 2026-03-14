//! Message API endpoints

use axum::{
    extract::{State, Path, Query},
    http::StatusCode,
    Json,
    Extension,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;
use chrono::Utc;

use crate::state::AppState;
use liberty_core::{Message, Attachment, Embed, Reaction};

/// Create message request
#[derive(Debug, Deserialize)]
pub struct CreateMessageRequest {
    pub content: String,
    pub tts: Option<bool>,
    pub embeds: Option<Vec<Embed>>,
}

/// Update message request
#[derive(Debug, Deserialize)]
pub struct UpdateMessageRequest {
    pub content: String,
}

/// Message query parameters
#[derive(Debug, Deserialize)]
pub struct MessageQuery {
    pub before: Option<Uuid>,
    pub after: Option<Uuid>,
    pub limit: Option<u32>,
}

/// List messages in a channel
pub async fn list_messages(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
    Path(channel_id): Path<Uuid>,
    Query(query): Query<MessageQuery>,
) -> Result<Json<Vec<Message>>, (StatusCode, Json<super::auth::ErrorResponse>)> {
    // Check channel access
    let channel = get_channel_info(&state, channel_id).await?;
    
    if let Some(server_id) = channel.server_id {
        let member = sqlx::query("SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?")
            .bind(server_id.to_string())
            .bind(user_id.to_string())
            .fetch_optional(&state.db)
            .await
            .map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(super::auth::ErrorResponse {
                        code: 500,
                        message: e.to_string(),
                    }),
                )
            })?;
        
        if member.is_none() {
            return Err((
                StatusCode::FORBIDDEN,
                Json(super::auth::ErrorResponse {
                    code: 403,
                    message: "No access to this channel".to_string(),
                }),
            ));
        }
    }
    
    let limit = query.limit.unwrap_or(50).min(100);
    
    let rows = if let Some(before) = query.before {
        sqlx::query_as::<_, (String, String, String, String, Option<String>, i32, i32, i32, String)>(
            r#"
            SELECT id, channel_id, author_id, content, edited_at, tts, mention_everyone, pinned, created_at
            FROM messages
            WHERE channel_id = ? AND id < ?
            ORDER BY created_at DESC
            LIMIT ?
            "#
        )
        .bind(channel_id.to_string())
        .bind(before.to_string())
        .bind(limit as i32)
        .fetch_all(&state.db)
        .await
    } else if let Some(after) = query.after {
        sqlx::query_as::<_, (String, String, String, String, Option<String>, i32, i32, i32, String)>(
            r#"
            SELECT id, channel_id, author_id, content, edited_at, tts, mention_everyone, pinned, created_at
            FROM messages
            WHERE channel_id = ? AND id > ?
            ORDER BY created_at ASC
            LIMIT ?
            "#
        )
        .bind(channel_id.to_string())
        .bind(after.to_string())
        .bind(limit as i32)
        .fetch_all(&state.db)
        .await
    } else {
        sqlx::query_as::<_, (String, String, String, String, Option<String>, i32, i32, i32, String)>(
            r#"
            SELECT id, channel_id, author_id, content, edited_at, tts, mention_everyone, pinned, created_at
            FROM messages
            WHERE channel_id = ?
            ORDER BY created_at DESC
            LIMIT ?
            "#
        )
        .bind(channel_id.to_string())
        .bind(limit as i32)
        .fetch_all(&state.db)
        .await
    }.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(super::auth::ErrorResponse {
                code: 500,
                message: e.to_string(),
            }),
        )
    })?;
    
    let messages = rows.into_iter().map(|r| Message {
        id: Uuid::parse_str(&r.0).unwrap(),
        channel_id: Uuid::parse_str(&r.1).unwrap(),
        author_id: Uuid::parse_str(&r.2).unwrap(),
        content: r.3,
        edited_timestamp: r.4.and_then(|s| chrono::DateTime::parse_from_rfc3339(&s).ok().map(|d| d.with_timezone(&Utc))),
        tts: r.5 != 0,
        mention_everyone: r.6 != 0,
        mentions: vec![],
        mention_roles: vec![],
        attachments: vec![],
        embeds: vec![],
        reactions: vec![],
        pinned: r.7 != 0,
        created_at: chrono::DateTime::parse_from_rfc3339(&r.8).map(|d| d.with_timezone(&Utc)).unwrap(),
    }).collect();
    
    Ok(Json(messages))
}

/// Create a message
pub async fn create_message(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
    Path(channel_id): Path<Uuid>,
    Json(req): Json<CreateMessageRequest>,
) -> Result<Json<Message>, (StatusCode, Json<super::auth::ErrorResponse>)> {
    // Validate content
    if req.content.is_empty() && req.embeds.as_ref().map_or(true, |e| e.is_empty()) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(super::auth::ErrorResponse {
                code: 400,
                message: "Message content or embeds required".to_string(),
            }),
        ));
    }
    
    if req.content.len() > 2000 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(super::auth::ErrorResponse {
                code: 400,
                message: "Message content too long (max 2000 characters)".to_string(),
            }),
        ));
    }
    
    // Check channel access
    let channel = get_channel_info(&state, channel_id).await?;
    
    if let Some(server_id) = channel.server_id {
        let member = sqlx::query("SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?")
            .bind(server_id.to_string())
            .bind(user_id.to_string())
            .fetch_optional(&state.db)
            .await
            .map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(super::auth::ErrorResponse {
                        code: 500,
                        message: e.to_string(),
                    }),
                )
            })?;
        
        if member.is_none() {
            return Err((
                StatusCode::FORBIDDEN,
                Json(super::auth::ErrorResponse {
                    code: 403,
                    message: "No access to this channel".to_string(),
                }),
            ));
        }
    }
    
    let message_id = Uuid::new_v4();
    let now = Utc::now();
    
    sqlx::query(
        r#"
        INSERT INTO messages (id, channel_id, author_id, content, tts, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(message_id.to_string())
    .bind(channel_id.to_string())
    .bind(user_id.to_string())
    .bind(&req.content)
    .bind(req.tts.unwrap_or(false) as i32)
    .bind(now.to_rfc3339())
    .execute(&state.db)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(super::auth::ErrorResponse {
                code: 500,
                message: e.to_string(),
            }),
        )
    })?;
    
    Ok(Json(Message {
        id: message_id,
        channel_id,
        author_id: user_id,
        content: req.content,
        edited_timestamp: None,
        tts: req.tts.unwrap_or(false),
        mention_everyone: false,
        mentions: vec![],
        mention_roles: vec![],
        attachments: vec![],
        embeds: req.embeds.unwrap_or_default(),
        reactions: vec![],
        pinned: false,
        created_at: now,
    }))
}

/// Get a single message
pub async fn get_message(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
    Path((channel_id, message_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Message>, (StatusCode, Json<super::auth::ErrorResponse>)> {
    let row = sqlx::query_as::<_, (String, String, String, String, Option<String>, i32, i32, i32, String)>(
        "SELECT id, channel_id, author_id, content, edited_at, tts, mention_everyone, pinned, created_at FROM messages WHERE id = ? AND channel_id = ?"
    )
    .bind(message_id.to_string())
    .bind(channel_id.to_string())
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(super::auth::ErrorResponse {
                code: 500,
                message: e.to_string(),
            }),
        )
    })?;
    
    let row = match row {
        Some(r) => r,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(super::auth::ErrorResponse {
                    code: 404,
                    message: "Message not found".to_string(),
                }),
            ));
        }
    };
    
    Ok(Json(Message {
        id: Uuid::parse_str(&row.0).unwrap(),
        channel_id: Uuid::parse_str(&row.1).unwrap(),
        author_id: Uuid::parse_str(&row.2).unwrap(),
        content: row.3,
        edited_timestamp: row.4.and_then(|s| chrono::DateTime::parse_from_rfc3339(&s).ok().map(|d| d.with_timezone(&Utc))),
        tts: row.5 != 0,
        mention_everyone: row.6 != 0,
        mentions: vec![],
        mention_roles: vec![],
        attachments: vec![],
        embeds: vec![],
        reactions: vec![],
        pinned: row.7 != 0,
        created_at: chrono::DateTime::parse_from_rfc3339(&row.8).map(|d| d.with_timezone(&Utc)).unwrap(),
    }))
}

/// Update a message
pub async fn update_message(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
    Path((channel_id, message_id)): Path<(Uuid, Uuid)>,
    Json(req): Json<UpdateMessageRequest>,
) -> Result<Json<Message>, (StatusCode, Json<super::auth::ErrorResponse>)> {
    // Check ownership
    let author: Option<(String,)> = sqlx::query_as(
        "SELECT author_id FROM messages WHERE id = ? AND channel_id = ?"
    )
    .bind(message_id.to_string())
    .bind(channel_id.to_string())
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(super::auth::ErrorResponse {
                code: 500,
                message: e.to_string(),
            }),
        )
    })?;
    
    let author = match author {
        Some(a) => a,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(super::auth::ErrorResponse {
                    code: 404,
                    message: "Message not found".to_string(),
                }),
            ));
        }
    };
    
    if author.0 != user_id.to_string() {
        return Err((
            StatusCode::FORBIDDEN,
            Json(super::auth::ErrorResponse {
                code: 403,
                message: "Can only edit your own messages".to_string(),
            }),
        ));
    }
    
    let now = Utc::now();
    
    sqlx::query(
        "UPDATE messages SET content = ?, edited_at = ? WHERE id = ?"
    )
    .bind(&req.content)
    .bind(now.to_rfc3339())
    .bind(message_id.to_string())
    .execute(&state.db)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(super::auth::ErrorResponse {
                code: 500,
                message: e.to_string(),
            }),
        )
    })?;
    
    get_message(State(state), Extension(user_id), Path((channel_id, message_id))).await
}

/// Delete a message
pub async fn delete_message(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
    Path((channel_id, message_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, (StatusCode, Json<super::auth::ErrorResponse>)> {
    // Check ownership or manage messages permission
    let msg_info: Option<(String, Option<String>)> = sqlx::query_as(
        r#"
        SELECT m.author_id, c.server_id 
        FROM messages m 
        JOIN channels c ON m.channel_id = c.id 
        WHERE m.id = ? AND m.channel_id = ?
        "#
    )
    .bind(message_id.to_string())
    .bind(channel_id.to_string())
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(super::auth::ErrorResponse {
                code: 500,
                message: e.to_string(),
            }),
        )
    })?;
    
    let (author_id, server_id) = match msg_info {
        Some(m) => m,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(super::auth::ErrorResponse {
                    code: 404,
                    message: "Message not found".to_string(),
                }),
            ));
        }
    };
    
    // Allow if author or has MANAGE_MESSAGES permission
    if author_id != user_id.to_string() {
        if let Some(sid) = server_id {
            let server_uuid = Uuid::parse_str(&sid).map_err(|_| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(super::auth::ErrorResponse {
                        code: 500,
                        message: "Invalid server ID".to_string(),
                    }),
                )
            })?;
            
            // Check permission
            let has_perm = super::channels::check_permission(&state, user_id, server_uuid, liberty_core::Permissions::MANAGE_MESSAGES).await?;
            
            if !has_perm {
                return Err((
                    StatusCode::FORBIDDEN,
                    Json(super::auth::ErrorResponse {
                        code: 403,
                        message: "Cannot delete this message".to_string(),
                    }),
                ));
            }
        } else {
            return Err((
                StatusCode::FORBIDDEN,
                Json(super::auth::ErrorResponse {
                    code: 403,
                    message: "Cannot delete this message".to_string(),
                }),
            ));
        }
    }
    
    sqlx::query("DELETE FROM messages WHERE id = ?")
        .bind(message_id.to_string())
        .execute(&state.db)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(super::auth::ErrorResponse {
                    code: 500,
                    message: e.to_string(),
                }),
            )
        })?;
    
    Ok(StatusCode::NO_CONTENT)
}

/// Get channel info
async fn get_channel_info(
    state: &Arc<AppState>,
    channel_id: Uuid,
) -> Result<liberty_core::Channel, (StatusCode, Json<super::auth::ErrorResponse>)> {
    let row = sqlx::query_as::<_, (String, Option<String>, Option<String>, String, String, i32, Option<String>, i32, Option<i32>, Option<i32>, Option<i32>, String, String)>(
        "SELECT id, server_id, parent_id, name, type, position, topic, nsfw, bitrate, user_limit, rate_limit, created_at, updated_at FROM channels WHERE id = ?"
    )
    .bind(channel_id.to_string())
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(super::auth::ErrorResponse {
                code: 500,
                message: e.to_string(),
            }),
        )
    })?;
    
    let row = match row {
        Some(r) => r,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(super::auth::ErrorResponse {
                    code: 404,
                    message: "Channel not found".to_string(),
                }),
            ));
        }
    };
    
    Ok(liberty_core::Channel {
        id: Uuid::parse_str(&row.0).unwrap(),
        server_id: row.1.and_then(|s| Uuid::parse_str(&s).ok()),
        parent_id: row.2.and_then(|s| Uuid::parse_str(&s).ok()),
        name: row.3,
        channel_type: match row.4.as_str() {
            "text" => liberty_core::ChannelType::Text,
            "voice" => liberty_core::ChannelType::Voice,
            "category" => liberty_core::ChannelType::Category,
            "announcement" => liberty_core::ChannelType::Announcement,
            "stage" => liberty_core::ChannelType::Stage,
            _ => liberty_core::ChannelType::Text,
        },
        position: row.5,
        topic: row.6,
        nsfw: row.7 != 0,
        bitrate: row.8,
        user_limit: row.9,
        rate_limit_per_user: row.10,
        created_at: chrono::DateTime::parse_from_rfc3339(&row.11).map(|d| d.with_timezone(&Utc)).unwrap(),
        updated_at: chrono::DateTime::parse_from_rfc3339(&row.12).map(|d| d.with_timezone(&Utc)).unwrap(),
    })
}
