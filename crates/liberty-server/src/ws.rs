//! WebSocket handler for real-time communication

use axum::{
    extract::{
        ws::{Message as WsMessage, WebSocket, WebSocketUpgrade},
        State, Query,
    },
    response::Response,
};
use futures::{SinkExt, StreamExt};
use serde::Deserialize;
use std::sync::Arc;
use std::time::Duration;
use tokio::time::interval;
use uuid::Uuid;
use chrono::Utc;

use crate::state::AppState;
use liberty_proto::{ClientMessage, ServerMessage};

#[derive(Debug, Deserialize)]
pub struct WsQuery {
    token: Option<String>,
}

pub async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
    Query(query): Query<WsQuery>,
) -> Response {
    ws.on_upgrade(move |socket| handle_socket(socket, state, query.token))
}

async fn handle_socket(socket: WebSocket, state: Arc<AppState>, _token: Option<String>) {
    let (mut sender, mut receiver) = socket.split();
    let (tx, mut rx) = tokio::sync::mpsc::channel::<String>(256);

    let hello = ServerMessage::Hello {
        heartbeat_interval: 45000,
        server_version: state.version.clone(),
    };
    if sender.send(WsMessage::Text(serde_json::to_string(&hello).unwrap())).await.is_err() {
        return;
    }

    let mut authenticated = false;
    let mut user_id: Option<Uuid> = None;
    let mut session_id = Uuid::new_v4();
    let mut seq: u64 = 0;
    let mut heartbeat_interval = interval(Duration::from_secs(45));

    loop {
        tokio::select! {
            Some(outbound) = rx.recv() => {
                if sender.send(WsMessage::Text(outbound)).await.is_err() { break; }
            }
            Some(msg) = receiver.next() => {
                match msg {
                    Ok(WsMessage::Text(text)) => {
                        match serde_json::from_str::<ClientMessage>(&text) {
                            Ok(client_msg) => {
                                match handle_client_message(
                                    &state, &client_msg, &mut authenticated, &mut user_id,
                                    &mut session_id, &mut seq, &mut sender, tx.clone(),
                                ).await {
                                    Ok(should_close) => { if should_close { break; } }
                                    Err(e) => {
                                        tracing::error!("Error: {}", e);
                                        let em = ServerMessage::Error { code: 500, message: e.to_string() };
                                        let _ = sender.send(WsMessage::Text(serde_json::to_string(&em).unwrap())).await;
                                    }
                                }
                            }
                            Err(e) => {
                                let em = ServerMessage::Error { code: 400, message: format!("Invalid format: {}", e) };
                                let _ = sender.send(WsMessage::Text(serde_json::to_string(&em).unwrap())).await;
                            }
                        }
                    }
                    Ok(WsMessage::Close(_)) => break,
                    Ok(WsMessage::Ping(data)) => { let _ = sender.send(WsMessage::Pong(data)).await; }
                    Err(_) => break,
                    _ => {}
                }
            }
            _ = heartbeat_interval.tick() => {}
            else => break,
        }
    }

    if let Some(uid) = user_id {
        state.clients.remove(&uid);
        state.sessions.remove(&uid);
        let presence = ServerMessage::PresenceUpdate {
            user_id: uid, status: liberty_core::UserStatus::Offline, custom_status: None,
        };
        if let Ok(json) = serde_json::to_string(&presence) {
            broadcast_to_user_servers(&state, &uid, &json).await;
        }
        tracing::info!("User {} disconnected", uid);
    }
}

// ─── DB helpers ──────────────────────────────────────────────────────────────

async fn fetch_user(db: &sqlx::SqlitePool, uid: &Uuid) -> anyhow::Result<Option<liberty_core::User>> {
    let row = sqlx::query_as::<_, (String, String, String, String, String, Option<String>, Option<String>, Option<String>, String, Option<String>, String, String, i32, i32)>(
        "SELECT id, username, discriminator, email, password_hash, avatar, banner, bio, status, custom_status, created_at, updated_at, verified, mfa_enabled FROM users WHERE id = ?"
    ).bind(uid.to_string()).fetch_optional(db).await?;

    Ok(row.map(|r| liberty_core::User {
        id: Uuid::parse_str(&r.0).unwrap(),
        username: r.1, discriminator: r.2, email: r.3,
        avatar: r.5, banner: r.6, bio: r.7,
        status: serde_json::from_str(&r.8).unwrap_or(liberty_core::UserStatus::Offline),
        custom_status: r.9,
        created_at: chrono::DateTime::parse_from_rfc3339(&r.10).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
        updated_at: chrono::DateTime::parse_from_rfc3339(&r.11).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
        verified: r.12 != 0, mfa_enabled: r.13 != 0,
    }))
}

