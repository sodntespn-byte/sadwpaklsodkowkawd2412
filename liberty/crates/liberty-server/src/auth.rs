//! Authentication utilities

use axum::{
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::Response,
    Extension,
};
use std::sync::Arc;

use crate::state::AppState;
use liberty_core::LibertyError;

/// Authentication middleware
pub async fn auth_middleware(
    Extension(state): Extension<Arc<AppState>>,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Get Authorization header
    let auth_header = request
        .headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok());
    
    let auth_header = match auth_header {
        Some(h) => h,
        None => return Err(StatusCode::UNAUTHORIZED),
    };
    
    // Extract token
    let token = if auth_header.starts_with("Bearer ") {
        &auth_header[7..]
    } else {
        auth_header
    };
    
    // Validate token
    let claims = state.jwt.validate_access_token(token)
        .map_err(|_| StatusCode::UNAUTHORIZED)?;
    
    // Parse user ID
    let user_id = uuid::Uuid::parse_str(&claims.sub)
        .map_err(|_| StatusCode::UNAUTHORIZED)?;
    
    // Add user ID to request extensions
    request.extensions_mut().insert(user_id);
    
    Ok(next.run(request).await)
}

/// Optional authentication - doesn't fail if no token
pub async fn optional_auth_middleware(
    Extension(state): Extension<Arc<AppState>>,
    mut request: Request,
    next: Next,
) -> Response {
    if let Some(auth_header) = request
        .headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
    {
        let token = if auth_header.starts_with("Bearer ") {
            &auth_header[7..]
        } else {
            auth_header
        };
        
        if let Ok(claims) = state.jwt.validate_access_token(token) {
            if let Ok(user_id) = uuid::Uuid::parse_str(&claims.sub) {
                request.extensions_mut().insert(user_id);
            }
        }
    }
    
    next.run(request).await
}

/// Check if user has permission in server
pub fn has_permission(
    permissions: &liberty_core::Permissions,
    required: u64,
) -> bool {
    permissions.has(required)
}
