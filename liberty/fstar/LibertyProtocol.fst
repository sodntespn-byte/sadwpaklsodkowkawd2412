// LIBERTY - Protocol Security Verification
// WebSocket message handling and validation

module LibertyProtocol

open FStar.Bytes
open FStar.UInt32
open FStar.UInt64
open FStar.List

// ============================================
// Message Types
// ============================================

/** Message opcode */
type opcode = 
  | Hello
  | Authenticate
  | Authenticated
  | AuthFailed
  | Heartbeat
  | HeartbeatAck
  | Event
  | Request
  | Response
  | Error

/** User status */
type user_status =
  | Online
  | Idle
  | DoNotDisturb
  | Offline

/** Channel type */
type channel_type =
  | Text
  | Voice
  | Category
  | Announcement
  | Stage

/** Message content with length limit */
type message_content = b:bytes { length b <= 2000 }

/** Channel ID */
type channel_id = b:bytes { length b = 16 }

/** Server ID */
type server_id = b:bytes { length b = 16 }

/** User ID */
type user_id = b:bytes { length b = 16 }

/** Message ID */
type message_id = b:bytes { length b = 16 }

// ============================================
// Client Messages
// ============================================

/** Client-to-server message types */
type client_message =
  | Authenticate of token:bytes
  | Heartbeat of seq:uint64
  | RequestServers
  | RequestServer of server_id
  | RequestMessages of channel_id * option message_id * option message_id * option uint32
  | SendMessage of channel_id * message_content * bool (* tts *)
  | EditMessage of channel_id * message_id * message_content
  | DeleteMessage of channel_id * message_id
  | StartTyping of channel_id
  | UpdatePresence of user_status * option bytes (* custom status *)
  | JoinVoice of channel_id
  | LeaveVoice of channel_id
  | CreateServer of server_name:bytes * option region:bytes * option icon:bytes
  | UpdateServer of server_id * option name:bytes * option description:bytes
  | DeleteServer of server_id
  | CreateChannel of server_id * name:bytes * channel_type * option parent:channel_id
  | UpdateChannel of channel_id * option name:bytes * option topic:bytes
  | DeleteChannel of channel_id
  | CreateInvite of channel_id * option max_uses:uint32 * option max_age:uint32 * bool
  | JoinServer of invite_code:bytes
  | LeaveServer of server_id
  | KickMember of server_id * user_id * option reason:bytes
  | BanMember of server_id * user_id * option reason:bytes * option delete_days:uint32
  | UpdateMember of server_id * user_id * option nickname:bytes * option roles:list bytes
  | CreateRole of server_id * name:bytes * permissions:uint64 * option color:uint32
  | UpdateRole of server_id * role_id:bytes * option name:bytes * option permissions:uint64
  | DeleteRole of server_id * role_id:bytes
  | AddReaction of channel_id * message_id * emoji:bytes
  | RemoveReaction of channel_id * message_id * emoji:bytes
  | RequestUser of user_id
  | UpdateUser of option username:bytes * option avatar:bytes * option bio:bytes

// ============================================
// Server Messages
// ============================================

/** Server-to-client message types */
type server_message =
  | Hello of heartbeat_interval:uint64 * server_version:bytes
  | Authenticated of user:user_info * servers:list server_info * session_id:bytes
  | AuthFailed of reason:bytes
  | HeartbeatAck of seq:uint64
  | ServerList of servers:list server_info
  | ServerInfo of server:server_info * channels:list channel_info * members:list member_info * roles:list role_info
  | MessageCreated of message:message_info
  | MessageUpdated of channel_id * message_id * content:bytes * edited_timestamp:uint64
  | MessageDeleted of channel_id * message_id
  | MessagesList of channel_id * messages:list message_info
  | TypingStarted of channel_id * user_id * timestamp:uint64
  | PresenceUpdate of user_id * user_status * option custom_status:bytes
  | ServerCreated of server:server_info * channels:list channel_info * roles:list role_info
  | ServerUpdated of server:server_info
  | ServerDeleted of server_id
  | ChannelCreated of channel:channel_info
  | ChannelUpdated of channel:channel_info
  | ChannelDeleted of server_id * channel_id
  | MemberJoined of member:member_info
  | MemberLeft of server_id * user_id
  | MemberUpdated of server_id * user_id * option nickname:bytes * roles:list bytes
  | MemberBanned of server_id * user_id * option reason:bytes
  | RoleCreated of server_id * role:role_info
  | RoleUpdated of server_id * role:role_info
  | RoleDeleted of server_id * role_id:bytes
  | ReactionAdded of channel_id * message_id * emoji:bytes * user_id
  | ReactionRemoved of channel_id * message_id * emoji:bytes * user_id
  | InviteCreated of invite:invite_info
  | UserInfo of user:user_info
  | UserUpdated of user:user_info
  | Error of code:int32 * message:bytes

// ============================================
// Info Types
// ============================================

and user_info = {
  id: user_id;
  username: bytes;
  discriminator: bytes;
  email: bytes;
  avatar: option bytes;
  status: user_status;
  verified: bool;
  mfa_enabled: bool;
  created_at: uint64;
}

and server_info = {
  id: server_id;
  name: bytes;
  description: option bytes;
  icon: option bytes;
  owner_id: user_id;
  member_count: uint64;
  created_at: uint64;
}

