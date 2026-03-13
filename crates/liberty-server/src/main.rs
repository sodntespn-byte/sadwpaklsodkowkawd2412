//! LIBERTY Server - Main entry point

mod state;
mod ws;
mod api;
mod db;
mod auth;

use axum::{
    middleware,
    routing::{get, post, put, patch, delete},
    Router,
};
use tower_http::{
    cors::CorsLayer,
    trace::TraceLayer,
    services::ServeDir,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use std::net::SocketAddr;
use std::sync::Arc;

use state::AppState;

const VERSION: &str = env!("CARGO_PKG_VERSION");

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "liberty=debug,tower_http=debug".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("LIBERTY Server v{} starting...", VERSION);

    let db = db::init_database().await?;
    tracing::info!("Database initialized");

    let state = Arc::new(AppState::new(db));

    // Public routes (no auth required)
    let public_routes = Router::new()
        .route("/auth/register", post(api::auth::register))
        .route("/auth/login", post(api::auth::login))
        .route("/auth/refresh", post(api::auth::refresh))
        .route("/auth/verify", post(api::auth::verify))
        .route("/invites/{code}", get(api::invites::get_invite))
        .with_state(state.clone());

    // Protected routes (auth middleware applied)
    let protected_routes = Router::new()
        // Auth
        .route("/auth/logout", post(api::auth::logout))

        // Users
        .route("/users/@me", get(api::users::get_current_user))
        .route("/users/@me", patch(api::users::update_current_user))
        .route("/users/{id}", get(api::users::get_user))
        .route("/users/{id}", patch(api::users::update_user))

        // DMs
        .route("/users/@me/channels", get(api::dms::list_dm_channels))
        .route("/users/@me/channels", post(api::dms::create_dm_channel))

        // Relationships / Friends
        .route("/users/@me/relationships", get(api::relationships::list_relationships))
        .route("/users/@me/relationships", post(api::relationships::add_friend))
        .route("/users/@me/relationships/{id}", put(api::relationships::accept_friend))
        .route("/users/@me/relationships/{id}", delete(api::relationships::remove_relationship))

        // Servers
        .route("/servers", get(api::servers::list_servers))
        .route("/servers", post(api::servers::create_server))
        .route("/servers/{id}", get(api::servers::get_server))
        .route("/servers/{id}", patch(api::servers::update_server))
        .route("/servers/{id}", delete(api::servers::delete_server))

        // Channels
        .route("/servers/{server_id}/channels", get(api::channels::list_channels))
        .route("/servers/{server_id}/channels", post(api::channels::create_channel))
        .route("/channels/{id}", get(api::channels::get_channel))
        .route("/channels/{id}", patch(api::channels::update_channel))
        .route("/channels/{id}", delete(api::channels::delete_channel))

        // Messages
        .route("/channels/{id}/messages", get(api::messages::list_messages))
        .route("/channels/{id}/messages", post(api::messages::create_message))
        .route("/channels/{channel_id}/messages/{message_id}", get(api::messages::get_message))
        .route("/channels/{channel_id}/messages/{message_id}", patch(api::messages::update_message))
        .route("/channels/{channel_id}/messages/{message_id}", delete(api::messages::delete_message))

        // Pins
        .route("/channels/{id}/pins", get(api::messages::list_pins))
        .route("/channels/{channel_id}/pins/{message_id}", put(api::messages::pin_message))
        .route("/channels/{channel_id}/pins/{message_id}", delete(api::messages::unpin_message))

        // Members
        .route("/servers/{id}/members", get(api::members::list_members))
        .route("/servers/{id}/members/{user_id}", get(api::members::get_member))
        .route("/servers/{id}/members/{user_id}", patch(api::members::update_member))
        .route("/servers/{id}/members/{user_id}", delete(api::members::remove_member))

        // Invites
        .route("/channels/{channel_id}/invites", post(api::invites::create_invite))
        .route("/invites/{code}", delete(api::invites::delete_invite))

        // Bans
        .route("/servers/{id}/bans", get(api::bans::list_bans))
        .route("/servers/{id}/bans/{user_id}", put(api::bans::create_ban))
        .route("/servers/{id}/bans/{user_id}", delete(api::bans::remove_ban))

        // Reactions
        .route("/channels/{id}/messages/{message_id}/reactions/{emoji}/@me", put(api::reactions::add_reaction))
        .route("/channels/{id}/messages/{message_id}/reactions/{emoji}/@me", delete(api::reactions::remove_reaction))
        .route("/channels/{id}/messages/{message_id}/reactions/{emoji}", get(api::reactions::get_reactions))

        // Roles
        .route("/servers/{id}/roles", get(api::roles::list_roles))
        .route("/servers/{id}/roles", post(api::roles::create_role))
        .route("/servers/{id}/roles/{role_id}", patch(api::roles::update_role))
        .route("/servers/{id}/roles/{role_id}", delete(api::roles::delete_role))

        .layer(middleware::from_fn_with_state(state.clone(), auth::rate_limit_middleware))
        .layer(middleware::from_fn_with_state(state.clone(), auth::auth_middleware))
        .with_state(state.clone());

    let api_routes = Router::new()
        .merge(public_routes)
        .merge(protected_routes);

    let app = Router::new()
        .route("/ws", get(ws::websocket_handler))
        .route("/health", get(health_check))
        .nest("/api/v1", api_routes)
        .fallback_service(ServeDir::new("static"))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 8443));
    tracing::info!("Server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn health_check() -> &'static str {
    "OK"
}
