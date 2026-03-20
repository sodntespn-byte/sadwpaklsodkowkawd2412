//! WebSocket message types for client-server communication

use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use liberty_core::{User, Server, Channel, Message, ServerMember, Role};

/// Client-to-Server message types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "op", content = "d")]
#[serde(rename_all = "snake_case")]
pub enum ClientMessage {
    /// Authenticate with token
    Authenticate { token: String },
    
    /// Heartbeat
    Heartbeat { seq: u64 },
    
    /// Request server list
    RequestServers,
    
    /// Request server info
    RequestServer { server_id: Uuid },
    
    /// Request channel messages
    RequestMessages {
        channel_id: Uuid,
        before: Option<Uuid>,
        after: Option<Uuid>,
        limit: Option<u32>,
    },
    
    /// Send a message
    SendMessage {
        channel_id: Uuid,
        content: String,
        tts: bool,
        embeds: Vec<liberty_core::Embed>,
    },
    
    /// Edit a message
    EditMessage {
        channel_id: Uuid,
        message_id: Uuid,
        content: String,
    },
    
    /// Delete a message
    DeleteMessage {
        channel_id: Uuid,
        message_id: Uuid,
    },
    
    /// Start typing indicator
    StartTyping { channel_id: Uuid },
    
    /// Update presence
    UpdatePresence {
        status: liberty_core::UserStatus,
        custom_status: Option<String>,
    },
    
    /// Join voice channel
    JoinVoice { channel_id: Uuid },
    
    /// Leave voice channel
    LeaveVoice { channel_id: Uuid },
    
    /// Create server
    CreateServer {
        name: String,
        region: Option<String>,
        icon: Option<String>,
    },
    
    /// Update server
    UpdateServer {
        server_id: Uuid,
        name: Option<String>,
        description: Option<String>,
        icon: Option<String>,
        banner: Option<String>,
    },
    
    /// Delete server
    DeleteServer { server_id: Uuid },
    
    /// Create channel
    CreateChannel {
        server_id: Uuid,
        name: String,
        channel_type: liberty_core::ChannelType,
        parent_id: Option<Uuid>,
        topic: Option<String>,
    },
    
    /// Update channel
    UpdateChannel {
        channel_id: Uuid,
        name: Option<String>,
        topic: Option<String>,
        position: Option<i32>,
    },
    
    /// Delete channel
    DeleteChannel { channel_id: Uuid },
    
    /// Create invite
    CreateInvite {
        channel_id: Uuid,
        max_uses: Option<i32>,
        max_age: Option<i32>,
        temporary: bool,
    },
    
    /// Join server with invite
    JoinServer { invite_code: String },
    
    /// Leave server
    LeaveServer { server_id: Uuid },
    
    /// Kick member
    KickMember {
        server_id: Uuid,
        user_id: Uuid,
        reason: Option<String>,
    },
    
    /// Ban member
    BanMember {
        server_id: Uuid,
        user_id: Uuid,
        reason: Option<String>,
        delete_message_days: Option<i32>,
    },
    
    /// Update member
    UpdateMember {
        server_id: Uuid,
        user_id: Uuid,
        nickname: Option<String>,
        roles: Option<Vec<Uuid>>,
        mute: Option<bool>,
        deaf: Option<bool>,
    },
    
    /// Create role
    CreateRole {
        server_id: Uuid,
        name: String,
        permissions: u64,
        color: Option<i32>,
        hoist: bool,
        mentionable: bool,
    },
    
    /// Update role
    UpdateRole {
        server_id: Uuid,
        role_id: Uuid,
        name: Option<String>,
        permissions: Option<u64>,
        color: Option<i32>,
        position: Option<i32>,
        hoist: Option<bool>,
        mentionable: Option<bool>,
    },
    
    /// Delete role
    DeleteRole { server_id: Uuid, role_id: Uuid },
    
    /// Add reaction
    AddReaction {
        channel_id: Uuid,
        message_id: Uuid,
        emoji: liberty_core::Emoji,
    },
    
    /// Remove reaction
    RemoveReaction {
        channel_id: Uuid,
        message_id: Uuid,
        emoji: liberty_core::Emoji,
    },
    
    /// Request user info
    RequestUser { user_id: Uuid },
    
