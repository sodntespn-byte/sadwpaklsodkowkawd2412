//! Server (Guild) API endpoints

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
use sqlx::FromRow;

use crate::state::AppState;
use liberty_core::{Server, Channel, ServerMember, Role, Permissions, VerificationLevel, ContentFilter, NotificationLevel, ChannelType};

/// Server row from database
#[derive(Debug, FromRow)]
struct ServerRow {
    id: String,
    name: String,
    description: Option<String>,
    icon: Option<String>,
    banner: Option<String>,
    owner_id: String,
    region: String,
    afk_timeout: i32,
    afk_channel_id: Option<String>,
    system_channel_id: Option<String>,
    verification_level: i32,
    content_filter: i32,
    notification_level: i32,
    created_at: String,
    updated_at: String,
    max_members: Option<i64>,
    member_count: i64,
}

fn row_to_server(row: ServerRow) -> Server {
    Server {
        id: row.id.parse().unwrap_or_default(),
        name: row.name,
        description: row.description,
        icon: row.icon,
        banner: row.banner,
        owner_id: row.owner_id.parse().unwrap_or_default(),
        region: row.region,
        afk_timeout: row.afk_timeout,
        afk_channel_id: row.afk_channel_id.and_then(|s| s.parse().ok()),
        system_channel_id: row.system_channel_id.and_then(|s| s.parse().ok()),
        verification_level: VerificationLevel::from(row.verification_level as u8),
        content_filter: ContentFilter::from(row.content_filter as u8),
        notification_level: NotificationLevel::from(row.notification_level as u8),
        created_at: row.created_at,
        updated_at: Some(row.updated_at),
        max_members: row.max_members,
        member_count: Some(row.member_count as u64),
    }
}

/// Create server request
#[derive(Debug, Deserialize)]
pub struct CreateServerRequest {
    pub name: String,
    pub region: Option<String>,
    pub icon: Option<String>,
}

/// Update server request
#[derive(Debug, Deserialize)]
pub struct UpdateServerRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub banner: Option<String>,
}

/// Server response with channels and roles
#[derive(Debug, Serialize)]
pub struct ServerResponse {
    pub server: Server,
    pub channels: Vec<Channel>,
    pub roles: Vec<Role>,
    pub members: Vec<ServerMember>,
}

/// List user's servers
pub async fn list_servers(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
) -> Result<Json<Vec<Server>>, (StatusCode, Json<super::auth::ErrorResponse>)> {
    let rows = sqlx::query_as::<_, ServerRow>(
        r#"
        SELECT s.id, s.name, s.description, s.icon, s.banner, s.owner_id, s.region,
               s.afk_timeout, s.afk_channel_id, s.system_channel_id,
               s.verification_level, s.content_filter, s.notification_level,
               s.created_at, s.updated_at, s.max_members,
               (SELECT COUNT(*) FROM server_members WHERE server_id = s.id) as member_count
        FROM servers s
        JOIN server_members sm ON s.id = sm.server_id
        WHERE sm.user_id = ?
        "#
    )
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
    
    let servers = rows.into_iter().map(row_to_server).collect();
    Ok(Json(servers))
}

