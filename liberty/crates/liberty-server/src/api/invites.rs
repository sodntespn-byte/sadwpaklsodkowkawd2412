//! Invite API endpoints

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
use liberty_core::{Invite, Server, Channel};

/// Create invite request
#[derive(Debug, Deserialize)]
pub struct CreateInviteRequest {
    pub max_uses: Option<i32>,
    pub max_age: Option<i32>,
    pub temporary: Option<bool>,
}

/// Generate invite code
fn generate_invite_code() -> String {
    const CHARSET: &[u8] = b"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let mut code = String::with_capacity(8);
    for _ in 0..8 {
        let idx = rand::random::<usize>() % CHARSET.len();
        code.push(CHARSET[idx] as char);
    }
    code
}

/// Get invite by code
pub async fn get_invite(
    State(state): State<Arc<AppState>>,
    Path(code): Path<String>,
) -> Result<Json<Invite>, (StatusCode, Json<super::auth::ErrorResponse>)> {
    let row = sqlx::query_as::<_, (String, String, String, Option<String>, Option<String>, Option<i32>, i32, Option<i32>, Option<i32>, i32, String, Option<String>)>(
        r#"
        SELECT code, server_id, channel_id, inviter_id, target_user_id, target_type,
               uses, max_uses, max_age, temporary, created_at, expires_at
        FROM invites WHERE code = ?
        "#
    )
    .bind(&code)
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
                    message: "Invite not found".to_string(),
                }),
            ));
        }
    };
    
    // Check if expired
    if let Some(expires) = &row.11 {
        if let Ok(expires_dt) = chrono::DateTime::parse_from_rfc3339(expires) {
            if expires_dt.with_timezone(&Utc) < Utc::now() {
                return Err((
                    StatusCode::NOT_FOUND,
                    Json(super::auth::ErrorResponse {
                        code: 404,
                        message: "Invite expired".to_string(),
                    }),
                ));
            }
        }
    }
    
    // Check if max uses reached
    if let Some(max_uses) = row.7 {
        if row.6 >= max_uses {
            return Err((
                StatusCode::NOT_FOUND,
                Json(super::auth::ErrorResponse {
                    code: 404,
                    message: "Invite max uses reached".to_string(),
                }),
            ));
        }
    }
    
    Ok(Json(Invite {
        code: row.0,
        server_id: Uuid::parse_str(&row.1).unwrap(),
        channel_id: Uuid::parse_str(&row.2).unwrap(),
        inviter_id: row.3.and_then(|s| Uuid::parse_str(&s).ok()),
        target_user_id: row.4.and_then(|s| Uuid::parse_str(&s).ok()),
        target_user_type: row.5,
        approximate_member_count: None,
        approximate_presence_count: None,
        uses: row.6,
        max_uses: row.7,
        max_age: row.8,
        temporary: row.9 != 0,
        created_at: chrono::DateTime::parse_from_rfc3339(&row.10).map(|d| d.with_timezone(&Utc)).unwrap(),
        expires_at: row.11.and_then(|s| chrono::DateTime::parse_from_rfc3339(&s).ok().map(|d| d.with_timezone(&Utc))),
    }))
}

/// Create an invite
pub async fn create_invite(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
    Path(channel_id): Path<Uuid>,
    Json(req): Json<CreateInviteRequest>,
) -> Result<Json<Invite>, (StatusCode, Json<super::auth::ErrorResponse>)> {
    // Get channel and server
    let channel_row: Option<(Option<String>,)> = sqlx::query_as(
        "SELECT server_id FROM channels WHERE id = ?"
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
    
    let server_id_str = match channel_row {
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
    
    let server_id = match server_id_str {
        Some(s) => Uuid::parse_str(&s).map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(super::auth::ErrorResponse {
                    code: 500,
                    message: "Invalid server ID".to_string(),
                }),
            )
        })?,
        None => {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(super::auth::ErrorResponse {
                    code: 400,
                    message: "Cannot create invite for DM channel".to_string(),
                }),
            ));
        }
    };
    
    // Check permission
    let has_perm = super::channels::check_permission(
        &state, user_id, server_id, liberty_core::Permissions::CREATE_INSTANT_INVITE
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
    
    let code = generate_invite_code();
    let now = Utc::now();
    let expires_at = req.max_age.and_then(|age| {
        if age > 0 {
            Some(now + chrono::Duration::seconds(age as i64))
        } else {
            None
        }
    });
    
    sqlx::query(
        r#"
        INSERT INTO invites (code, server_id, channel_id, inviter_id, max_uses, max_age, temporary, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(&code)
    .bind(server_id.to_string())
    .bind(channel_id.to_string())
    .bind(user_id.to_string())
    .bind(req.max_uses)
    .bind(req.max_age)
    .bind(req.temporary.unwrap_or(false) as i32)
    .bind(now.to_rfc3339())
    .bind(expires_at.map(|e| e.to_rfc3339()))
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
    
    Ok(Json(Invite {
        code,
        server_id,
        channel_id,
        inviter_id: Some(user_id),
        target_user_id: None,
        target_user_type: None,
        approximate_member_count: None,
        approximate_presence_count: None,
        uses: 0,
        max_uses: req.max_uses,
        max_age: req.max_age,
        temporary: req.temporary.unwrap_or(false),
        created_at: now,
        expires_at,
    }))
}

/// Delete an invite
pub async fn delete_invite(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
    Path(code): Path<String>,
) -> Result<StatusCode, (StatusCode, Json<super::auth::ErrorResponse>)> {
    // Get invite
    let invite_row: Option<(String, String)> = sqlx::query_as(
        "SELECT server_id, inviter_id FROM invites WHERE code = ?"
    )
    .bind(&code)
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
    
    let (server_id_str, inviter_id) = match invite_row {
        Some(r) => r,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(super::auth::ErrorResponse {
                    code: 404,
                    message: "Invite not found".to_string(),
                }),
            ));
        }
    };
    
    let server_id = Uuid::parse_str(&server_id_str).map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(super::auth::ErrorResponse {
                code: 500,
                message: "Invalid server ID".to_string(),
            }),
        )
    })?;
    
    // Check if inviter or has manage server permission
    let is_inviter = inviter_id == user_id.to_string();
    let has_perm = super::channels::check_permission(
        &state, user_id, server_id, liberty_core::Permissions::MANAGE_SERVER
    ).await?;
    
    if !is_inviter && !has_perm {
        return Err((
            StatusCode::FORBIDDEN,
            Json(super::auth::ErrorResponse {
                code: 403,
                message: "Cannot delete this invite".to_string(),
            }),
        ));
    }
    
    sqlx::query("DELETE FROM invites WHERE code = ?")
        .bind(&code)
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