    /// Update user
    UpdateUser {
        username: Option<String>,
        avatar: Option<String>,
        banner: Option<String>,
        bio: Option<String>,
    },
}

/// Server-to-Client message types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "op", content = "d")]
#[serde(rename_all = "snake_case")]
pub enum ServerMessage {
    /// Hello - sent on connection
    Hello {
        heartbeat_interval: u64,
        server_version: String,
    },
    
    /// Authentication result
    Authenticated {
        user: User,
        servers: Vec<Server>,
        session_id: Uuid,
    },
    
    /// Authentication failed
    AuthFailed { reason: String },
    
    /// Heartbeat ACK
    HeartbeatAck { seq: u64 },
    
    /// Server list
    ServerList { servers: Vec<Server> },
    
    /// Server info
    ServerInfo {
        server: Server,
        channels: Vec<Channel>,
        members: Vec<ServerMember>,
        roles: Vec<Role>,
    },
    
    /// Message created
    MessageCreated { message: Message },
    
    /// Message updated
    MessageUpdated {
        channel_id: Uuid,
        message_id: Uuid,
        content: String,
        edited_timestamp: DateTime<Utc>,
    },
    
    /// Message deleted
    MessageDeleted {
        channel_id: Uuid,
        message_id: Uuid,
    },
    
    /// Messages list
    MessagesList {
        channel_id: Uuid,
        messages: Vec<Message>,
    },
    
    /// Typing started
    TypingStarted {
        channel_id: Uuid,
        user_id: Uuid,
        timestamp: DateTime<Utc>,
    },
    
    /// Presence update
    PresenceUpdate {
        user_id: Uuid,
        status: liberty_core::UserStatus,
        custom_status: Option<String>,
    },
    
    /// Server created
    ServerCreated {
        server: Server,
        channels: Vec<Channel>,
        roles: Vec<Role>,
    },
    
    /// Server updated
    ServerUpdated { server: Server },
    
    /// Server deleted
    ServerDeleted { server_id: Uuid },
    
    /// Channel created
    ChannelCreated { channel: Channel },
    
    /// Channel updated
    ChannelUpdated { channel: Channel },
    
    /// Channel deleted
    ChannelDeleted {
        server_id: Uuid,
        channel_id: Uuid,
    },
    
    /// Member joined
    MemberJoined { member: ServerMember },
    
    /// Member left
    MemberLeft {
        server_id: Uuid,
        user_id: Uuid,
    },
    
    /// Member updated
    MemberUpdated {
        server_id: Uuid,
        user_id: Uuid,
        nickname: Option<String>,
        roles: Vec<Uuid>,
    },
    
    /// Member banned
    MemberBanned {
        server_id: Uuid,
        user_id: Uuid,
        reason: Option<String>,
    },
    
    /// Role created
    RoleCreated { server_id: Uuid, role: Role },
    
    /// Role updated
    RoleUpdated { server_id: Uuid, role: Role },
    
    /// Role deleted
    RoleDeleted {
        server_id: Uuid,
        role_id: Uuid,
    },
    
    /// Reaction added
    ReactionAdded {
        channel_id: Uuid,
        message_id: Uuid,
        emoji: liberty_core::Emoji,
        user_id: Uuid,
    },
    
    /// Reaction removed
    ReactionRemoved {
        channel_id: Uuid,
        message_id: Uuid,
        emoji: liberty_core::Emoji,
        user_id: Uuid,
    },
    
    /// Invite created
    InviteCreated { invite: liberty_core::Invite },
    
    /// User info
    UserInfo { user: User },
    
    /// User updated
    UserUpdated { user: User },
    
    /// Error
    Error {
        code: i32,
        message: String,
    },
    
    /// Ready - all initial data sent
    Ready { session_id: Uuid },
}

/// Gateway opcode constants
pub mod opcodes {
    pub const HELLO: i32 = 0;
    pub const AUTHENTICATE: i32 = 1;
    pub const AUTHENTICATED: i32 = 2;
    pub const AUTH_FAILED: i32 = 3;
    pub const HEARTBEAT: i32 = 4;
    pub const HEARTBEAT_ACK: i32 = 5;
    pub const EVENT: i32 = 6;
    pub const REQUEST: i32 = 7;
    pub const RESPONSE: i32 = 8;
    pub const ERROR: i32 = 9;
}
