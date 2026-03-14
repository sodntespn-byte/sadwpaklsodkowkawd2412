//! Channel API endpoints

use axum::{
    extract::{State, Path},
    http::StatusCode,
    Json,
    Extension,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;
use chrono::Utc;

use crate::state::AppState;
use liberty_core::{Channel, ChannelType};

/// Create channel request
#[derive(Debug, Deserialize)]
pub struct CreateChannelRequest {
    pub name: String,
    #[serde(rename = "type")]
    pub channel_type: ChannelType,
    pub parent_id: Option<Uuid>,
    pub topic: Option<String>,
}

/// Update channel request
#[derive(Debug, Deserialize)]
pub struct UpdateChannelRequest {
    pub name: Option<String>,
    pub topic: Option<String>,
    pub position: Option<i32>,
}

/// List channels in a server
pub async fn list_channels(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
    Path(server_id): Path<Uuid>,
) -> Result<Json<Vec<Channel>>, (StatusCode, Json<super::auth::ErrorResponse>)> {
    // Check membership
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
                message: "Not a member of this server".to_string(),
            }),
        ));
    }
    
    let rows = sqlx::query_as::<_, (String, Option<String>, Option<String>, String, String, i32, Option<String>, i32, Option<i32>, Option<i32>, Option<i32>, String, String)>(
        "SELECT id, server_id, parent_id, name, type, position, topic, nsfw, bitrate, user_limit, rate_limit, created_at, updated_at FROM channels WHERE server_id = ? ORDER BY position"
    )
    .bind(server_id.to_string())
    .fetch_all(&state.db)
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
    
    let channels = rows.into_iter().map(|r| Channel {
        id: Uuid::parse_str(&r.0).unwrap(),
        server_id: r.1.and_then(|s| Uuid::parse_str(&s).ok()),
        parent_id: r.2.and_then(|s| Uuid::parse_str(&s).ok()),
        name: r.3,
        channel_type: match r.4.as_str() {
            "text" => ChannelType::Text,
            "voice" => ChannelType::Voice,
            "category" => ChannelType::Category,
            "announcement" => ChannelType::Announcement,
            "stage" => ChannelType::Stage,
            _ => ChannelType::Text,
        },
        position: r.5,
        topic: r.6,
        nsfw: r.7 != 0,
        bitrate: r.8,
        user_limit: r.9,
        rate_limit_per_user: r.10,
        created_at: chrono::DateTime::parse_from_rfc3339(&r.11).map(|d| d.with_timezone(&Utc)).unwrap(),
        updated_at: chrono::DateTime::parse_from_rfc3339(&r.12).map(|d| d.with_timezone(&Utc)).unwrap(),
    }).collect();
    
    Ok(Json(channels))
}