/// Create a new server
pub async fn create_server(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
    Json(req): Json<CreateServerRequest>,
) -> Result<Json<ServerResponse>, (StatusCode, Json<super::auth::ErrorResponse>)> {
    let server_id = Uuid::new_v4();
    let now = Utc::now();
    
    // Create server
    sqlx::query(
        r#"
        INSERT INTO servers (id, name, owner_id, region, icon, verification_level, content_filter, notification_level, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 0, 0, 0, ?, ?)
        "#
    )
    .bind(server_id.to_string())
    .bind(&req.name)
    .bind(user_id.to_string())
    .bind(req.region.as_deref().unwrap_or("us-east"))
    .bind(&req.icon)
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
    
    // Add owner as member
    sqlx::query(
        "INSERT INTO server_members (server_id, user_id, joined_at) VALUES (?, ?, ?)"
    )
    .bind(server_id.to_string())
    .bind(user_id.to_string())
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
    
    // Create @everyone role
    let role_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO roles (id, server_id, name, position, permissions, created_at)
        VALUES (?, ?, '@everyone', 0, ?, ?)
        "#
    )
    .bind(role_id.to_string())
    .bind(server_id.to_string())
    .bind(Permissions::VIEW_CHANNEL | Permissions::SEND_MESSAGES | Permissions::CONNECT | Permissions::SPEAK)
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
    
    // Create default channels
    let general_id = Uuid::new_v4();
    let voice_id = Uuid::new_v4();
    
    // #general text channel
    sqlx::query(
        r#"
        INSERT INTO channels (id, server_id, name, type, position, created_at, updated_at)
        VALUES (?, ?, 'general', 'text', 0, ?, ?)
        "#
    )
    .bind(general_id.to_string())
    .bind(server_id.to_string())
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
    
    // #General voice channel
    sqlx::query(
        r#"
        INSERT INTO channels (id, server_id, name, type, position, bitrate, created_at, updated_at)
        VALUES (?, ?, 'General', 'voice', 1, 64000, ?, ?)
        "#
    )
    .bind(voice_id.to_string())
    .bind(server_id.to_string())
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
    
    // Build response
    let server = Server {
        id: server_id,
        name: req.name,
        description: None,
        icon: req.icon,
        banner: None,
        owner_id: user_id,
        region: req.region.unwrap_or_else(|| "us-east".to_string()),
        afk_timeout: 300,
        afk_channel_id: None,
        system_channel_id: Some(general_id),
        verification_level: VerificationLevel::None,
        explicit_content_filter: ContentFilter::Disabled,
        default_message_notifications: NotificationLevel::AllMessages,
        created_at: now,
        updated_at: now,
        member_count: 1,
        max_members: None,
    };
    
    let channels = vec![
        Channel {
            id: general_id,
            server_id: Some(server_id),
            parent_id: None,
            name: "general".to_string(),
            channel_type: ChannelType::Text,
            position: 0,
            topic: None,
            nsfw: false,
            bitrate: None,
            user_limit: None,
            rate_limit_per_user: None,
            created_at: now,
            updated_at: now,
        },
        Channel {
            id: voice_id,
            server_id: Some(server_id),
            parent_id: None,
            name: "General".to_string(),
            channel_type: ChannelType::Voice,
            position: 1,
            topic: None,
            nsfw: false,
            bitrate: Some(64000),
            user_limit: None,
            rate_limit_per_user: None,
            created_at: now,
            updated_at: now,
        },
    ];
    
    let roles = vec![Role {
        id: role_id,
        server_id,
        name: "@everyone".to_string(),
        color: 0,
        hoist: false,
        position: 0,
        permissions: Permissions { value: 0 },
        managed: false,
        mentionable: false,
        created_at: now,
    }];
    
    let members = vec![ServerMember {
        server_id,
        user_id,
        nickname: None,
        avatar: None,
        joined_at: now,
        premium_since: None,
        deaf: false,
        mute: false,
        roles: vec![role_id],
        pending: false,
    }];
    
    Ok(Json(ServerResponse {
        server,
        channels,
        roles,
        members,
    }))
}

