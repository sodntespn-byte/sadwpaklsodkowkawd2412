//! Role API endpoints

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
use liberty_core::{Role, Permissions};

/// Create role request
#[derive(Debug, Deserialize)]
pub struct CreateRoleRequest {
    pub name: String,
    pub permissions: u64,
    pub color: Option<i32>,
    pub hoist: Option<bool>,
    pub mentionable: Option<bool>,
}

/// Update role request
#[derive(Debug, Deserialize)]
pub struct UpdateRoleRequest {
    pub name: Option<String>,
    pub permissions: Option<u64>,
    pub color: Option<i32>,
    pub position: Option<i32>,
    pub hoist: Option<bool>,
    pub mentionable: Option<bool>,
}

/// List roles in a server
pub async fn list_roles(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
    Path(server_id): Path<Uuid>,
) -> Result<Json<Vec<Role>>, (StatusCode, Json<super::auth::ErrorResponse>)> {
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
    
    let rows = sqlx::query_as::<_, (String, String, String, i32, i32, i32, i64, i32, i32, String)>(
        "SELECT id, server_id, name, color, hoist, position, permissions, managed, mentionable, created_at FROM roles WHERE server_id = ? ORDER BY position DESC"
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
    
    let roles = rows.into_iter().map(|r| Role {
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
    
    Ok(Json(roles))
}

/// Create a role
pub async fn create_role(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
    Path(server_id): Path<Uuid>,
    Json(req): Json<CreateRoleRequest>,
) -> Result<Json<Role>, (StatusCode, Json<super::auth::ErrorResponse>)> {
    // Check permission
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
    
    let role_id = Uuid::new_v4();
    let now = Utc::now();
    
    // Get next position
    let pos: i32 = sqlx::query_as::<_, (i32,)>(
        "SELECT COALESCE(MAX(position), 0) + 1 FROM roles WHERE server_id = ?"
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
    
    sqlx::query(
        r#"
        INSERT INTO roles (id, server_id, name, color, hoist, position, permissions, mentionable, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(role_id.to_string())
    .bind(server_id.to_string())
    .bind(&req.name)
    .bind(req.color.unwrap_or(0))
    .bind(req.hoist.unwrap_or(false) as i32)
    .bind(pos)
    .bind(req.permissions as i64)
    .bind(req.mentionable.unwrap_or(false) as i32)
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
    
    Ok(Json(Role {
        id: role_id,
        server_id,
        name: req.name,
        color: req.color.unwrap_or(0),
        hoist: req.hoist.unwrap_or(false),
        position: pos,
        permissions: Permissions { value: req.permissions },
        managed: false,
        mentionable: req.mentionable.unwrap_or(false),
        created_at: now,
    }))
}

/// Update a role
pub async fn update_role(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
    Path((server_id, role_id)): Path<(Uuid, Uuid)>,
    Json(req): Json<UpdateRoleRequest>,
) -> Result<Json<Role>, (StatusCode, Json<super::auth::ErrorResponse>)> {
    // Check permission
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
    
    // Check if role exists
    let existing: Option<(i32,)> = sqlx::query_as(
        "SELECT position FROM roles WHERE id = ? AND server_id = ?"
    )
    .bind(role_id.to_string())
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
    
    if existing.is_none() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(super::auth::ErrorResponse {
                code: 404,
                message: "Role not found".to_string(),
            }),
        ));
    }
    
    // Build update
    let mut updates = vec![];
    let mut params: Vec<String> = vec![];
    
    if let Some(name) = &req.name {
        updates.push("name = ?");
        params.push(name.clone());
    }
    if let Some(permissions) = req.permissions {
        updates.push("permissions = ?");
        params.push(permissions.to_string());
    }
    if let Some(color) = req.color {
        updates.push("color = ?");
        params.push(color.to_string());
    }
    if let Some(position) = req.position {
        updates.push("position = ?");
        params.push(position.to_string());
    }
    if let Some(hoist) = req.hoist {
        updates.push("hoist = ?");
        params.push((hoist as i32).to_string());
    }
    if let Some(mentionable) = req.mentionable {
        updates.push("mentionable = ?");
        params.push((mentionable as i32).to_string());
    }
    
    if !updates.is_empty() {
        let query = format!("UPDATE roles SET {} WHERE id = ?", updates.join(", "));
        let mut sql_query = sqlx::query(&query);
        for param in params {
            sql_query = sql_query.bind(param);
        }
        sql_query = sql_query.bind(role_id.to_string());
        
        sql_query.execute(&state.db).await.map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(super::auth::ErrorResponse {
                    code: 500,
                    message: e.to_string(),
                }),
            )
        })?;
    }
    
    // Return updated role
    let row = sqlx::query_as::<_, (String, String, String, i32, i32, i32, i64, i32, i32, String)>(
        "SELECT id, server_id, name, color, hoist, position, permissions, managed, mentionable, created_at FROM roles WHERE id = ?"
    )
    .bind(role_id.to_string())
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
    
    Ok(Json(Role {
        id: Uuid::parse_str(&row.0).unwrap(),
        server_id: Uuid::parse_str(&row.1).unwrap(),
        name: row.2,
        color: row.3,
        hoist: row.4 != 0,
        position: row.5,
        permissions: Permissions { value: row.6 as u64 },
        managed: row.7 != 0,
        mentionable: row.8 != 0,
        created_at: chrono::DateTime::parse_from_rfc3339(&row.9).map(|d| d.with_timezone(&Utc)).unwrap(),
    }))
}

/// Delete a role
pub async fn delete_role(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
    Path((server_id, role_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, (StatusCode, Json<super::auth::ErrorResponse>)> {
    // Check permission
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
    
    // Check if role is managed
    let managed: Option<(i32,)> = sqlx::query_as(
        "SELECT managed FROM roles WHERE id = ? AND server_id = ?"
    )
    .bind(role_id.to_string())
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
    
    match managed {
        Some((1,)) => {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(super::auth::ErrorResponse {
                    code: 400,
                    message: "Cannot delete managed role".to_string(),
                }),
            ));
        }
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(super::auth::ErrorResponse {
                    code: 404,
                    message: "Role not found".to_string(),
                }),
            ));
        }
        _ => {}
    }
    
    // Delete role
    sqlx::query("DELETE FROM roles WHERE id = ?")
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
    
    // Remove from members
    sqlx::query("DELETE FROM member_roles WHERE role_id = ?")
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
    
    Ok(StatusCode::NO_CONTENT)
}
