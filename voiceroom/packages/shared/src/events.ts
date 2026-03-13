// ============================================================
// packages/shared/src/events.ts
// Socket.IO event name constants + typed payloads
// This file is the "contract" between client and server.
// NEVER use magic strings — always import from here.
// ============================================================

// ---- Event Name Constants ----

export const SOCKET_EVENTS = {
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
  PONG: "pong",
} as const;

export type SocketEventName = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

// ---- Payload Types ----

export interface JoinRoomPayload {
  roomId: string;
  /** Required if room is private + password-protected */
  password?: string;
}

export interface LeaveRoomPayload {
  roomId: string;
}

export interface RoomStatePayload {
  roomId: string;
  participants: import("./types").Participant[];
}

export interface ParticipantJoinedPayload {
  roomId: string;
  participant: import("./types").Participant;
}

export interface ParticipantLeftPayload {
  roomId: string;
  userId: string;
  socketId: string;
}

// WebRTC payloads — always include target/from to know where to route
export interface RtcOfferPayload {
  roomId: string;
  targetSocketId: string;
  fromSocketId: string;
  fromUserId: string;
  sdp: RTCSessionDescriptionInit;
}

export interface RtcAnswerPayload {
  roomId: string;
  targetSocketId: string;
  fromSocketId: string;
  fromUserId: string;
  sdp: RTCSessionDescriptionInit;
}

export interface RtcIceCandidatePayload {
  roomId: string;
  targetSocketId: string;
  fromSocketId: string;
  candidate: RTCIceCandidateInit;
}

export interface MuteStateChangedPayload {
  roomId: string;
  userId: string;
  socketId: string;
  isMuted: boolean;
}

export interface SpeakingStateChangedPayload {
  roomId: string;
  userId: string;
  socketId: string;
  isSpeaking: boolean;
}

export interface DeafenStateChangedPayload {
  roomId: string;
  userId: string;
  socketId: string;
  isDeafened: boolean;
}

export interface KickedPayload {
  roomId: string;
  reason?: string;
}

export interface ErrorPayload {
  code: string;
  message: string;
}