/// Get server by ID
pub async fn get_server(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
    Path(id): Path<Uuid>,
) -> Result<Json<ServerResponse>, (StatusCode, Json<super::auth::ErrorResponse>)> {
    // Check membership
    let member = sqlx::query("SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?")
        .bind(id.to_string())
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
    
    // Get server
    let server_row = sqlx::query_as::<_, ServerRow>(
        r#"
        SELECT id, name, description, icon, banner, owner_id, region,
               afk_timeout, afk_channel_id, system_channel_id,
               verification_level, content_filter, notification_level,
               created_at, updated_at, max_members,
               (SELECT COUNT(*) FROM server_members WHERE server_id = ?) as member_count
        FROM servers WHERE id = ?
        "#
    )
    .bind(id.to_string())
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
    
    let server_row = match server_row {
        Some(r) => r,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(super::auth::ErrorResponse {
                    code: 404,
                    message: "Server not found".to_string(),
                }),
            ));
        }
    };
    
    let server = row_to_server(server_row);
    
    // Get channels
    let channel_rows = sqlx::query_as::<_, (String, Option<String>, Option<String>, String, String, i32, Option<String>, i32, Option<i32>, Option<i32>, Option<i32>, String, String)>(
        "SELECT id, server_id, parent_id, name, type, position, topic, nsfw, bitrate, user_limit, rate_limit, created_at, updated_at FROM channels WHERE server_id = ?"
    )
    .bind(id.to_string())
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
    
    let channels = channel_rows.into_iter().map(|r| Channel {
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
    
    // Get roles
    let role_rows = sqlx::query_as::<_, (String, String, String, i32, i32, i32, i64, i32, i32, String)>(
        "SELECT id, server_id, name, color, hoist, position, permissions, managed, mentionable, created_at FROM roles WHERE server_id = ?"
    )
    .bind(id.to_string())
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
    
    let roles = role_rows.into_iter().map(|r| Role {
        id: Uuid::parse_str(&r.0).unwrap(),
        server_id: Uuid::parse_str(&r.1).unwrap(),
        name: r.2,
        color: r.3,
        hoist: r.4 != 0,
        position: r.5,
        permissions: Permissions { value: r.6 as u64 },
        managed: r.7 != 0,
        mentionable: r.8 != 0,
        created_at: chrono::DateTime::parse_from_rfc3339(&r.9).map(|d| d.with_timezone(&Utc)).unwrap(),
    }).collect();
    
    // Get members
    let member_rows = sqlx::query_as::<_, (String, String, Option<String>, Option<String>, String, Option<String>, i32, i32, i32)>(
        "SELECT server_id, user_id, nickname, avatar, joined_at, premium_since, deaf, mute, pending FROM server_members WHERE server_id = ?"
    )
    .bind(id.to_string())
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
    
    let members = member_rows.into_iter().map(|r| ServerMember {
        server_id: Uuid::parse_str(&r.0).unwrap(),
        user_id: Uuid::parse_str(&r.1).unwrap(),
        nickname: r.2,
        avatar: r.3,
        joined_at: chrono::DateTime::parse_from_rfc3339(&r.4).map(|d| d.with_timezone(&Utc)).unwrap(),
        premium_since: r.5.and_then(|s| chrono::DateTime::parse_from_rfc3339(&s).ok().map(|d| d.with_timezone(&Utc))),
        deaf: r.6 != 0,
        mute: r.7 != 0,
        roles: vec![], // TODO: Load roles
        pending: r.8 != 0,
    }).collect();
    
    Ok(Json(ServerResponse {
        server,
        channels,
        roles,
        members,
    }))
}

/// Update server
pub async fn update_server(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateServerRequest>,
) -> Result<Json<Server>, (StatusCode, Json<super::auth::ErrorResponse>)> {
    // Check ownership
    let owner = sqlx::query_as::<_, (String,)>("SELECT owner_id FROM servers WHERE id = ?")
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
    
    let owner = match owner {
        Some(o) => o,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(super::auth::ErrorResponse {
                    code: 404,
                    message: "Server not found".to_string(),
                }),
            ));
        }
    };
    
    if owner.0 != user_id.to_string() {
        return Err((
            StatusCode::FORBIDDEN,
            Json(super::auth::ErrorResponse {
                code: 403,
                message: "Only the server owner can update the server".to_string(),
            }),
        ));
    }
    
    // Update
    let now = Utc::now();
    let mut updates = vec!["updated_at = ?"];
    let mut params: Vec<String> = vec![now.to_rfc3339()];
    
    if let Some(name) = &req.name {
        updates.push("name = ?");
        params.push(name.clone());
    }
    if let Some(description) = &req.description {
        updates.push("description = ?");
        params.push(description.clone());
    }
    if let Some(icon) = &req.icon {
        updates.push("icon = ?");
        params.push(icon.clone());
    }
    if let Some(banner) = &req.banner {
        updates.push("banner = ?");
        params.push(banner.clone());
    }
    
    let query = format!("UPDATE servers SET {} WHERE id = ?", updates.join(", "));
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
    
    // Return updated server
    let row = sqlx::query_as::<_, ServerRow>(
        r#"
        SELECT id, name, description, icon, banner, owner_id, region,
               afk_timeout, afk_channel_id, system_channel_id,
               verification_level, content_filter, notification_level,
               created_at, updated_at, max_members,
               (SELECT COUNT(*) FROM server_members WHERE server_id = ?) as member_count
        FROM servers WHERE id = ?
        "#
    )
    .bind(id.to_string())
    .bind(id.to_string())
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
    })?;
    
    Ok(Json(row_to_server(row)))
}

/// Delete server
pub async fn delete_server(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, Json<super::auth::ErrorResponse>)> {
    // Check ownership
    let owner = sqlx::query_as::<_, (String,)>("SELECT owner_id FROM servers WHERE id = ?")
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
    
    let owner = match owner {
        Some(o) => o,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(super::auth::ErrorResponse {
                    code: 404,
                    message: "Server not found".to_string(),
                }),
            ));
        }
    };
    
    if owner.0 != user_id.to_string() {
        return Err((
            StatusCode::FORBIDDEN,
            Json(super::auth::ErrorResponse {
                code: 403,
                message: "Only the server owner can delete the server".to_string(),
            }),
        ));
    }
    
    // Delete server (cascade will handle related records)
    sqlx::query("DELETE FROM servers WHERE id = ?")
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