async fn fetch_user_servers(db: &sqlx::SqlitePool, uid: &Uuid) -> anyhow::Result<Vec<liberty_core::Server>> {
    let rows = sqlx::query_as::<_, (String, String, Option<String>, Option<String>, Option<String>, String, String, i32, Option<String>, Option<String>, i32, i32, i32, String, String, Option<i64>)>(
        "SELECT s.id, s.name, s.description, s.icon, s.banner, s.owner_id, s.region, s.afk_timeout, s.afk_channel_id, s.system_channel_id, s.verification_level, s.content_filter, s.notification_level, s.created_at, s.updated_at, s.max_members FROM servers s JOIN server_members sm ON s.id = sm.server_id WHERE sm.user_id = ?"
    ).bind(uid.to_string()).fetch_all(db).await?;

    Ok(rows.into_iter().map(|r| build_server(r)).collect())
}

fn build_server(r: (String, String, Option<String>, Option<String>, Option<String>, String, String, i32, Option<String>, Option<String>, i32, i32, i32, String, String, Option<i64>)) -> liberty_core::Server {
    liberty_core::Server {
        id: Uuid::parse_str(&r.0).unwrap(),
        name: r.1, description: r.2, icon: r.3, banner: r.4,
        owner_id: Uuid::parse_str(&r.5).unwrap(),
        region: r.6, afk_timeout: r.7,
        afk_channel_id: r.8.and_then(|s| Uuid::parse_str(&s).ok()),
        system_channel_id: r.9.and_then(|s| Uuid::parse_str(&s).ok()),
        verification_level: match r.10 { 1 => liberty_core::VerificationLevel::Low, 2 => liberty_core::VerificationLevel::Medium, 3 => liberty_core::VerificationLevel::High, 4 => liberty_core::VerificationLevel::VeryHigh, _ => liberty_core::VerificationLevel::None },
        explicit_content_filter: match r.11 { 1 => liberty_core::ContentFilter::MembersWithoutRoles, 2 => liberty_core::ContentFilter::AllMembers, _ => liberty_core::ContentFilter::Disabled },
        default_message_notifications: match r.12 { 1 => liberty_core::NotificationLevel::OnlyMentions, _ => liberty_core::NotificationLevel::AllMessages },
        created_at: chrono::DateTime::parse_from_rfc3339(&r.13).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
        updated_at: chrono::DateTime::parse_from_rfc3339(&r.14).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
        member_count: 0, max_members: r.15.map(|v| v as u64),
    }
}

async fn fetch_server(db: &sqlx::SqlitePool, server_id: &Uuid) -> anyhow::Result<Option<liberty_core::Server>> {
    let row = sqlx::query_as::<_, (String, String, Option<String>, Option<String>, Option<String>, String, String, i32, Option<String>, Option<String>, i32, i32, i32, String, String, Option<i64>)>(
        "SELECT id, name, description, icon, banner, owner_id, region, afk_timeout, afk_channel_id, system_channel_id, verification_level, content_filter, notification_level, created_at, updated_at, max_members FROM servers WHERE id = ?"
    ).bind(server_id.to_string()).fetch_optional(db).await?;

    Ok(row.map(build_server))
}

async fn fetch_channels(db: &sqlx::SqlitePool, server_id: &Uuid) -> anyhow::Result<Vec<liberty_core::Channel>> {
    let rows = sqlx::query_as::<_, (String, Option<String>, Option<String>, String, String, i32, Option<String>, i32, Option<i32>, Option<i32>, Option<i32>, String, String)>(
        "SELECT id, server_id, parent_id, name, type, position, topic, nsfw, bitrate, user_limit, rate_limit, created_at, updated_at FROM channels WHERE server_id = ? ORDER BY position"
    ).bind(server_id.to_string()).fetch_all(db).await?;

    Ok(rows.into_iter().map(build_channel).collect())
}

fn build_channel(r: (String, Option<String>, Option<String>, String, String, i32, Option<String>, i32, Option<i32>, Option<i32>, Option<i32>, String, String)) -> liberty_core::Channel {
    liberty_core::Channel {
        id: Uuid::parse_str(&r.0).unwrap(),
        server_id: r.1.and_then(|s| Uuid::parse_str(&s).ok()),
        parent_id: r.2.and_then(|s| Uuid::parse_str(&s).ok()),
        name: r.3,
        channel_type: match r.4.as_str() { "voice" => liberty_core::ChannelType::Voice, "category" => liberty_core::ChannelType::Category, "announcement" => liberty_core::ChannelType::Announcement, "stage" => liberty_core::ChannelType::Stage, _ => liberty_core::ChannelType::Text },
        position: r.5, topic: r.6, nsfw: r.7 != 0,
        bitrate: r.8, user_limit: r.9, rate_limit_per_user: r.10,
        created_at: chrono::DateTime::parse_from_rfc3339(&r.11).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
        updated_at: chrono::DateTime::parse_from_rfc3339(&r.12).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
    }
}

