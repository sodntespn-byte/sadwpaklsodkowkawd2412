// src/events.ts
var SOCKET_EVENTS = {
  // Connection lifecycle
  CONNECT: "connect",
  DISCONNECT: "disconnect",
  CONNECT_ERROR: "connect_error",
  // Room lifecycle (client -> server)
  JOIN_ROOM: "join-room",
  LEAVE_ROOM: "leave-room",
  // Room state (server -> client)
  ROOM_STATE: "room-state",
  PARTICIPANT_JOINED: "participant-joined",
  PARTICIPANT_LEFT: "participant-left",
  ROOM_FULL: "room-full",
  ROOM_NOT_FOUND: "room-not-found",
  ACCESS_DENIED: "access-denied",
  // WebRTC signaling (client -> server, relayed to peer)
  RTC_OFFER: "rtc-offer",
  RTC_ANSWER: "rtc-answer",
  RTC_ICE_CANDIDATE: "rtc-ice-candidate",
  // Media state (client -> server, broadcast to room)
  MUTE_STATE_CHANGED: "mute-state-changed",
  SPEAKING_STATE_CHANGED: "speaking-state-changed",
  DEAFEN_STATE_CHANGED: "deafen-state-changed",
  // Room management (server -> client)
  KICKED: "kicked",
  USER_KICKED: "user-kicked",
  // Errors
  ERROR: "error",
  // Heartbeat
  PING: "ping",
  PONG: "pong"
};

// src/schemas.ts
import { z } from "zod";
var RegisterSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(8).max(128)
});
var LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});
var RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1)
});
var CreateRoomSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(300).optional(),
  isPrivate: z.boolean().default(false),
  password: z.string().max(100).optional(),
  maxCapacity: z.number().int().min(2).max(50).default(10)
});
var UpdateRoomSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(300).optional(),
  isPrivate: z.boolean().optional(),
  password: z.string().max(100).optional().nullable(),
  maxCapacity: z.number().int().min(2).max(50).optional()
});
var JoinRoomIntentSchema = z.object({
  password: z.string().optional(),
  inviteCode: z.string().optional()
});
var KickUserSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().max(200).optional()
});
var CreateInviteSchema = z.object({
  maxUses: z.number().int().min(1).max(1e3).optional(),
  expiresInHours: z.number().int().min(1).max(720).optional()
});
var UpdateUserSchema = z.object({
  name: z.string().min(2).max(50).optional()
});
var JoinRoomSocketSchema = z.object({
  roomId: z.string().uuid(),
  password: z.string().optional()
});
var LeaveRoomSocketSchema = z.object({
  roomId: z.string().uuid()
});
var RtcOfferSocketSchema = z.object({
  roomId: z.string().uuid(),
  targetSocketId: z.string().min(1),
  sdp: z.object({
    type: z.enum(["offer"]),
    sdp: z.string().min(1)
  })
});
var RtcAnswerSocketSchema = z.object({
  roomId: z.string().uuid(),
  targetSocketId: z.string().min(1),
  sdp: z.object({
    type: z.enum(["answer"]),
    sdp: z.string().min(1)
  })
});
var RtcIceCandidateSocketSchema = z.object({
  roomId: z.string().uuid(),
  targetSocketId: z.string().min(1),
  candidate: z.object({
    candidate: z.string(),
    sdpMid: z.string().nullable().optional(),
    sdpMLineIndex: z.number().nullable().optional(),
    usernameFragment: z.string().nullable().optional()
  })
});
var MuteStateSocketSchema = z.object({
  roomId: z.string().uuid(),
  isMuted: z.boolean()
});
var SpeakingStateSocketSchema = z.object({
  roomId: z.string().uuid(),
  isSpeaking: z.boolean()
});
var DeafenStateSocketSchema = z.object({
  roomId: z.string().uuid(),
  isDeafened: z.boolean()
});
export {
  CreateInviteSchema,
  CreateRoomSchema,
  DeafenStateSocketSchema,
  JoinRoomIntentSchema,
  JoinRoomSocketSchema,
  KickUserSchema,
  LeaveRoomSocketSchema,
  LoginSchema,
  MuteStateSocketSchema,
  RefreshTokenSchema,
  RegisterSchema,
  RtcAnswerSocketSchema,
  RtcIceCandidateSocketSchema,
  RtcOfferSocketSchema,
  SOCKET_EVENTS,
  SpeakingStateSocketSchema,
  UpdateRoomSchema,
  UpdateUserSchema
};