/// Create a channel
pub async fn create_channel(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
    Path(server_id): Path<Uuid>,
    Json(req): Json<CreateChannelRequest>,
) -> Result<Json<Channel>, (StatusCode, Json<super::auth::ErrorResponse>)> {
    // Check permissions (MANAGE_CHANNELS)
    let has_perm = check_permission(&state, user_id, server_id, liberty_core::Permissions::MANAGE_CHANNELS).await?;
    
    if !has_perm {
        return Err((
            StatusCode::FORBIDDEN,
            Json(super::auth::ErrorResponse {
                code: 403,
                message: "Missing permissions".to_string(),
            }),
        ));
    }
    
    let channel_id = Uuid::new_v4();
    let now = Utc::now();
    
    // Get next position
    let pos: i32 = sqlx::query_as::<_, (i32,)>(
        "SELECT COALESCE(MAX(position), -1) + 1 FROM channels WHERE server_id = ?"
    )
    .bind(server_id.to_string())
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(super::auth::ErrorResponse {
                code: 500,
                message: e.to_string(),
            }),
        )
    })?.0;
    
    let type_str = match req.channel_type {
        ChannelType::Text => "text",
        ChannelType::Voice => "voice",
        ChannelType::Category => "category",
        ChannelType::Announcement => "announcement",
        ChannelType::Stage => "stage",
    };
    
    sqlx::query(
        r#"
        INSERT INTO channels (id, server_id, parent_id, name, type, position, topic, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(channel_id.to_string())
    .bind(server_id.to_string())
    .bind(req.parent_id.map(|p| p.to_string()))
    .bind(&req.name)
    .bind(type_str)
    .bind(pos)
    .bind(&req.topic)
    .bind(now.to_rfc3339())
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
    
    Ok(Json(Channel {
        id: channel_id,
        server_id: Some(server_id),
        parent_id: req.parent_id,
        name: req.name,
        channel_type: req.channel_type,
        position: pos,
        topic: req.topic,
        nsfw: false,
        bitrate: None,
        user_limit: None,
        rate_limit_per_user: None,
        created_at: now,
        updated_at: now,
    }))
}

/// Get channel by ID
pub async fn get_channel(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
    Path(id): Path<Uuid>,
) -> Result<Json<Channel>, (StatusCode, Json<super::auth::ErrorResponse>)> {
    let row = sqlx::query_as::<_, (String, Option<String>, Option<String>, String, String, i32, Option<String>, i32, Option<i32>, Option<i32>, Option<i32>, String, String)>(
        "SELECT id, server_id, parent_id, name, type, position, topic, nsfw, bitrate, user_limit, rate_limit, created_at, updated_at FROM channels WHERE id = ?"
    )
    .bind(id.to_string())
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
    
    // Check access if server channel
    if let Some(ref server_id_str) = row.1 {
        if let Ok(server_id) = Uuid::parse_str(server_id_str) {
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
    }
    
    Ok(Json(Channel {
        id: Uuid::parse_str(&row.0).unwrap(),
        server_id: row.1.and_then(|s| Uuid::parse_str(&s).ok()),
        parent_id: row.2.and_then(|s| Uuid::parse_str(&s).ok()),
        name: row.3,
        channel_type: match row.4.as_str() {
            "text" => ChannelType::Text,
            "voice" => ChannelType::Voice,
            "category" => ChannelType::Category,
            "announcement" => ChannelType::Announcement,
            "stage" => ChannelType::Stage,
            _ => ChannelType::Text,
        },
        position: row.5,
        topic: row.6,
        nsfw: row.7 != 0,
        bitrate: row.8,
        user_limit: row.9,
        rate_limit_per_user: row.10,
        created_at: chrono::DateTime::parse_from_rfc3339(&row.11).map(|d| d.with_timezone(&Utc)).unwrap(),
        updated_at: chrono::DateTime::parse_from_rfc3339(&row.12).map(|d| d.with_timezone(&Utc)).unwrap(),
    }))
}

/// Update channel
pub async fn update_channel(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateChannelRequest>,
) -> Result<Json<Channel>, (StatusCode, Json<super::auth::ErrorResponse>)> {
    // Get channel to find server_id
    let server_row: Option<(Option<String>,)> = sqlx::query_as("SELECT server_id FROM channels WHERE id = ?")
        .bind(id.to_string())
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
    
    let server_id_str = match server_row {
        Some(s) => s.0,
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
    
    // Check permissions
    if let Some(sid) = &server_id_str {
        let server_id = Uuid::parse_str(sid).map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(super::auth::ErrorResponse {
                    code: 500,
                    message: "Invalid server ID".to_string(),
                }),
            )
        })?;
        
        let has_perm = check_permission(&state, user_id, server_id, liberty_core::Permissions::MANAGE_CHANNELS).await?;
        
        if !has_perm {
            return Err((
                StatusCode::FORBIDDEN,
                Json(super::auth::ErrorResponse {
                    code: 403,
                    message: "Missing permissions".to_string(),
                }),
            ));
        }
    }
    
    // Update
    let now = Utc::now();
    let mut updates = vec!["updated_at = ?"];
    let mut params: Vec<String> = vec![now.to_rfc3339()];
    
    if let Some(name) = &req.name {
        updates.push("name = ?");
        params.push(name.clone());
    }
    if let Some(topic) = &req.topic {
        updates.push("topic = ?");
        params.push(topic.clone());
    }
    if let Some(position) = req.position {
        updates.push("position = ?");
        params.push(position.to_string());
    }
    
    let query = format!("UPDATE channels SET {} WHERE id = ?", updates.join(", "));
    let mut sql_query = sqlx::query(&query);
    for param in params {
        sql_query = sql_query.bind(param);
    }
    sql_query = sql_query.bind(id.to_string());
    
    sql_query.execute(&state.db).await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(super::auth::ErrorResponse {
                code: 500,
                message: e.to_string(),
            }),
        )
    })?;
    
    get_channel(State(state), Extension(user_id), Path(id)).await
}

/// Delete channel
pub async fn delete_channel(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, Json<super::auth::ErrorResponse>)> {
    // Get channel to find server_id
    let server_row: Option<(Option<String>,)> = sqlx::query_as("SELECT server_id FROM channels WHERE id = ?")
        .bind(id.to_string())
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
    
    let server_id_str = match server_row {
        Some(s) => s.0,
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
    
    // Check permissions
    if let Some(sid) = &server_id_str {
        let server_id = Uuid::parse_str(sid).map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(super::auth::ErrorResponse {
                    code: 500,
                    message: "Invalid server ID".to_string(),
                }),
            )
        })?;
        
        let has_perm = check_permission(&state, user_id, server_id, liberty_core::Permissions::MANAGE_CHANNELS).await?;
        
        if !has_perm {
            return Err((
                StatusCode::FORBIDDEN,
                Json(super::auth::ErrorResponse {
                    code: 403,
                    message: "Missing permissions".to_string(),
                }),
            ));
        }
    }
    
    sqlx::query("DELETE FROM channels WHERE id = ?")
        .bind(id.to_string())
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

/// Check if user has permission in server
pub async fn check_permission(
    state: &Arc<AppState>,
    user_id: Uuid,
    server_id: Uuid,
    permission: u64,
) -> Result<bool, (StatusCode, Json<super::auth::ErrorResponse>)> {
    // Get user's roles and check permissions
    let is_owner: Option<(String,)> = sqlx::query_as(
        "SELECT owner_id FROM servers WHERE id = ? AND owner_id = ?"
    )
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
    
    if is_owner.is_some() {
        return Ok(true); // Owner has all permissions
    }
    
    // Check role permissions
    let perms: Vec<(i64,)> = sqlx::query_as(
        r#"
        SELECT r.permissions FROM roles r
        JOIN member_roles mr ON r.id = mr.role_id
        WHERE mr.server_id = ? AND mr.user_id = ?
        "#
    )
    .bind(server_id.to_string())
    .bind(user_id.to_string())
    .fetch_all(&state.db)
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
    
    // Check if any role has the permission or administrator
    for (perm_value,) in perms {
        let p = liberty_core::Permissions { value: perm_value as u64 };
        if p.has(permission) {
            return Ok(true);
        }
    }
    
    Ok(false)
}
