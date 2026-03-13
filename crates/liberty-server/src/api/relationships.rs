//! Friends/Relationships API

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

/// Relationship types: 1=friend, 2=blocked, 3=pending_incoming, 4=pending_outgoing
#[derive(Debug, Serialize)]
pub struct Relationship {
    pub id: Uuid,
    pub r#type: i32,
    pub user: RelUser,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct RelUser {
    pub id: Uuid,
    pub username: String,
    pub discriminator: String,
    pub avatar: Option<String>,
    pub status: String,
}

#[derive(Debug, Deserialize)]
pub struct AddFriendRequest {
    pub username: String,
    pub discriminator: Option<String>,
}

pub async fn list_relationships(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
) -> Result<Json<Vec<Relationship>>, (StatusCode, Json<super::auth::ErrorResponse>)> {
    let rows = sqlx::query_as::<_, (String, String, String, i32)>(
        r#"
        SELECT r.id, r.target_id, r.created_at, r.type
        FROM relationships r
        WHERE r.user_id = ?
        UNION ALL
        SELECT r.id, r.user_id, r.created_at,
            CASE WHEN r.type = 4 THEN 3 WHEN r.type = 3 THEN 4 ELSE r.type END
        FROM relationships r
        WHERE r.target_id = ? AND r.type IN (1, 3, 4)
        "#
    )
    .bind(user_id.to_string())
    .bind(user_id.to_string())
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(super::auth::ErrorResponse {
        code: 500, message: e.to_string(),
    })))?;

    let mut results = Vec::new();
    for (rel_id, target_id, created_at, rel_type) in rows {
        let user_row = sqlx::query_as::<_, (String, String, String, Option<String>, String)>(
            "SELECT id, username, discriminator, avatar, status FROM users WHERE id = ?"
        )
        .bind(&target_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(super::auth::ErrorResponse {
            code: 500, message: e.to_string(),
        })))?;

        if let Some((uid, uname, disc, avatar, status)) = user_row {
            results.push(Relationship {
                id: Uuid::parse_str(&rel_id).unwrap_or_default(),
                r#type: rel_type,
                user: RelUser {
                    id: Uuid::parse_str(&uid).unwrap_or_default(),
                    username: uname,
                    discriminator: disc,
                    avatar,
                    status,
                },
                created_at,
            });
        }
    }

    Ok(Json(results))
}

pub async fn add_friend(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
    Json(req): Json<AddFriendRequest>,
) -> Result<Json<Relationship>, (StatusCode, Json<super::auth::ErrorResponse>)> {
    let disc = req.discriminator.unwrap_or_default();
    let target = sqlx::query_as::<_, (String, String, String, Option<String>, String)>(
        "SELECT id, username, discriminator, avatar, status FROM users WHERE username = ? AND discriminator = ?"
    )
    .bind(&req.username)
    .bind(&disc)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(super::auth::ErrorResponse {
        code: 500, message: e.to_string(),
    })))?;

    let (target_id_str, uname, target_disc, avatar, status) = match target {
        Some(t) => t,
        None => return Err((StatusCode::NOT_FOUND, Json(super::auth::ErrorResponse {
            code: 404, message: "User not found".to_string(),
        }))),
    };

    let target_id = Uuid::parse_str(&target_id_str).map_err(|_| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(super::auth::ErrorResponse {
            code: 500, message: "Invalid user ID".to_string(),
        }))
    })?;

    if target_id == user_id {
        return Err((StatusCode::BAD_REQUEST, Json(super::auth::ErrorResponse {
            code: 400, message: "Cannot friend yourself".to_string(),
        })));
    }

    let existing = sqlx::query_as::<_, (String, i32)>(
        "SELECT id, type FROM relationships WHERE (user_id = ? AND target_id = ?) OR (user_id = ? AND target_id = ?)"
    )
    .bind(user_id.to_string())
    .bind(target_id.to_string())
    .bind(target_id.to_string())
    .bind(user_id.to_string())
    .fetch_optional(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(super::auth::ErrorResponse {
        code: 500, message: e.to_string(),
    })))?;

    if let Some((existing_id, existing_type)) = existing {
        if existing_type == 1 {
            return Err((StatusCode::BAD_REQUEST, Json(super::auth::ErrorResponse {
                code: 400, message: "Already friends".to_string(),
            })));
        }

        // Accept incoming request (type 3 from their perspective means type 4 in DB)
        if existing_type == 4 || existing_type == 3 {
            sqlx::query("UPDATE relationships SET type = 1 WHERE id = ?")
                .bind(&existing_id)
                .execute(&state.db)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(super::auth::ErrorResponse {
                    code: 500, message: e.to_string(),
                })))?;

            return Ok(Json(Relationship {
                id: Uuid::parse_str(&existing_id).unwrap_or_default(),
                r#type: 1,
                user: RelUser { id: target_id, username: uname, discriminator: target_disc, avatar, status },
                created_at: Utc::now().to_rfc3339(),
            }));
        }
    }

    let rel_id = Uuid::new_v4();
    let now = Utc::now();

    sqlx::query("INSERT INTO relationships (id, user_id, target_id, type, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind(rel_id.to_string())
        .bind(user_id.to_string())
        .bind(target_id.to_string())
        .bind(4) // pending outgoing
        .bind(now.to_rfc3339())
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(super::auth::ErrorResponse {
            code: 500, message: e.to_string(),
        })))?;

    Ok(Json(Relationship {
        id: rel_id,
        r#type: 4,
        user: RelUser { id: target_id, username: uname, discriminator: target_disc, avatar, status },
        created_at: now.to_rfc3339(),
    }))
}

