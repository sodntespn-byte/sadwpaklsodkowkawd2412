//! WebSocket handler for real-time communication

use axum::{
    extract::{
        ws::{Message as WsMessage, WebSocket, WebSocketUpgrade},
        State, Query,
    },
    response::Response,
    Extension,
};
use futures::{SinkExt, StreamExt};
use serde::Deserialize;
use std::sync::Arc;
use std::time::Duration;
use tokio::time::{interval, timeout};
use uuid::Uuid;
use chrono::Utc;

use crate::state::AppState;
use liberty_proto::{ClientMessage, ServerMessage};

/// Query parameters for WebSocket connection
#[derive(Debug, Deserialize)]
pub struct WsQuery {
    token: Option<String>,
}

/// Handle WebSocket upgrade request
pub async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
    Query(query): Query<WsQuery>,
) -> Response {
    ws.on_upgrade(move |socket| handle_socket(socket, state, query.token))
}

/// Handle WebSocket connection
async fn handle_socket(socket: WebSocket, state: Arc<AppState>, token: Option<String>) {
    let (mut sender, mut receiver) = socket.split();
    
    // Send hello message
    let hello = ServerMessage::Hello {
        heartbeat_interval: 45000,
        server_version: state.version.clone(),
    };
    
    let hello_json = serde_json::to_string(&hello).unwrap();
    if sender.send(WsMessage::Text(hello_json)).await.is_err() {
        return;
    }
    
    // Track connection state
    let mut authenticated = false;
    let mut user_id: Option<Uuid> = None;
    let mut session_id = Uuid::new_v4();
    let mut seq: u64 = 0;
    
    // Heartbeat interval
    let mut heartbeat_interval = interval(Duration::from_secs(45));
    
    // Main connection loop
    loop {
        tokio::select! {
            // Handle incoming messages
            Some(msg) = receiver.next() => {
                match msg {
                    Ok(WsMessage::Text(text)) => {
                        match serde_json::from_str::<ClientMessage>(&text) {
                            Ok(client_msg) => {
                                match handle_client_message(
                                    &state,
                                    &client_msg,
                                    &mut authenticated,
                                    &mut user_id,
                                    &mut session_id,
                                    &mut seq,
                                    &mut sender,
                                ).await {
                                    Ok(should_close) => {
                                        if should_close {
                                            break;
                                        }
                                    }
                                    Err(e) => {
                                        tracing::error!("Error handling message: {}", e);
                                        let error_msg = ServerMessage::Error {
                                            code: 500,
                                            message: e.to_string(),
                                        };
                                        let error_json = serde_json::to_string(&error_msg).unwrap();
                                        let _ = sender.send(WsMessage::Text(error_json)).await;
                                    }
                                }
                            }
                            Err(e) => {
                                tracing::warn!("Failed to parse client message: {}", e);
                                let error_msg = ServerMessage::Error {
                                    code: 400,
                                    message: "Invalid message format".to_string(),
                                };
                                let error_json = serde_json::to_string(&error_msg).unwrap();
                                let _ = sender.send(WsMessage::Text(error_json)).await;
                            }
                        }
                    }
                    Ok(WsMessage::Close(_)) => {
                        tracing::info!("Client closed connection");
                        break;
                    }
                    Ok(WsMessage::Ping(data)) => {
                        let _ = sender.send(WsMessage::Pong(data)).await;
                    }
                    Err(e) => {
                        tracing::error!("WebSocket error: {}", e);
                        break;
                    }
                    _ => {}
                }
            }
            
            // Send heartbeat
            _ = heartbeat_interval.tick() => {
                if authenticated {
                    // Check if client is still responsive
                    // In production, track last heartbeat and disconnect if stale
                }
            }
            
            else => break,
        }
    }
    
    // Cleanup on disconnect
    if let Some(uid) = user_id {
        state.clients.remove(&uid);
        state.sessions.remove(&uid);
        
        // Broadcast presence update
        let presence = ServerMessage::PresenceUpdate {
            user_id: uid,
            status: liberty_core::UserStatus::Offline,
            custom_status: None,
        };
        
        // TODO: Broadcast to relevant servers
        
        tracing::info!("User {} disconnected", uid);
    }
}

