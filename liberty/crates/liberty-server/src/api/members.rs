//! Server member API endpoints

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
use liberty_core::ServerMember;

/// Update member request
#[derive(Debug, Deserialize)]
pub struct UpdateMemberRequest {
    pub nickname: Option<String>,
    pub roles: Option<Vec<Uuid>>,
    pub mute: Option<bool>,
    pub deaf: Option<bool>,
}

/// List server members
pub async fn list_members(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
    Path(server_id): Path<Uuid>,
) -> Result<Json<Vec<ServerMember>>, (StatusCode, Json<super::auth::ErrorResponse>)> {
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
    
    let rows = sqlx::query_as::<_, (String, String, Option<String>, Option<String>, String, Option<String>, i32, i32, i32)>(
        "SELECT server_id, user_id, nickname, avatar, joined_at, premium_since, deaf, mute, pending FROM server_members WHERE server_id = ?"
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
    
    let members = rows.into_iter().map(|r| ServerMember {
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
    
    Ok(Json(members))
}

/// Get a specific member
pub async fn get_member(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
    Path((server_id, target_user_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<ServerMember>, (StatusCode, Json<super::auth::ErrorResponse>)> {
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
    
    let row = sqlx::query_as::<_, (String, String, Option<String>, Option<String>, String, Option<String>, i32, i32, i32)>(
        "SELECT server_id, user_id, nickname, avatar, joined_at, premium_since, deaf, mute, pending FROM server_members WHERE server_id = ? AND user_id = ?"
    )
    .bind(server_id.to_string())
    .bind(target_user_id.to_string())
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
                    message: "Member not found".to_string(),
                }),
            ));
        }
    };
    
    Ok(Json(ServerMember {
        server_id: Uuid::parse_str(&row.0).unwrap(),
        user_id: Uuid::parse_str(&row.1).unwrap(),
        nickname: row.2,
        avatar: row.3,
        joined_at: chrono::DateTime::parse_from_rfc3339(&row.4).map(|d| d.with_timezone(&Utc)).unwrap(),
        premium_since: row.5.and_then(|s| chrono::DateTime::parse_from_rfc3339(&s).ok().map(|d| d.with_timezone(&Utc))),
        deaf: row.6 != 0,
        mute: row.7 != 0,
        roles: vec![],
        pending: row.8 != 0,
    }))
}

/// Update member (nickname, roles, etc.)
pub async fn update_member(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
    Path((server_id, target_user_id)): Path<(Uuid, Uuid)>,
    Json(req): Json<UpdateMemberRequest>,
) -> Result<Json<ServerMember>, (StatusCode, Json<super::auth::ErrorResponse>)> {
    // Check if updating self or has permission
    if target_user_id != user_id {
        let has_perm = super::channels::check_permission(
            &state, user_id, server_id, liberty_core::Permissions::MANAGE_ROLES
        ).await?;
        
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
    if let Some(nickname) = &req.nickname {
        sqlx::query(
            "UPDATE server_members SET nickname = ? WHERE server_id = ? AND user_id = ?"
        )
        .bind(nickname)
        .bind(server_id.to_string())
        .bind(target_user_id.to_string())
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
    }
    
    if let Some(roles) = &req.roles {
        // Remove existing roles
        sqlx::query("DELETE FROM member_roles WHERE server_id = ? AND user_id = ?")
            .bind(server_id.to_string())
            .bind(target_user_id.to_string())
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
        
        // Add new roles
        for role_id in roles {
            sqlx::query(
                "INSERT INTO member_roles (server_id, user_id, role_id) VALUES (?, ?, ?)"
            )
            .bind(server_id.to_string())
            .bind(target_user_id.to_string())
            .bind(role_id.to_string())
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
        }
    }
    
    if let Some(mute) = req.mute {
        sqlx::query(
            "UPDATE server_members SET mute = ? WHERE server_id = ? AND user_id = ?"
        )
        .bind(mute as i32)
        .bind(server_id.to_string())
        .bind(target_user_id.to_string())
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
    }
    
    if let Some(deaf) = req.deaf {
        sqlx::query(
            "UPDATE server_members SET deaf = ? WHERE server_id = ? AND user_id = ?"
        )
        .bind(deaf as i32)
        .bind(server_id.to_string())
        .bind(target_user_id.to_string())
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
    }
    
    get_member(State(state), Extension(user_id), Path((server_id, target_user_id))).await
}

/// Remove member (kick)
pub async fn remove_member(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
    Path((server_id, target_user_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, (StatusCode, Json<super::auth::ErrorResponse>)> {
    // Check kick permission
    let has_perm = super::channels::check_permission(
        &state, user_id, server_id, liberty_core::Permissions::KICK_MEMBERS
    ).await?;
    
    if !has_perm {
        return Err((
            StatusCode::FORBIDDEN,
            Json(super::auth::ErrorResponse {
                code: 403,
                message: "Missing permissions".to_string(),
            }),
        ));
    }
    
    // Cannot kick owner
    let owner: Option<(String,)> = sqlx::query_as(
        "SELECT owner_id FROM servers WHERE id = ?"
    )
    .bind(server_id.to_string())
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
    
    if let Some(o) = &owner {
        if o.0 == target_user_id.to_string() {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(super::auth::ErrorResponse {
                    code: 400,
                    message: "Cannot kick the server owner".to_string(),
                }),
            ));
        }
    }
    
    // Remove member
    sqlx::query("DELETE FROM server_members WHERE server_id = ? AND user_id = ?")
        .bind(server_id.to_string())
        .bind(target_user_id.to_string())
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