async fn fetch_roles(db: &sqlx::SqlitePool, server_id: &Uuid) -> anyhow::Result<Vec<liberty_core::Role>> {
    let rows = sqlx::query_as::<_, (String, String, String, i32, i32, i32, i64, i32, i32, String)>(
        "SELECT id, server_id, name, color, hoist, position, permissions, managed, mentionable, created_at FROM roles WHERE server_id = ? ORDER BY position"
    ).bind(server_id.to_string()).fetch_all(db).await?;

    Ok(rows.into_iter().map(|r| liberty_core::Role {
        id: Uuid::parse_str(&r.0).unwrap(),
        server_id: Uuid::parse_str(&r.1).unwrap(),
        name: r.2, color: r.3, hoist: r.4 != 0, position: r.5,
        permissions: liberty_core::Permissions { value: r.6 as u64 },
        managed: r.7 != 0, mentionable: r.8 != 0,
        created_at: chrono::DateTime::parse_from_rfc3339(&r.9).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
    }).collect())
}

fn build_message(r: (String, String, String, String, Option<String>, i32, i32, i32, String)) -> liberty_core::Message {
    liberty_core::Message {
        id: Uuid::parse_str(&r.0).unwrap(),
        channel_id: Uuid::parse_str(&r.1).unwrap(),
        author_id: Uuid::parse_str(&r.2).unwrap(),
        content: r.3,
        edited_timestamp: r.4.and_then(|s| chrono::DateTime::parse_from_rfc3339(&s).ok().map(|d| d.with_timezone(&Utc))),
        tts: r.5 != 0, mention_everyone: r.6 != 0,
        mentions: vec![], mention_roles: vec![], attachments: vec![], embeds: vec![], reactions: vec![],
        pinned: r.7 != 0,
        created_at: chrono::DateTime::parse_from_rfc3339(&r.8).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
    }
}

// ─── message handling ────────────────────────────────────────────────────────

macro_rules! require_auth {
    ($auth:expr, $sender:expr) => {
        if !*$auth {
            let err = ServerMessage::Error { code: 401, message: "Not authenticated".to_string() };
            let _ = $sender.send(WsMessage::Text(serde_json::to_string(&err).unwrap())).await;
            return Ok(false);
        }
    };
}