/// Handle a client message
async fn handle_client_message(
    state: &Arc<AppState>,
    msg: &ClientMessage,
    authenticated: &mut bool,
    user_id: &mut Option<Uuid>,
    session_id: &mut Uuid,
    seq: &mut u64,
    sender: &mut futures::stream::SplitSink<WebSocket, WsMessage>,
) -> anyhow::Result<bool> {
    match msg {
        ClientMessage::Authenticate { token } => {
            // Validate token
            match state.jwt.validate_access_token(token) {
                Ok(claims) => {
                    let uid = Uuid::parse_str(&claims.sub)?;
                    
                    // Check if already connected
                    if state.clients.contains_key(&uid) {
                        let error_msg = ServerMessage::AuthFailed {
                            reason: "Already connected elsewhere".to_string(),
                        };
                        let error_json = serde_json::to_string(&error_msg)?;
                        sender.send(WsMessage::Text(error_json)).await?;
                        return Ok(false);
                    }
                    
                    // Load user from database
                    let user = sqlx::query_as::<_, liberty_core::User>(
                        "SELECT * FROM users WHERE id = ?"
                    )
                    .bind(uid.to_string())
                    .fetch_optional(&state.db)
                    .await?;
                    
                    let user = match user {
                        Some(u) => u,
                        None => {
                            let error_msg = ServerMessage::AuthFailed {
                                reason: "User not found".to_string(),
                            };
                            let error_json = serde_json::to_string(&error_msg)?;
                            sender.send(WsMessage::Text(error_json)).await?;
                            return Ok(false);
                        }
                    };
                    
                    // Load user's servers
                    let servers = sqlx::query_as::<_, liberty_core::Server>(
                        r#"
                        SELECT s.* FROM servers s
                        JOIN server_members sm ON s.id = sm.server_id
                        WHERE sm.user_id = ?
                        "#
                    )
                    .bind(uid.to_string())
                    .fetch_all(&state.db)
                    .await?;
                    
                    // Register client
                    state.clients.insert(uid, crate::state::ConnectedClient {
                        user_id: uid,
                        session_id: *session_id,
                        status: liberty_core::UserStatus::Online,
                        connected_at: Utc::now(),
                        last_heartbeat: Utc::now(),
                        sequence: 0,
                    });
                    
                    state.sessions.insert(*session_id, uid);
                    
                    *authenticated = true;
                    *user_id = Some(uid);
                    
                    // Send authenticated message
                    let auth_msg = ServerMessage::Authenticated {
                        user,
                        servers,
                        session_id: *session_id,
                    };
                    let auth_json = serde_json::to_string(&auth_msg)?;
                    sender.send(WsMessage::Text(auth_json)).await?;
                    
                    tracing::info!("User {} authenticated", uid);
                }
                Err(e) => {
                    let error_msg = ServerMessage::AuthFailed {
                        reason: e.to_string(),
                    };
                    let error_json = serde_json::to_string(&error_msg)?;
                    sender.send(WsMessage::Text(error_json)).await?;
                }
            }
        }
        
        ClientMessage::Heartbeat { seq: client_seq } => {
            *seq = client_seq + 1;
            
            let ack = ServerMessage::HeartbeatAck { seq: *seq };
            let ack_json = serde_json::to_string(&ack)?;
            sender.send(WsMessage::Text(ack_json)).await?;
            
            // Update last heartbeat
            if let Some(uid) = user_id {
                if let Some(mut client) = state.clients.get_mut(uid) {
                    client.last_heartbeat = Utc::now();
                    client.sequence = *client_seq;
                }
            }
        }
        
        ClientMessage::SendMessage { channel_id, content, tts, embeds } => {
            if !*authenticated {
                let error_msg = ServerMessage::Error {
                    code: 401,
                    message: "Not authenticated".to_string(),
                };
                let error_json = serde_json::to_string(&error_msg)?;
                sender.send(WsMessage::Text(error_json)).await?;
                return Ok(false);
            }
            
            let uid = user_id.unwrap();
            
            // Create message
            let message_id = Uuid::new_v4();
            let now = Utc::now();
            
            sqlx::query(
                r#"
                INSERT INTO messages (id, channel_id, author_id, content, tts, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                "#
            )
            .bind(message_id.to_string())
            .bind(channel_id.to_string())
            .bind(uid.to_string())
            .bind(content)
            .bind(*tts as i32)
            .bind(now.to_rfc3339())
            .execute(&state.db)
            .await?;
            
            // Create message object
            let message = liberty_core::Message {
                id: message_id,
                channel_id: *channel_id,
                author_id: uid,
                content: content.clone(),
                edited_timestamp: None,
                tts: *tts,
                mention_everyone: false,
                mentions: vec![],
                mention_roles: vec![],
                attachments: vec![],
                embeds: embeds.clone(),
                reactions: vec![],
                pinned: false,
                created_at: now,
            };
            
            // Broadcast to channel subscribers
            let msg_update = ServerMessage::MessageCreated { message };
            let msg_json = serde_json::to_string(&msg_update)?;
            sender.send(WsMessage::Text(msg_json)).await?;
        }
        
        ClientMessage::UpdatePresence { status, custom_status } => {
            if !*authenticated {
                return Ok(false);
            }
            
            let uid = user_id.unwrap();
            
            // Update in database
            sqlx::query(
                "UPDATE users SET status = ?, custom_status = ? WHERE id = ?"
            )
            .bind(serde_json::to_string(status)?)
            .bind(custom_status)
            .bind(uid.to_string())
            .execute(&state.db)
            .await?;
            
            // Update client state
            if let Some(mut client) = state.clients.get_mut(&uid) {
                client.status = status.clone();
            }
            
            // Broadcast presence update
            let presence_msg = ServerMessage::PresenceUpdate {
                user_id: uid,
                status: status.clone(),
                custom_status: custom_status.clone(),
            };
            let presence_json = serde_json::to_string(&presence_msg)?;
            sender.send(WsMessage::Text(presence_json)).await?;
        }
        
        ClientMessage::StartTyping { channel_id } => {
            if !*authenticated {
                return Ok(false);
            }
            
            let uid = user_id.unwrap();
            state.add_typing(*channel_id, uid);
            
            // Broadcast typing indicator
            let typing_msg = ServerMessage::TypingStarted {
                channel_id: *channel_id,
                user_id: uid,
                timestamp: Utc::now(),
            };
            let typing_json = serde_json::to_string(&typing_msg)?;
            sender.send(WsMessage::Text(typing_json)).await?;
        }
        
        _ => {
            // Handle other messages
            tracing::debug!("Unhandled message type: {:?}", msg);
        }
    }
    
    Ok(false)
}
