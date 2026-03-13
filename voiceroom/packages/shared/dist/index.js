"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  CreateInviteSchema: () => CreateInviteSchema,
  CreateRoomSchema: () => CreateRoomSchema,
  DeafenStateSocketSchema: () => DeafenStateSocketSchema,
  JoinRoomIntentSchema: () => JoinRoomIntentSchema,
  JoinRoomSocketSchema: () => JoinRoomSocketSchema,
  KickUserSchema: () => KickUserSchema,
  LeaveRoomSocketSchema: () => LeaveRoomSocketSchema,
  LoginSchema: () => LoginSchema,
  MuteStateSocketSchema: () => MuteStateSocketSchema,
  RefreshTokenSchema: () => RefreshTokenSchema,
  RegisterSchema: () => RegisterSchema,
  RtcAnswerSocketSchema: () => RtcAnswerSocketSchema,
  RtcIceCandidateSocketSchema: () => RtcIceCandidateSocketSchema,
  RtcOfferSocketSchema: () => RtcOfferSocketSchema,
  SOCKET_EVENTS: () => SOCKET_EVENTS,
  SpeakingStateSocketSchema: () => SpeakingStateSocketSchema,
  UpdateRoomSchema: () => UpdateRoomSchema,
  UpdateUserSchema: () => UpdateUserSchema
});
module.exports = __toCommonJS(index_exports);

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
var import_zod = require("zod");
var RegisterSchema = import_zod.z.object({
  name: import_zod.z.string().min(2).max(50),
  email: import_zod.z.string().email(),
  password: import_zod.z.string().min(8).max(128)
});
var LoginSchema = import_zod.z.object({
  email: import_zod.z.string().email(),
  password: import_zod.z.string().min(1)
});
var RefreshTokenSchema = import_zod.z.object({
  refreshToken: import_zod.z.string().min(1)
});
var CreateRoomSchema = import_zod.z.object({
  name: import_zod.z.string().min(1).max(100),
  description: import_zod.z.string().max(300).optional(),
  isPrivate: import_zod.z.boolean().default(false),
  password: import_zod.z.string().max(100).optional(),
  maxCapacity: import_zod.z.number().int().min(2).max(50).default(10)
});
var UpdateRoomSchema = import_zod.z.object({
  name: import_zod.z.string().min(1).max(100).optional(),
  description: import_zod.z.string().max(300).optional(),
  isPrivate: import_zod.z.boolean().optional(),
  password: import_zod.z.string().max(100).optional().nullable(),
  maxCapacity: import_zod.z.number().int().min(2).max(50).optional()
});
var JoinRoomIntentSchema = import_zod.z.object({
  password: import_zod.z.string().optional(),
  inviteCode: import_zod.z.string().optional()
});
var KickUserSchema = import_zod.z.object({
  userId: import_zod.z.string().uuid(),
  reason: import_zod.z.string().max(200).optional()
});
var CreateInviteSchema = import_zod.z.object({
  maxUses: import_zod.z.number().int().min(1).max(1e3).optional(),
  expiresInHours: import_zod.z.number().int().min(1).max(720).optional()
});
var UpdateUserSchema = import_zod.z.object({
  name: import_zod.z.string().min(2).max(50).optional()
});
var JoinRoomSocketSchema = import_zod.z.object({
  roomId: import_zod.z.string().uuid(),
  password: import_zod.z.string().optional()
});
var LeaveRoomSocketSchema = import_zod.z.object({
  roomId: import_zod.z.string().uuid()
});
var RtcOfferSocketSchema = import_zod.z.object({
  roomId: import_zod.z.string().uuid(),
  targetSocketId: import_zod.z.string().min(1),
  sdp: import_zod.z.object({
    type: import_zod.z.enum(["offer"]),
    sdp: import_zod.z.string().min(1)
  })
});
var RtcAnswerSocketSchema = import_zod.z.object({
  roomId: import_zod.z.string().uuid(),
  targetSocketId: import_zod.z.string().min(1),
  sdp: import_zod.z.object({
    type: import_zod.z.enum(["answer"]),
    sdp: import_zod.z.string().min(1)
  })
});
var RtcIceCandidateSocketSchema = import_zod.z.object({
  roomId: import_zod.z.string().uuid(),
  targetSocketId: import_zod.z.string().min(1),
  candidate: import_zod.z.object({
    candidate: import_zod.z.string(),
    sdpMid: import_zod.z.string().nullable().optional(),
    sdpMLineIndex: import_zod.z.number().nullable().optional(),
    usernameFragment: import_zod.z.string().nullable().optional()
  })
});
var MuteStateSocketSchema = import_zod.z.object({
  roomId: import_zod.z.string().uuid(),
  isMuted: import_zod.z.boolean()
});
var SpeakingStateSocketSchema = import_zod.z.object({
  roomId: import_zod.z.string().uuid(),
  isSpeaking: import_zod.z.boolean()
});
var DeafenStateSocketSchema = import_zod.z.object({
  roomId: import_zod.z.string().uuid(),
  isDeafened: import_zod.z.boolean()
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
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
});
