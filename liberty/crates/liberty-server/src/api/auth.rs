//! Authentication API endpoints

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
use liberty_core::{User, UserStatus, LibertyError};
use liberty_crypto::{hash_password, verify_password};

/// Register request
#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    pub email: String,
    pub password: String,
}

/// Login request
#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

/// Auth response
#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub user: User,
    pub access_token: String,
    pub refresh_token: String,
    pub token_type: String,
    pub expires_in: u64,
}

/// Refresh request
#[derive(Debug, Deserialize)]
pub struct RefreshRequest {
    pub refresh_token: String,
}

/// Register new user
pub async fn register(
    State(state): State<Arc<AppState>>,
    Json(req): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, Json<ErrorResponse>)> {
    // Validate username
    if req.username.len() < 3 || req.username.len() > 32 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                code: 400,
                message: "Username must be between 3 and 32 characters".to_string(),
            }),
        ));
    }
    
    // Validate password
    if req.password.len() < 8 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                code: 400,
                message: "Password must be at least 8 characters".to_string(),
            }),
        ));
    }
    
    // Check if email exists
    let existing = sqlx::query("SELECT id FROM users WHERE email = ?")
        .bind(&req.email)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    code: 500,
                    message: e.to_string(),
                }),
            )
        })?;
    
    if existing.is_some() {
        return Err((
            StatusCode::CONFLICT,
            Json(ErrorResponse {
                code: 409,
                message: "Email already registered".to_string(),
            }),
        ));
    }
    
    // Check if username exists and generate discriminator
    let mut discriminator = String::new();
    for _ in 0..100 {
        let disc: String = format!("{:04}", rand::random::<u16>() % 10000);
        let exists = sqlx::query("SELECT id FROM users WHERE username = ? AND discriminator = ?")
            .bind(&req.username)
            .bind(&disc)
            .fetch_optional(&state.db)
            .await
            .map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ErrorResponse {
                        code: 500,
                        message: e.to_string(),
                    }),
                )
            })?;
        
        if exists.is_none() {
            discriminator = disc;
            break;
        }
    }
    
    if discriminator.is_empty() {
        return Err((
            StatusCode::CONFLICT,
            Json(ErrorResponse {
                code: 409,
                message: "Username is too popular. Try another name.".to_string(),
            }),
        ));
    }
    
    // Hash password
    let password_hash = hash_password(&req.password).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                code: 500,
                message: e.to_string(),
            }),
        )
    })?;
    
    // Create user
    let user_id = Uuid::new_v4();
    let now = Utc::now();
    
    sqlx::query(
        r#"
        INSERT INTO users (id, username, discriminator, email, password_hash, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(user_id.to_string())
    .bind(&req.username)
    .bind(&discriminator)
    .bind(&req.email)
    .bind(&password_hash)
    .bind("offline")
    .bind(now.to_rfc3339())
    .bind(now.to_rfc3339())
    .execute(&state.db)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                code: 500,
                message: e.to_string(),
            }),
        )
    })?;
    
    // Create user object
    let user = User {
        id: user_id,
        username: req.username,
        discriminator,
        email: req.email,
        avatar: None,
        banner: None,
        bio: None,
        status: UserStatus::Offline,
        custom_status: None,
        created_at: now,
        updated_at: now,
        verified: false,
        mfa_enabled: false,
    };
    
    // Generate tokens
    let access_token = state.jwt.generate_access_token(user_id, vec!["user".to_string()])
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    code: 500,
                    message: e.to_string(),
                }),
            )
        })?;
    
    let refresh_token = state.jwt.generate_refresh_token(user_id, vec!["user".to_string()])
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    code: 500,
                    message: e.to_string(),
                }),
            )
        })?;
    
    Ok(Json(AuthResponse {
        user,
        access_token,
        refresh_token,
        token_type: "Bearer".to_string(),
        expires_in: 3600,
    }))
}

