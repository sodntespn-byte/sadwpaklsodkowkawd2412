//! Event types for real-time notifications

use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

/// Event types dispatched to clients
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "t", content = "d")]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Event {
    /// Server ready
    Ready {
        session_id: Uuid,
        user: liberty_core::User,
    },
    
    /// Message received
    MessageCreate {
        message: liberty_core::Message,
    },
    
    /// Message updated
    MessageUpdate {
        message: liberty_core::Message,
    },
    
    /// Message deleted
    MessageDelete {
        id: Uuid,
        channel_id: Uuid,
        server_id: Option<Uuid>,
    },
    
    /// Reaction added
    MessageReactionAdd {
        message_id: Uuid,
        channel_id: Uuid,
        user_id: Uuid,
        emoji: liberty_core::Emoji,
    },
    
    /// Reaction removed
    MessageReactionRemove {
        message_id: Uuid,
        channel_id: Uuid,
        user_id: Uuid,
        emoji: liberty_core::Emoji,
    },
    
    /// All reactions removed
    MessageReactionRemoveAll {
        message_id: Uuid,
        channel_id: Uuid,
    },
    
    /// Server created
    ServerCreate {
        server: liberty_core::Server,
    },
    
    /// Server updated
    ServerUpdate {
        server: liberty_core::Server,
    },
    
    /// Server deleted
    ServerDelete {
        id: Uuid,
    },
    
    /// Server join
    ServerJoin {
        server: liberty_core::Server,
    },
    
    /// Server leave
    ServerLeave {
        server_id: Uuid,
    },
    
    /// Channel created
    ChannelCreate {
        channel: liberty_core::Channel,
    },
    
    /// Channel updated
    ChannelUpdate {
        channel: liberty_core::Channel,
    },
    
    /// Channel deleted
    ChannelDelete {
        channel: liberty_core::Channel,
    },
    
    /// Server member join
    ServerMemberJoin {
        server_id: Uuid,
        member: liberty_core::ServerMember,
    },
    
    /// Server member leave
    ServerMemberLeave {
        server_id: Uuid,
        user_id: Uuid,
    },
    
    /// Server member update
    ServerMemberUpdate {
        server_id: Uuid,
        user_id: Uuid,
        nickname: Option<String>,
        roles: Vec<Uuid>,
    },
    
    /// Role created
    ServerRoleCreate {
        server_id: Uuid,
        role: liberty_core::Role,
    },
    
    /// Role updated
    ServerRoleUpdate {
        server_id: Uuid,
        role: liberty_core::Role,
    },
    
    /// Role deleted
    ServerRoleDelete {
        server_id: Uuid,
        role_id: Uuid,
    },
    
    /// Ban add
    ServerBanAdd {
        server_id: Uuid,
        user_id: Uuid,
        reason: Option<String>,
    },
    
    /// Ban remove
    ServerBanRemove {
        server_id: Uuid,
        user_id: Uuid,
    },
    
    /// Invite created
    InviteCreate {
        invite: liberty_core::Invite,
    },
    
    /// Invite deleted
    InviteDelete {
        code: String,
        server_id: Uuid,
        channel_id: Uuid,
    },
    
    /// User update
    UserUpdate {
        user: liberty_core::User,
    },
    
    /// Presence update
    PresenceUpdate {
        user_id: Uuid,
        status: liberty_core::UserStatus,
        activities: Vec<liberty_core::Activity>,
    },
    
    /// Typing start
    TypingStart {
        channel_id: Uuid,
        user_id: Uuid,
        timestamp: DateTime<Utc>,
    },
    
    /// Voice state update
    VoiceStateUpdate {
        server_id: Option<Uuid>,
        channel_id: Option<Uuid>,
        user_id: Uuid,
        session_id: Uuid,
        deaf: bool,
        mute: bool,
        self_deaf: bool,
        self_mute: bool,
        streaming: bool,
        video: bool,
        suppress: bool,
    },
    
    /// Voice server update
    VoiceServerUpdate {
        token: String,
        server_id: Option<Uuid>,
        endpoint: String,
    },
}

/// Event wrapper for dispatching
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventDispatch {
    /// Event type
    pub t: String,
    /// Event data
    pub d: Event,
    /// Sequence number
    pub s: u64,
}

impl EventDispatch {
    pub fn new(event: Event, seq: u64) -> Self {
        let t = match &event {
            Event::Ready { .. } => "READY",
            Event::MessageCreate { .. } => "MESSAGE_CREATE",
            Event::MessageUpdate { .. } => "MESSAGE_UPDATE",
            Event::MessageDelete { .. } => "MESSAGE_DELETE",
            Event::MessageReactionAdd { .. } => "MESSAGE_REACTION_ADD",
            Event::MessageReactionRemove { .. } => "MESSAGE_REACTION_REMOVE",
            Event::MessageReactionRemoveAll { .. } => "MESSAGE_REACTION_REMOVE_ALL",
            Event::ServerCreate { .. } => "SERVER_CREATE",
            Event::ServerUpdate { .. } => "SERVER_UPDATE",
            Event::ServerDelete { .. } => "SERVER_DELETE",
            Event::ServerJoin { .. } => "SERVER_JOIN",
            Event::ServerLeave { .. } => "SERVER_LEAVE",
            Event::ChannelCreate { .. } => "CHANNEL_CREATE",
            Event::ChannelUpdate { .. } => "CHANNEL_UPDATE",
            Event::ChannelDelete { .. } => "CHANNEL_DELETE",
            Event::ServerMemberJoin { .. } => "SERVER_MEMBER_JOIN",
            Event::ServerMemberLeave { .. } => "SERVER_MEMBER_LEAVE",
            Event::ServerMemberUpdate { .. } => "SERVER_MEMBER_UPDATE",
            Event::ServerRoleCreate { .. } => "SERVER_ROLE_CREATE",
            Event::ServerRoleUpdate { .. } => "SERVER_ROLE_UPDATE",
            Event::ServerRoleDelete { .. } => "SERVER_ROLE_DELETE",
            Event::ServerBanAdd { .. } => "SERVER_BAN_ADD",
            Event::ServerBanRemove { .. } => "SERVER_BAN_REMOVE",
            Event::InviteCreate { .. } => "INVITE_CREATE",
            Event::InviteDelete { .. } => "INVITE_DELETE",
            Event::UserUpdate { .. } => "USER_UPDATE",
            Event::PresenceUpdate { .. } => "PRESENCE_UPDATE",
            Event::TypingStart { .. } => "TYPING_START",
            Event::VoiceStateUpdate { .. } => "VOICE_STATE_UPDATE",
            Event::VoiceServerUpdate { .. } => "VOICE_SERVER_UPDATE",
        }.to_string();
        
        Self { t, d: event, s: seq }
    }
}