pub async fn accept_friend(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
    Path(rel_id): Path<Uuid>,
) -> Result<Json<Relationship>, (StatusCode, Json<super::auth::ErrorResponse>)> {
    let row = sqlx::query_as::<_, (String, String, i32)>(
        "SELECT user_id, target_id, type FROM relationships WHERE id = ?"
    )
    .bind(rel_id.to_string())
    .fetch_optional(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(super::auth::ErrorResponse {
        code: 500, message: e.to_string(),
    })))?;

    let (from_id, to_id, rel_type) = match row {
        Some(r) => r,
        None => return Err((StatusCode::NOT_FOUND, Json(super::auth::ErrorResponse {
            code: 404, message: "Relationship not found".to_string(),
        }))),
    };

    if to_id != user_id.to_string() || rel_type != 4 {
        return Err((StatusCode::FORBIDDEN, Json(super::auth::ErrorResponse {
            code: 403, message: "Cannot accept this request".to_string(),
        })));
    }

    sqlx::query("UPDATE relationships SET type = 1 WHERE id = ?")
        .bind(rel_id.to_string())
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(super::auth::ErrorResponse {
            code: 500, message: e.to_string(),
        })))?;

    let from_user = sqlx::query_as::<_, (String, String, String, Option<String>, String)>(
        "SELECT id, username, discriminator, avatar, status FROM users WHERE id = ?"
    )
    .bind(&from_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(super::auth::ErrorResponse {
        code: 500, message: e.to_string(),
    })))?;

    Ok(Json(Relationship {
        id: rel_id,
        r#type: 1,
        user: RelUser {
            id: Uuid::parse_str(&from_user.0).unwrap_or_default(),
            username: from_user.1,
            discriminator: from_user.2,
            avatar: from_user.3,
            status: from_user.4,
        },
        created_at: Utc::now().to_rfc3339(),
    }))
}

pub async fn remove_relationship(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
    Path(rel_id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, Json<super::auth::ErrorResponse>)> {
    let row = sqlx::query_as::<_, (String, String)>(
        "SELECT user_id, target_id FROM relationships WHERE id = ?"
    )
    .bind(rel_id.to_string())
    .fetch_optional(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(super::auth::ErrorResponse {
        code: 500, message: e.to_string(),
    })))?;

    let (from_id, to_id) = match row {
        Some(r) => r,
        None => return Err((StatusCode::NOT_FOUND, Json(super::auth::ErrorResponse {
            code: 404, message: "Relationship not found".to_string(),
        }))),
    };

    let uid_str = user_id.to_string();
    if from_id != uid_str && to_id != uid_str {
        return Err((StatusCode::FORBIDDEN, Json(super::auth::ErrorResponse {
            code: 403, message: "Not your relationship".to_string(),
        })));
    }

    sqlx::query("DELETE FROM relationships WHERE id = ?")
        .bind(rel_id.to_string())
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(super::auth::ErrorResponse {
            code: 500, message: e.to_string(),
        })))?;

    Ok(StatusCode::NO_CONTENT)
}