/// Login
pub async fn login(
    State(state): State<Arc<AppState>>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, Json<ErrorResponse>)> {
    // Get user by email
    let row = sqlx::query_as::<_, (String, String, String, String, String, Option<String>, Option<String>, Option<String>, String, String, String, i32, i32)>(
        "SELECT id, username, discriminator, email, password_hash, avatar, banner, bio, status, created_at, updated_at, verified, mfa_enabled FROM users WHERE email = ?"
    )
    .bind(&req.email)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                code: 500,
                message: e.to_string(),
            }),
        )
    })?;
    
    let row = match row {
        Some(r) => r,
        None => {
            return Err((
                StatusCode::UNAUTHORIZED,
                Json(ErrorResponse {
                    code: 401,
                    message: "Invalid email or password".to_string(),
                }),
            ));
        }
    };
    
    let (id, username, discriminator, email, password_hash, avatar, banner, bio, status, created_at, updated_at, verified, mfa_enabled) = row;
    
    // Verify password
    let valid = verify_password(&req.password, &password_hash).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                code: 500,
                message: e.to_string(),
            }),
        )
    })?;
    
    if !valid {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(ErrorResponse {
                code: 401,
                message: "Invalid email or password".to_string(),
            }),
        ));
    }
    
    let user_id = Uuid::parse_str(&id).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                code: 500,
                message: e.to_string(),
            }),
        )
    })?;
    
    let user = User {
        id: user_id,
        username,
        discriminator,
        email,
        avatar,
        banner,
        bio,
        status: serde_json::from_str(&status).unwrap_or(UserStatus::Offline),
        custom_status: None,
        created_at: chrono::DateTime::parse_from_rfc3339(&created_at)
            .map(|d| d.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
        updated_at: chrono::DateTime::parse_from_rfc3339(&updated_at)
            .map(|d| d.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
        verified: verified != 0,
        mfa_enabled: mfa_enabled != 0,
    };
    
    // Generate tokens
    let access_token = state.jwt.generate_access_token(user_id, vec!["user".to_string()])
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    code: 500,
                    message: e.to_string(),
                }),
            )
        })?;
    
    let refresh_token = state.jwt.generate_refresh_token(user_id, vec!["user".to_string()])
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    code: 500,
                    message: e.to_string(),
                }),
            )
        })?;
    
    Ok(Json(AuthResponse {
        user,
        access_token,
        refresh_token,
        token_type: "Bearer".to_string(),
        expires_in: 3600,
    }))
}

/// Logout
pub async fn logout() -> &'static str {
    "OK"
}

/// Refresh token
pub async fn refresh(
    State(state): State<Arc<AppState>>,
    Json(req): Json<RefreshRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, Json<ErrorResponse>)> {
    let claims = state.jwt.validate_refresh_token(&req.refresh_token)
        .map_err(|e| {
            (
                StatusCode::UNAUTHORIZED,
                Json(ErrorResponse {
                    code: 401,
                    message: e.to_string(),
                }),
            )
        })?;
    
    let user_id = Uuid::parse_str(&claims.sub).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                code: 500,
                message: e.to_string(),
            }),
        )
    })?;
    
    // Get user
    let row = sqlx::query_as::<_, (String, String, String, String, Option<String>, Option<String>, Option<String>, String, String, String, i32, i32)>(
        "SELECT id, username, discriminator, email, avatar, banner, bio, status, created_at, updated_at, verified, mfa_enabled FROM users WHERE id = ?"
    )
    .bind(user_id.to_string())
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
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
                Json(ErrorResponse {
                    code: 404,
                    message: "User not found".to_string(),
                }),
            ));
        }
    };
    
    let (id, username, discriminator, email, avatar, banner, bio, status, created_at, updated_at, verified, mfa_enabled) = row;
    
    let user = User {
        id: user_id,
        username,
        discriminator,
        email,
        avatar,
        banner,
        bio,
        status: serde_json::from_str(&status).unwrap_or(UserStatus::Offline),
        custom_status: None,
        created_at: chrono::DateTime::parse_from_rfc3339(&created_at)
            .map(|d| d.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
        updated_at: chrono::DateTime::parse_from_rfc3339(&updated_at)
            .map(|d| d.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
        verified: verified != 0,
        mfa_enabled: mfa_enabled != 0,
    };
    
    let access_token = state.jwt.generate_access_token(user_id, claims.roles.clone())
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    code: 500,
                    message: e.to_string(),
                }),
            )
        })?;
    
    let refresh_token = state.jwt.generate_refresh_token(user_id, claims.roles)
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    code: 500,
                    message: e.to_string(),
                }),
            )
        })?;
    
    Ok(Json(AuthResponse {
        user,
        access_token,
        refresh_token,
        token_type: "Bearer".to_string(),
        expires_in: 3600,
    }))
}

/// Verify email
pub async fn verify() -> &'static str {
    "OK"
}

/// Error response
#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub code: i32,
    pub message: String,
}
