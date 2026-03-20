//! Authentication middleware

use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
};
use std::sync::Arc;
use uuid::Uuid;

use crate::state::AppState;

pub async fn auth_middleware(
    State(state): State<Arc<AppState>>,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let auth_header = request
        .headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok());

    let auth_header = match auth_header {
        Some(h) => h,
        None => return Err(StatusCode::UNAUTHORIZED),
    };

    let token = if auth_header.starts_with("Bearer ") {
        &auth_header[7..]
    } else {
        auth_header
    };

    let claims = state
        .jwt
        .validate_access_token(token)
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    let user_id =
        Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;

    request.extensions_mut().insert(user_id);

    Ok(next.run(request).await)
}

pub async fn optional_auth_middleware(
    State(state): State<Arc<AppState>>,
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
            if let Ok(user_id) = Uuid::parse_str(&claims.sub) {
                request.extensions_mut().insert(user_id);
            }
        }
    }

    next.run(request).await
}

/// Rate limit middleware — runs after auth. Returns 429 if user exceeds limit (100 req/min).
pub async fn rate_limit_middleware(
    State(state): State<Arc<AppState>>,
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let user_id = match request.extensions().get::<Uuid>() {
        Some(id) => *id,
        None => return Ok(next.run(request).await),
    };
    if !state.check_and_consume_rate_limit(&user_id, 100) {
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }
    Ok(next.run(request).await)
}
