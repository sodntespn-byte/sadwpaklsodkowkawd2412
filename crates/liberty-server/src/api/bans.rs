//! Bans API

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

#[derive(Debug, Serialize)]
pub struct Ban {
    pub user_id: Uuid,
    pub username: String,
    pub reason: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateBanRequest {
    pub reason: Option<String>,
    pub delete_message_days: Option<i32>,
}

pub async fn list_bans(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
    Path(server_id): Path<Uuid>,
) -> Result<Json<Vec<Ban>>, (StatusCode, Json<super::auth::ErrorResponse>)> {
    let has_perm = super::channels::check_permission(
        &state, user_id, server_id, liberty_core::Permissions::BAN_MEMBERS,
    ).await?;

    if !has_perm {
        return Err((StatusCode::FORBIDDEN, Json(super::auth::ErrorResponse {
            code: 403, message: "Missing BAN_MEMBERS permission".to_string(),
        })));
    }

    let rows = sqlx::query_as::<_, (String, Option<String>, String)>(
        r#"
        SELECT b.user_id, b.reason, b.created_at
        FROM bans b WHERE b.server_id = ?
        "#
    )
    .bind(server_id.to_string())
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(super::auth::ErrorResponse {
        code: 500, message: e.to_string(),
    })))?;

    let mut bans = Vec::new();
    for (uid_str, reason, created_at) in rows {
        let username = sqlx::query_as::<_, (String,)>(
            "SELECT username FROM users WHERE id = ?"
        )
        .bind(&uid_str)
        .fetch_optional(&state.db)
        .await
        .ok()
        .flatten()
        .map(|(u,)| u)
        .unwrap_or_else(|| "Unknown".to_string());

        bans.push(Ban {
            user_id: Uuid::parse_str(&uid_str).unwrap_or_default(),
            username,
            reason,
            created_at,
        });
    }

    Ok(Json(bans))
}

pub async fn create_ban(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
    Path((server_id, target_id)): Path<(Uuid, Uuid)>,
    Json(req): Json<CreateBanRequest>,
) -> Result<StatusCode, (StatusCode, Json<super::auth::ErrorResponse>)> {
    let has_perm = super::channels::check_permission(
        &state, user_id, server_id, liberty_core::Permissions::BAN_MEMBERS,
    ).await?;

    if !has_perm {
        return Err((StatusCode::FORBIDDEN, Json(super::auth::ErrorResponse {
            code: 403, message: "Missing BAN_MEMBERS permission".to_string(),
        })));
    }

    if target_id == user_id {
        return Err((StatusCode::BAD_REQUEST, Json(super::auth::ErrorResponse {
            code: 400, message: "Cannot ban yourself".to_string(),
        })));
    }

    let now = Utc::now();

    sqlx::query("DELETE FROM server_members WHERE server_id = ? AND user_id = ?")
        .bind(server_id.to_string())
        .bind(target_id.to_string())
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(super::auth::ErrorResponse {
            code: 500, message: e.to_string(),
        })))?;

    if let Some(days) = req.delete_message_days {
        if days > 0 {
            let cutoff = now - chrono::Duration::days(days as i64);
            sqlx::query(
                r#"
                DELETE FROM messages WHERE author_id = ? AND channel_id IN (
                    SELECT id FROM channels WHERE server_id = ?
                ) AND created_at > ?
                "#
            )
            .bind(target_id.to_string())
            .bind(server_id.to_string())
            .bind(cutoff.to_rfc3339())
            .execute(&state.db)
            .await
            .ok();
        }
    }

    sqlx::query(
        "INSERT OR REPLACE INTO bans (server_id, user_id, reason, created_at) VALUES (?, ?, ?, ?)"
    )
    .bind(server_id.to_string())
    .bind(target_id.to_string())
    .bind(&req.reason)
    .bind(now.to_rfc3339())
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(super::auth::ErrorResponse {
        code: 500, message: e.to_string(),
    })))?;

    let ban_msg = liberty_proto::ServerMessage::MemberBanned {
        server_id,
        user_id: target_id,
        reason: req.reason,
    };
    if let Ok(json) = serde_json::to_string(&ban_msg) {
        state.broadcast_to_server(&server_id, &json).await;
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn remove_ban(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
    Path((server_id, target_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, (StatusCode, Json<super::auth::ErrorResponse>)> {
    let has_perm = super::channels::check_permission(
        &state, user_id, server_id, liberty_core::Permissions::BAN_MEMBERS,
    ).await?;

    if !has_perm {
        return Err((StatusCode::FORBIDDEN, Json(super::auth::ErrorResponse {
            code: 403, message: "Missing BAN_MEMBERS permission".to_string(),
        })));
    }

    sqlx::query("DELETE FROM bans WHERE server_id = ? AND user_id = ?")
        .bind(server_id.to_string())
        .bind(target_id.to_string())
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(super::auth::ErrorResponse {
            code: 500, message: e.to_string(),
        })))?;

    Ok(StatusCode::NO_CONTENT)
}
