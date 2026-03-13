//! User API endpoints

use axum::{
    extract::{State, Path},
    http::StatusCode,
    Json,
    Extension,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::state::AppState;
use liberty_core::User;

/// Get current user
pub async fn get_current_user(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
) -> Result<Json<User>, (StatusCode, Json<super::auth::ErrorResponse>)> {
    let row = sqlx::query_as::<_, (String, String, String, String, Option<String>, Option<String>, Option<String>, String, String, String, i32, i32)>(
        "SELECT id, username, discriminator, email, avatar, banner, bio, status, created_at, updated_at, verified, mfa_enabled FROM users WHERE id = ?"
    )
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
    
    let row = match row {
        Some(r) => r,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(super::auth::ErrorResponse {
                    code: 404,
                    message: "User not found".to_string(),
                }),
            ));
        }
    };
    
    let user = row_to_user(row);
    Ok(Json(user))
}

/// Update current user
#[derive(Debug, Deserialize)]
pub struct UpdateUserRequest {
    pub username: Option<String>,
    pub avatar: Option<String>,
    pub banner: Option<String>,
    pub bio: Option<String>,
}

pub async fn update_current_user(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
    Json(req): Json<UpdateUserRequest>,
) -> Result<Json<User>, (StatusCode, Json<super::auth::ErrorResponse>)> {
    // Build update query dynamically
    let mut updates = vec!["updated_at = ?"];
    let mut params: Vec<String> = vec![chrono::Utc::now().to_rfc3339()];
    
    if let Some(username) = &req.username {
        updates.push("username = ?");
        params.push(username.clone());
    }
    if let Some(avatar) = &req.avatar {
        updates.push("avatar = ?");
        params.push(avatar.clone());
    }
    if let Some(banner) = &req.banner {
        updates.push("banner = ?");
        params.push(banner.clone());
    }
    if let Some(bio) = &req.bio {
        updates.push("bio = ?");
        params.push(bio.clone());
    }
    
    let query = format!(
        "UPDATE users SET {} WHERE id = ?",
        updates.join(", ")
    );
    
    let mut sql_query = sqlx::query(&query);
    for param in params {
        sql_query = sql_query.bind(param);
    }
    sql_query = sql_query.bind(user_id.to_string());
    
    sql_query.execute(&state.db).await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(super::auth::ErrorResponse {
                code: 500,
                message: e.to_string(),
            }),
        )
    })?;
    
    // Return updated user
    get_current_user(State(state), Extension(user_id)).await
}

/// Get user by ID
pub async fn get_user(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<User>, (StatusCode, Json<super::auth::ErrorResponse>)> {
    let row = sqlx::query_as::<_, (String, String, String, String, Option<String>, Option<String>, Option<String>, String, String, String, i32, i32)>(
        "SELECT id, username, discriminator, email, avatar, banner, bio, status, created_at, updated_at, verified, mfa_enabled FROM users WHERE id = ?"
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
                    message: "User not found".to_string(),
                }),
            ));
        }
    };
    
    let user = row_to_user(row);
    Ok(Json(user))
}

/// Update user (admin only — admin role not yet implemented)
pub async fn update_user(
    State(_state): State<Arc<AppState>>,
    Path(_id): Path<Uuid>,
    Json(_req): Json<UpdateUserRequest>,
) -> Result<Json<User>, (StatusCode, Json<super::auth::ErrorResponse>)> {
    Err((
        StatusCode::FORBIDDEN,
        Json(super::auth::ErrorResponse {
            code: 403,
            message: "Admin access required".to_string(),
        }),
    ))
}

/// Convert database row to User
fn row_to_user(row: (String, String, String, String, Option<String>, Option<String>, Option<String>, String, String, String, i32, i32)) -> User {
    let (id, username, discriminator, email, avatar, banner, bio, status, created_at, updated_at, verified, mfa_enabled) = row;
    
    User {
        id: Uuid::parse_str(&id).unwrap_or_else(|_| Uuid::nil()),
        username,
        discriminator,
        email,
        avatar,
        banner,
        bio,
        status: serde_json::from_str(&status).unwrap_or(liberty_core::UserStatus::Offline),
        custom_status: None,
        created_at: chrono::DateTime::parse_from_rfc3339(&created_at)
            .map(|d| d.with_timezone(&chrono::Utc))
            .unwrap_or_else(|_| chrono::Utc::now()),
        updated_at: chrono::DateTime::parse_from_rfc3339(&updated_at)
            .map(|d| d.with_timezone(&chrono::Utc))
            .unwrap_or_else(|_| chrono::Utc::now()),
        verified: verified != 0,
        mfa_enabled: mfa_enabled != 0,
    }
}