async fn handle_client_message(
    state: &Arc<AppState>,
    msg: &ClientMessage,
    authenticated: &mut bool,
    user_id: &mut Option<Uuid>,
    session_id: &mut Uuid,
    seq: &mut u64,
    sender: &mut futures::stream::SplitSink<WebSocket, WsMessage>,
    tx: tokio::sync::mpsc::Sender<String>,
) -> anyhow::Result<bool> {
    match msg {
        ClientMessage::Authenticate { token } => {
            match state.jwt.validate_access_token(token) {
                Ok(claims) => {
                    let uid = Uuid::parse_str(&claims.sub)?;
                    if state.clients.contains_key(&uid) {
                        let m = ServerMessage::AuthFailed { reason: "Already connected".to_string() };
                        sender.send(WsMessage::Text(serde_json::to_string(&m)?)).await?;
                        return Ok(false);
                    }

                    let user = match fetch_user(&state.db, &uid).await? {
                        Some(u) => u,
                        None => {
                            let m = ServerMessage::AuthFailed { reason: "User not found".to_string() };
                            sender.send(WsMessage::Text(serde_json::to_string(&m)?)).await?;
                            return Ok(false);
                        }
                    };

                    let servers = fetch_user_servers(&state.db, &uid).await?;

                    for s in &servers {
                        let members = sqlx::query_scalar::<_, String>(
                            "SELECT user_id FROM server_members WHERE server_id = ?"
                        ).bind(s.id.to_string()).fetch_all(&state.db).await?;
                        let uuids: Vec<Uuid> = members.iter().filter_map(|v| Uuid::parse_str(v).ok()).collect();
                        state.server_members.write().await.insert(s.id, uuids);
                    }

                    state.clients.insert(uid, crate::state::ConnectedClient {
                        user_id: uid, session_id: *session_id,
                        status: liberty_core::UserStatus::Online,
                        connected_at: Utc::now(), last_heartbeat: Utc::now(), sequence: 0,
                        tx: tx.clone(),
                    });
                    state.sessions.insert(*session_id, uid);
                    *authenticated = true;
                    *user_id = Some(uid);

                    let auth_msg = ServerMessage::Authenticated { user, servers, session_id: *session_id };
                    sender.send(WsMessage::Text(serde_json::to_string(&auth_msg)?)).await?;
                    tracing::info!("User {} authenticated", uid);
                }
                Err(e) => {
                    let m = ServerMessage::AuthFailed { reason: e.to_string() };
                    sender.send(WsMessage::Text(serde_json::to_string(&m)?)).await?;
                }
            }
        }

        ClientMessage::Heartbeat { seq: client_seq } => {
            *seq = client_seq + 1;
            let ack = ServerMessage::HeartbeatAck { seq: *seq };
            sender.send(WsMessage::Text(serde_json::to_string(&ack)?)).await?;
            if let Some(uid) = user_id {
                if let Some(mut client) = state.clients.get_mut(uid) {
                    client.last_heartbeat = Utc::now();
                    client.sequence = *client_seq;
                }
            }
        }

        ClientMessage::SendMessage { channel_id, content, tts, embeds } => {
            require_auth!(authenticated, sender);
            let uid = user_id.unwrap();
            let mid = Uuid::new_v4();
            let now = Utc::now();

            sqlx::query("INSERT INTO messages (id, channel_id, author_id, content, tts, created_at) VALUES (?, ?, ?, ?, ?, ?)")
                .bind(mid.to_string()).bind(channel_id.to_string()).bind(uid.to_string())
                .bind(content).bind(*tts as i32).bind(now.to_rfc3339())
                .execute(&state.db).await?;

            let message = liberty_core::Message {
                id: mid, channel_id: *channel_id, author_id: uid, content: content.clone(),
                edited_timestamp: None, tts: *tts, mention_everyone: false,
                mentions: vec![], mention_roles: vec![], attachments: vec![],
                embeds: embeds.clone(), reactions: vec![], pinned: false, created_at: now,
            };
            let json = serde_json::to_string(&ServerMessage::MessageCreated { message })?;
            broadcast_for_channel(state, channel_id, &json).await;
        }

        ClientMessage::EditMessage { channel_id, message_id, content } => {
            require_auth!(authenticated, sender);
            let uid = user_id.unwrap();
            let now = Utc::now();

            let author: Option<(String,)> = sqlx::query_as("SELECT author_id FROM messages WHERE id = ? AND channel_id = ?")
                .bind(message_id.to_string()).bind(channel_id.to_string())
                .fetch_optional(&state.db).await?;

            if let Some((aid,)) = author {
                if aid != uid.to_string() {
                    send_error(sender, 403, "Not your message").await;
                    return Ok(false);
                }
                sqlx::query("UPDATE messages SET content = ?, edited_at = ? WHERE id = ?")
                    .bind(content).bind(now.to_rfc3339()).bind(message_id.to_string())
                    .execute(&state.db).await?;

                let event = ServerMessage::MessageUpdated {
                    channel_id: *channel_id, message_id: *message_id,
                    content: content.clone(), edited_timestamp: now,
                };
                broadcast_for_channel(state, channel_id, &serde_json::to_string(&event)?).await;
            }
        }

        ClientMessage::DeleteMessage { channel_id, message_id } => {
            require_auth!(authenticated, sender);
            let uid = user_id.unwrap();

            let author: Option<(String,)> = sqlx::query_as("SELECT author_id FROM messages WHERE id = ? AND channel_id = ?")
                .bind(message_id.to_string()).bind(channel_id.to_string())
                .fetch_optional(&state.db).await?;

            if let Some((aid,)) = author {
                if aid != uid.to_string() {
                    send_error(sender, 403, "Not your message").await;
                    return Ok(false);
                }
                sqlx::query("DELETE FROM messages WHERE id = ?").bind(message_id.to_string())
                    .execute(&state.db).await?;

                let event = ServerMessage::MessageDeleted { channel_id: *channel_id, message_id: *message_id };
                broadcast_for_channel(state, channel_id, &serde_json::to_string(&event)?).await;
            }
        }

        ClientMessage::StartTyping { channel_id } => {
            require_auth!(authenticated, sender);
            let uid = user_id.unwrap();
            state.add_typing(*channel_id, uid);
            let event = ServerMessage::TypingStarted { channel_id: *channel_id, user_id: uid, timestamp: Utc::now() };
            broadcast_for_channel(state, channel_id, &serde_json::to_string(&event)?).await;
        }

        ClientMessage::UpdatePresence { status, custom_status } => {
            require_auth!(authenticated, sender);
            let uid = user_id.unwrap();
            sqlx::query("UPDATE users SET status = ?, custom_status = ? WHERE id = ?")
                .bind(serde_json::to_string(status)?).bind(custom_status).bind(uid.to_string())
                .execute(&state.db).await?;
            if let Some(mut c) = state.clients.get_mut(&uid) { c.status = status.clone(); }

            let event = ServerMessage::PresenceUpdate { user_id: uid, status: status.clone(), custom_status: custom_status.clone() };
            broadcast_to_user_servers(state, &uid, &serde_json::to_string(&event)?).await;
        }

        ClientMessage::RequestServers => {
            require_auth!(authenticated, sender);
            let uid = user_id.unwrap();
            let servers = fetch_user_servers(&state.db, &uid).await?;
            let msg = ServerMessage::ServerList { servers };
            sender.send(WsMessage::Text(serde_json::to_string(&msg)?)).await?;
        }

        ClientMessage::RequestServer { server_id } => {
            require_auth!(authenticated, sender);
            if let Some(server) = fetch_server(&state.db, server_id).await? {
                let channels = fetch_channels(&state.db, server_id).await?;
                let roles = fetch_roles(&state.db, server_id).await?;

                let member_rows = sqlx::query_as::<_, (String, String, Option<String>, Option<String>, String, i32, i32, i32)>(
                    "SELECT server_id, user_id, nickname, avatar, joined_at, deaf, mute, pending FROM server_members WHERE server_id = ?"
                ).bind(server_id.to_string()).fetch_all(&state.db).await?;

                let members: Vec<liberty_core::ServerMember> = member_rows.into_iter().map(|r| {
                    liberty_core::ServerMember {
                        server_id: Uuid::parse_str(&r.0).unwrap(), user_id: Uuid::parse_str(&r.1).unwrap(),
                        nickname: r.2, avatar: r.3,
                        joined_at: chrono::DateTime::parse_from_rfc3339(&r.4).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
                        premium_since: None, deaf: r.5 != 0, mute: r.6 != 0, roles: vec![], pending: r.7 != 0,
                    }
                }).collect();

                let msg = ServerMessage::ServerInfo { server, channels, members, roles };
                sender.send(WsMessage::Text(serde_json::to_string(&msg)?)).await?;
            }
        }

        ClientMessage::RequestMessages { channel_id, before, limit, .. } => {
            require_auth!(authenticated, sender);
            let lim = limit.unwrap_or(50).min(100) as i32;

            let rows = if let Some(bid) = before {
                sqlx::query_as::<_, (String, String, String, String, Option<String>, i32, i32, i32, String)>(
                    "SELECT id, channel_id, author_id, content, edited_at, tts, mention_everyone, pinned, created_at FROM messages WHERE channel_id = ? AND id < ? ORDER BY created_at DESC LIMIT ?"
                ).bind(channel_id.to_string()).bind(bid.to_string()).bind(lim).fetch_all(&state.db).await?
            } else {
                sqlx::query_as::<_, (String, String, String, String, Option<String>, i32, i32, i32, String)>(
                    "SELECT id, channel_id, author_id, content, edited_at, tts, mention_everyone, pinned, created_at FROM messages WHERE channel_id = ? ORDER BY created_at DESC LIMIT ?"
                ).bind(channel_id.to_string()).bind(lim).fetch_all(&state.db).await?
            };

            let msgs: Vec<_> = rows.into_iter().map(build_message).collect();
            let msg = ServerMessage::MessagesList { channel_id: *channel_id, messages: msgs };
            sender.send(WsMessage::Text(serde_json::to_string(&msg)?)).await?;
        }

        ClientMessage::CreateServer { name, region, icon } => {
            require_auth!(authenticated, sender);
            let uid = user_id.unwrap();
            let sid = Uuid::new_v4();
            let cid = Uuid::new_v4();
            let rid = Uuid::new_v4();
            let now = Utc::now();
            let rgn = region.as_deref().unwrap_or("us-east");

            sqlx::query("INSERT INTO servers (id, name, owner_id, region, icon, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
                .bind(sid.to_string()).bind(name).bind(uid.to_string()).bind(rgn)
                .bind(icon.as_deref()).bind(now.to_rfc3339()).bind(now.to_rfc3339())
                .execute(&state.db).await?;
            sqlx::query("INSERT INTO server_members (server_id, user_id, joined_at) VALUES (?, ?, ?)")
                .bind(sid.to_string()).bind(uid.to_string()).bind(now.to_rfc3339())
                .execute(&state.db).await?;
            sqlx::query("INSERT INTO channels (id, server_id, name, type, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
                .bind(cid.to_string()).bind(sid.to_string()).bind("general").bind("text")
                .bind(0).bind(now.to_rfc3339()).bind(now.to_rfc3339())
                .execute(&state.db).await?;
            sqlx::query("INSERT INTO roles (id, server_id, name, position, permissions, created_at) VALUES (?, ?, ?, ?, ?, ?)")
                .bind(rid.to_string()).bind(sid.to_string()).bind("@everyone").bind(0)
                .bind(104324673_i64).bind(now.to_rfc3339())
                .execute(&state.db).await?;

            state.server_members.write().await.insert(sid, vec![uid]);

            let server = fetch_server(&state.db, &sid).await?.unwrap();
            let channels = fetch_channels(&state.db, &sid).await?;
            let roles = fetch_roles(&state.db, &sid).await?;
            let event = ServerMessage::ServerCreated { server, channels, roles };
            sender.send(WsMessage::Text(serde_json::to_string(&event)?)).await?;
        }

        ClientMessage::JoinServer { invite_code } => {
            require_auth!(authenticated, sender);
            let uid = user_id.unwrap();

            let invite = sqlx::query_as::<_, (String, String, i32, Option<i32>, Option<String>)>(
                "SELECT server_id, channel_id, uses, max_uses, expires_at FROM invites WHERE code = ?"
            ).bind(invite_code).fetch_optional(&state.db).await?;

            if let Some((sid_str, _, uses, max_uses, expires)) = invite {
                if let Some(exp) = expires {
                    if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(&exp) {
                        if dt.with_timezone(&Utc) < Utc::now() {
                            send_error(sender, 404, "Invite expired").await;
                            return Ok(false);
                        }
                    }
                }
                if let Some(mx) = max_uses {
                    if uses >= mx {
                        send_error(sender, 404, "Invite max uses reached").await;
                        return Ok(false);
                    }
                }

                let sid = Uuid::parse_str(&sid_str)?;

                let banned: bool = sqlx::query_as::<_, (String,)>("SELECT user_id FROM bans WHERE server_id = ? AND user_id = ?")
                    .bind(sid.to_string()).bind(uid.to_string())
                    .fetch_optional(&state.db).await?.is_some();
                if banned {
                    send_error(sender, 403, "Banned from this server").await;
                    return Ok(false);
                }

                let already: bool = sqlx::query_as::<_, (String,)>("SELECT user_id FROM server_members WHERE server_id = ? AND user_id = ?")
                    .bind(sid.to_string()).bind(uid.to_string())
                    .fetch_optional(&state.db).await?.is_some();

                if !already {
                    let now = Utc::now();
                    sqlx::query("INSERT INTO server_members (server_id, user_id, joined_at) VALUES (?, ?, ?)")
                        .bind(sid.to_string()).bind(uid.to_string()).bind(now.to_rfc3339())
                        .execute(&state.db).await?;
                    sqlx::query("UPDATE invites SET uses = uses + 1 WHERE code = ?")
                        .bind(invite_code).execute(&state.db).await?;
                    state.server_members.write().await.entry(sid).or_insert_with(Vec::new).push(uid);

                    let member_event = ServerMessage::MemberJoined {
                        member: liberty_core::ServerMember {
                            server_id: sid, user_id: uid, nickname: None, avatar: None,
                            joined_at: now, premium_since: None, deaf: false, mute: false,
                            roles: vec![], pending: false,
                        }
                    };
                    state.broadcast_to_server(&sid, &serde_json::to_string(&member_event)?).await;
                }

                let server = fetch_server(&state.db, &sid).await?.unwrap();
                let channels = fetch_channels(&state.db, &sid).await?;
                let roles = fetch_roles(&state.db, &sid).await?;
                let event = ServerMessage::ServerCreated { server, channels, roles };
                sender.send(WsMessage::Text(serde_json::to_string(&event)?)).await?;
            } else {
                send_error(sender, 404, "Invite not found").await;
            }
        }

        ClientMessage::LeaveServer { server_id } => {
            require_auth!(authenticated, sender);
            let uid = user_id.unwrap();

            let is_owner: bool = sqlx::query_as::<_, (String,)>("SELECT owner_id FROM servers WHERE id = ? AND owner_id = ?")
                .bind(server_id.to_string()).bind(uid.to_string())
                .fetch_optional(&state.db).await?.is_some();

            if is_owner {
                send_error(sender, 400, "Owner cannot leave").await;
                return Ok(false);
            }

            sqlx::query("DELETE FROM server_members WHERE server_id = ? AND user_id = ?")
                .bind(server_id.to_string()).bind(uid.to_string())
                .execute(&state.db).await?;
            state.server_members.write().await.entry(*server_id).and_modify(|l| l.retain(|id| *id != uid));

            let event = ServerMessage::MemberLeft { server_id: *server_id, user_id: uid };
            state.broadcast_to_server(server_id, &serde_json::to_string(&event)?).await;

            let del = ServerMessage::ServerDeleted { server_id: *server_id };
            sender.send(WsMessage::Text(serde_json::to_string(&del)?)).await?;
        }

        ClientMessage::CreateChannel { server_id, name, channel_type, parent_id, topic } => {
            require_auth!(authenticated, sender);
            let cid = Uuid::new_v4();
            let now = Utc::now();
            let ct = serde_json::to_string(channel_type)?.trim_matches('"').to_string();

            sqlx::query("INSERT INTO channels (id, server_id, parent_id, name, type, topic, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
                .bind(cid.to_string()).bind(server_id.to_string())
                .bind(parent_id.map(|p| p.to_string())).bind(name).bind(&ct)
                .bind(topic.as_deref()).bind(now.to_rfc3339()).bind(now.to_rfc3339())
                .execute(&state.db).await?;

            let ch_row = sqlx::query_as::<_, (String, Option<String>, Option<String>, String, String, i32, Option<String>, i32, Option<i32>, Option<i32>, Option<i32>, String, String)>(
                "SELECT id, server_id, parent_id, name, type, position, topic, nsfw, bitrate, user_limit, rate_limit, created_at, updated_at FROM channels WHERE id = ?"
            ).bind(cid.to_string()).fetch_one(&state.db).await?;
            let channel = build_channel(ch_row);

            let event = ServerMessage::ChannelCreated { channel };
            state.broadcast_to_server(server_id, &serde_json::to_string(&event)?).await;
        }

        ClientMessage::UpdateChannel { channel_id, name, topic, position } => {
            require_auth!(authenticated, sender);
            if let Some(n) = name { sqlx::query("UPDATE channels SET name = ? WHERE id = ?").bind(n).bind(channel_id.to_string()).execute(&state.db).await?; }
            if let Some(t) = topic { sqlx::query("UPDATE channels SET topic = ? WHERE id = ?").bind(t).bind(channel_id.to_string()).execute(&state.db).await?; }
            if let Some(p) = position { sqlx::query("UPDATE channels SET position = ? WHERE id = ?").bind(p).bind(channel_id.to_string()).execute(&state.db).await?; }
            sqlx::query("UPDATE channels SET updated_at = ? WHERE id = ?").bind(Utc::now().to_rfc3339()).bind(channel_id.to_string()).execute(&state.db).await?;

            let ch_row = sqlx::query_as::<_, (String, Option<String>, Option<String>, String, String, i32, Option<String>, i32, Option<i32>, Option<i32>, Option<i32>, String, String)>(
                "SELECT id, server_id, parent_id, name, type, position, topic, nsfw, bitrate, user_limit, rate_limit, created_at, updated_at FROM channels WHERE id = ?"
            ).bind(channel_id.to_string()).fetch_one(&state.db).await?;
            let channel = build_channel(ch_row);

            if let Some(sid) = channel.server_id {
                let event = ServerMessage::ChannelUpdated { channel };
                state.broadcast_to_server(&sid, &serde_json::to_string(&event)?).await;
            }
        }

        ClientMessage::DeleteChannel { channel_id } => {
            require_auth!(authenticated, sender);
            let ch: Option<(Option<String>,)> = sqlx::query_as("SELECT server_id FROM channels WHERE id = ?")
                .bind(channel_id.to_string()).fetch_optional(&state.db).await?;
            if let Some((Some(sid_str),)) = ch {
                sqlx::query("DELETE FROM messages WHERE channel_id = ?").bind(channel_id.to_string()).execute(&state.db).await?;
                sqlx::query("DELETE FROM channels WHERE id = ?").bind(channel_id.to_string()).execute(&state.db).await?;
                let sid = Uuid::parse_str(&sid_str)?;
                let event = ServerMessage::ChannelDeleted { server_id: sid, channel_id: *channel_id };
                state.broadcast_to_server(&sid, &serde_json::to_string(&event)?).await;
            }
        }

        ClientMessage::AddReaction { channel_id, message_id, emoji } => {
            require_auth!(authenticated, sender);
            let uid = user_id.unwrap();
            sqlx::query("INSERT OR IGNORE INTO reactions (message_id, emoji_name, user_id) VALUES (?, ?, ?)")
                .bind(message_id.to_string()).bind(&emoji.name).bind(uid.to_string())
                .execute(&state.db).await?;
            let event = ServerMessage::ReactionAdded { channel_id: *channel_id, message_id: *message_id, emoji: emoji.clone(), user_id: uid };
            broadcast_for_channel(state, channel_id, &serde_json::to_string(&event)?).await;
        }

        ClientMessage::RemoveReaction { channel_id, message_id, emoji } => {
            require_auth!(authenticated, sender);
            let uid = user_id.unwrap();
            sqlx::query("DELETE FROM reactions WHERE message_id = ? AND emoji_name = ? AND user_id = ?")
                .bind(message_id.to_string()).bind(&emoji.name).bind(uid.to_string())
                .execute(&state.db).await?;
            let event = ServerMessage::ReactionRemoved { channel_id: *channel_id, message_id: *message_id, emoji: emoji.clone(), user_id: uid };
            broadcast_for_channel(state, channel_id, &serde_json::to_string(&event)?).await;
        }

        ClientMessage::KickMember { server_id, user_id: target_id, .. } => {
            require_auth!(authenticated, sender);
            sqlx::query("DELETE FROM server_members WHERE server_id = ? AND user_id = ?")
                .bind(server_id.to_string()).bind(target_id.to_string())
                .execute(&state.db).await?;
            state.server_members.write().await.entry(*server_id).and_modify(|l| l.retain(|id| id != target_id));
            let event = ServerMessage::MemberLeft { server_id: *server_id, user_id: *target_id };
            state.broadcast_to_server(server_id, &serde_json::to_string(&event)?).await;
        }

        ClientMessage::BanMember { server_id, user_id: target_id, reason, .. } => {
            require_auth!(authenticated, sender);
            let now = Utc::now();
            sqlx::query("DELETE FROM server_members WHERE server_id = ? AND user_id = ?")
                .bind(server_id.to_string()).bind(target_id.to_string())
                .execute(&state.db).await?;
            sqlx::query("INSERT OR REPLACE INTO bans (server_id, user_id, reason, created_at) VALUES (?, ?, ?, ?)")
                .bind(server_id.to_string()).bind(target_id.to_string())
                .bind(reason.as_deref()).bind(now.to_rfc3339())
                .execute(&state.db).await?;
            state.server_members.write().await.entry(*server_id).and_modify(|l| l.retain(|id| id != target_id));
            let event = ServerMessage::MemberBanned { server_id: *server_id, user_id: *target_id, reason: reason.clone() };
            state.broadcast_to_server(server_id, &serde_json::to_string(&event)?).await;
        }

        ClientMessage::RequestUser { user_id: target_id } => {
            require_auth!(authenticated, sender);
            if let Some(user) = fetch_user(&state.db, target_id).await? {
                let msg = ServerMessage::UserInfo { user };
                sender.send(WsMessage::Text(serde_json::to_string(&msg)?)).await?;
            }
        }

        _ => {
            tracing::debug!("Unhandled: {:?}", msg);
        }
    }

    Ok(false)
}

async fn send_error(sender: &mut futures::stream::SplitSink<WebSocket, WsMessage>, code: i32, message: &str) {
    let err = ServerMessage::Error { code, message: message.to_string() };
    let _ = sender.send(WsMessage::Text(serde_json::to_string(&err).unwrap())).await;
}

async fn broadcast_for_channel(state: &Arc<AppState>, channel_id: &Uuid, json: &str) {
    let server_id_row = sqlx::query_scalar::<_, Option<String>>(
        "SELECT server_id FROM channels WHERE id = ?"
    ).bind(channel_id.to_string()).fetch_optional(&state.db).await.ok().flatten();

    if let Some(Some(sid_str)) = server_id_row {
        if let Ok(sid) = Uuid::parse_str(&sid_str) {
            state.broadcast_to_server(&sid, json).await;
            return;
        }
    }

    let recipients = sqlx::query_scalar::<_, String>(
        "SELECT user_id FROM dm_recipients WHERE channel_id = ?"
    ).bind(channel_id.to_string()).fetch_all(&state.db).await.unwrap_or_default();

    let uids: Vec<Uuid> = recipients.iter().filter_map(|s| Uuid::parse_str(s).ok()).collect();
    state.broadcast_to(&uids, json).await;
}

async fn broadcast_to_user_servers(state: &Arc<AppState>, uid: &Uuid, json: &str) {
    let sids = sqlx::query_scalar::<_, String>(
        "SELECT server_id FROM server_members WHERE user_id = ?"
    ).bind(uid.to_string()).fetch_all(&state.db).await.unwrap_or_default();
    for sid_str in sids {
        if let Ok(sid) = Uuid::parse_str(&sid_str) {
            state.broadcast_to_server(&sid, json).await;
        }
    }
}