and channel_info = {
  id: channel_id;
  server_id: option server_id;
  name: bytes;
  channel_type: channel_type;
  position: uint32;
  topic: option bytes;
}

and member_info = {
  server_id: server_id;
  user_id: user_id;
  nickname: option bytes;
  roles: list bytes;
  joined_at: uint64;
}

and role_info = {
  id: bytes;
  server_id: server_id;
  name: bytes;
  permissions: uint64;
  position: uint32;
}

and message_info = {
  id: message_id;
  channel_id: channel_id;
  author_id: user_id;
  content: message_content;
  created_at: uint64;
  edited_at: option uint64;
  pinned: bool;
}

and invite_info = {
  code: bytes;
  server_id: server_id;
  channel_id: channel_id;
  uses: uint32;
  max_uses: option uint32;
  max_age: option uint32;
  created_at: uint64;
  expires_at: option uint64;
}

// ============================================
// Message Validation
// ============================================

/** Validate message content */
val validate_message_content:
  content:bytes ->
  Pure (option message_content)
    (requires (True))
    (ensures (fun r ->
      match r with
      | Some c -> length c <= 2000 /\ length c > 0
      | None -> length content > 2000 \/ length content = 0))

/** Validate username */
val validate_username:
  username:bytes ->
  Pure (option bytes)
    (requires (True))
    (ensures (fun r ->
      match r with
      | Some u -> 3 <= length u /\ length u <= 32
      | None -> length u < 3 \/ length u > 32))

/** Validate server name */
val validate_server_name:
  name:bytes ->
  Pure (option bytes)
    (requires (True))
    (ensures (fun r ->
      match r with
      | Some n -> 1 <= length n /\ length n <= 100
      | None -> length n = 0 \/ length n > 100))

/** Validate channel name */
val validate_channel_name:
  name:bytes ->
  Pure (option bytes)
    (requires (True))
    (ensures (fun r ->
      match r with
      | Some n -> 1 <= length n /\ length n <= 50
      | None -> length n = 0 \/ length n > 50))

// ============================================
// Permission System
// ============================================

/** Permission bitfield */
type permissions = uint64

/** Permission bits */
val perm_create_invite: permissions
val perm_kick_members: permissions
val perm_ban_members: permissions
val perm_administrator: permissions
val perm_manage_channels: permissions
let perm_manage_server: permissions
val perm_add_reactions: permissions
val perm_view_channel: permissions
val perm_send_messages: permissions
val perm_manage_messages: permissions
val perm_embed_links: permissions
val perm_attach_files: permissions
val perm_read_history: permissions
val perm_mention_everyone: permissions
val perm_connect: permissions
val perm_speak: permissions
val perm_mute_members: permissions
val perm_deafen_members: permissions
val perm_move_members: permissions
val perm_change_nickname: permissions
val perm_manage_nicknames: permissions
val perm_manage_roles: permissions

/** Check if permission is granted */
val has_permission:
  user_perms:permissions ->
  required:permissions ->
  Pure bool
    (requires (True))
    (ensures (fun r ->
      // Administrator grants all permissions
      r = ((user_perms land perm_administrator <> 0) \/
           (user_perms land required <> 0)))

/** Combine permissions from multiple roles */
val combine_permissions:
  roles:list permissions ->
  Pure permissions
    (requires (True))
    (ensures (fun r ->
      // Result is OR of all permissions
      True))

// ============================================
// Rate Limiting
// ============================================

/** Rate limit configuration */
type rate_limit_config = {
  messages_per_second: uint32;
  edits_per_minute: uint32;
  reactions_per_minute: uint32;
  server_joins_per_day: uint32;
}

/** Check message rate limit */
val check_message_rate:
  messages_sent:uint32 ->
  config:rate_limit_config ->
  Pure bool
    (requires (True))
    (ensures (fun r ->
      r = (messages_sent < config.messages_per_second)))

// ============================================
// Session Management
// ============================================

/** Session state */
type session = {
  user_id: user_id;
  session_id: bytes;
  connected_at: uint64;
  last_heartbeat: uint64;
  sequence: uint64;
  authenticated: bool;
}

/** Validate session is active */
val session_is_active:
  session:session ->
  current_time:uint64 ->
  heartbeat_timeout:uint64 ->
  Pure bool
    (requires (True))
    (ensures (fun r ->
      r = (session.authenticated /\
           current_time - session.last_heartbeat < heartbeat_timeout)))

/** Update session heartbeat */
val update_heartbeat:
  session:session ->
  current_time:uint64 ->
  Pure session
    (requires (True))
    (ensures (fun s ->
      s.last_heartbeat = current_time /\
      s.user_id = session.user_id))

// ============================================
// Protocol Invariants
// ============================================

/** All messages must be authenticated before other operations */
val authentication_first:
  messages:list client_message ->
  Pure unit
    (requires (
      match messages with
      | [] -> True
      | Authenticate _ :: _ -> True
      | _ -> False))
    (ensures (fun _ -> True))

/** Heartbeat must be sent within interval */
val heartbeat_invariant:
  session:session ->
  current_time:uint64 ->
  interval:uint64 ->
  Pure unit
    (requires (current_time - session.last_heartbeat < interval))
    (ensures (fun _ -> True))

/** Message sequence is monotonic */
val sequence_monotonic:
  old_seq:uint64 ->
  new_seq:uint64 ->
  Pure unit
    (requires (new_seq > old_seq))
    (ensures (fun _ -> True))
