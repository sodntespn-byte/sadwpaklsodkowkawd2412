// ============================================================
// apps/server/src/signaling/socket.server.ts
// Socket.IO signaling: auth, join/leave, WebRTC relay, mute/speaking
// State: in-memory roomId -> Map<socketId, Participant>
// ============================================================
import type { Server as SocketIOServerType } from "socket.io";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import type { Logger } from "pino";
import {
  SOCKET_EVENTS,
  JoinRoomSocketSchema,
  LeaveRoomSocketSchema,
  RtcOfferSocketSchema,
  RtcAnswerSocketSchema,
  RtcIceCandidateSocketSchema,
  MuteStateSocketSchema,
  SpeakingStateSocketSchema,
  DeafenStateSocketSchema,
} from "@voiceroom/shared";
import type { Participant } from "@voiceroom/shared";
import { env } from "../config/env.js";

interface AuthenticatedSocket {
  id: string;
  userId: string;
  userName: string;
  data: { roomId?: string };
}

// In-memory: roomId -> Map<socketId, Participant>
const roomParticipants = new Map<string, Map<string, Participant>>();

// SocketId -> Set of roomIds (for cleanup on disconnect)
const socketRooms = new Map<string, Set<string>>();

function getOrCreateRoomMap(roomId: string): Map<string, Participant> {
  let m = roomParticipants.get(roomId);
  if (!m) {
    m = new Map();
    roomParticipants.set(roomId, m);
  }
  return m;
}

function addSocketToRoom(socketId: string, roomId: string, participant: Participant) {
  const m = getOrCreateRoomMap(roomId);
  m.set(socketId, participant);
  let set = socketRooms.get(socketId);
  if (!set) {
    set = new Set();
    socketRooms.set(socketId, set);
  }
  set.add(roomId);
}

function removeSocketFromRoom(socketId: string, roomId: string): Participant | null {
  const m = roomParticipants.get(roomId);
  const p = m?.get(socketId) ?? null;
  if (m) {
    m.delete(socketId);
    if (m.size === 0) roomParticipants.delete(roomId);
  }
  socketRooms.get(socketId)?.delete(roomId);
  return p;
}

function getParticipantsInRoom(roomId: string): Participant[] {
  const m = roomParticipants.get(roomId);
  return m ? Array.from(m.values()) : [];
}

export function initSocketServer(
  io: SocketIOServerType,
  prisma: PrismaClient,
  logger: Logger
) {
  // ---- Auth middleware: require JWT in handshake ----
  io.use((socket, next) => {
    const token =
      (socket.handshake.auth as { accessToken?: string })?.accessToken ||
      (socket.handshake.headers.authorization as string)?.replace(/^Bearer\s+/i, "");

    if (!token) {
      next(new Error("Authentication required"));
      return;
    }

    try {
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as { sub: string; name?: string };
      (socket as unknown as AuthenticatedSocket).userId = payload.sub;
      (socket as unknown as AuthenticatedSocket).userName = payload.name ?? "User";
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const authSocket = socket as unknown as AuthenticatedSocket;
    const userId = authSocket.userId;
    const userName = authSocket.userName;
    const socketId = socket.id;

    logger.info({ userId, socketId }, "Socket connected");

    // ---- JOIN ROOM ----
    socket.on(SOCKET_EVENTS.JOIN_ROOM, async (payload: unknown) => {
      const parsed = JoinRoomSocketSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit(SOCKET_EVENTS.ERROR, { code: "VALIDATION_ERROR", message: "Invalid join payload" });
        return;
      }

      const { roomId, password } = parsed.data;

      try {
        const room = await prisma.room.findUnique({ where: { id: roomId }, include: { _count: { select: { members: true } } } });
        if (!room) {
          socket.emit(SOCKET_EVENTS.ROOM_NOT_FOUND, { roomId });
          return;
        }

        if (room._count.members >= room.maxCapacity) {
          socket.emit(SOCKET_EVENTS.ROOM_FULL, { roomId });
          return;
        }

        if (room.isPrivate) {
          const member = await prisma.roomMember.findUnique({
            where: { userId_roomId: { userId, roomId } },
          });
          if (!member) {
            socket.emit(SOCKET_EVENTS.ACCESS_DENIED, { roomId });
            return;
          }
        }

        if (room.passwordHash) {
          const argon2 = (await import("argon2")).default;
          const valid = password ? await argon2.verify(room.passwordHash, password) : false;
          if (!valid) {
            socket.emit(SOCKET_EVENTS.ACCESS_DENIED, { roomId });
            return;
          }
        }

        // Prevent duplicate join (same socket already in room)
        const existing = getOrCreateRoomMap(roomId).get(socketId);
        if (existing) {
          socket.emit(SOCKET_EVENTS.ROOM_STATE, { roomId, participants: getParticipantsInRoom(roomId) });
          return;
        }

        const participant: Participant = {
          userId,
          socketId,
          name: userName,
          isMuted: true,
          isSpeaking: false,
          isDeafened: false,
          joinedAt: Date.now(),
        };

        addSocketToRoom(socketId, roomId, participant);
        authSocket.data.roomId = roomId;

        socket.join(roomId);

        const participants = getParticipantsInRoom(roomId);
        socket.emit(SOCKET_EVENTS.ROOM_STATE, { roomId, participants });

        socket.to(roomId).emit(SOCKET_EVENTS.PARTICIPANT_JOINED, { roomId, participant });

        logger.info({ userId, roomId, socketId }, "User joined room");
      } catch (err) {
        logger.error({ err, roomId: parsed.data.roomId }, "Join room error");
        socket.emit(SOCKET_EVENTS.ERROR, { code: "JOIN_FAILED", message: "Could not join room" });
      }
    });

    // ---- LEAVE ROOM ----
    socket.on(SOCKET_EVENTS.LEAVE_ROOM, (payload: unknown) => {
      const parsed = LeaveRoomSocketSchema.safeParse(payload);
      if (!parsed.success) return;

      const { roomId } = parsed.data;
      const participant = removeSocketFromRoom(socketId, roomId);
      if (participant) {
        socket.leave(roomId);
        if (authSocket.data.roomId === roomId) authSocket.data.roomId = undefined;
        socket.to(roomId).emit(SOCKET_EVENTS.PARTICIPANT_LEFT, { roomId, userId, socketId });
        logger.info({ userId, roomId }, "User left room");
      }
    });

    // ---- RTC OFFER (relay to target) ----
    socket.on(SOCKET_EVENTS.RTC_OFFER, (payload: unknown) => {
      const parsed = RtcOfferSocketSchema.safeParse(payload);
      if (!parsed.success) return;

      const { roomId, targetSocketId, sdp } = parsed.data;
      const m = roomParticipants.get(roomId);
      if (!m?.has(socketId)) return;

      io.to(targetSocketId).emit(SOCKET_EVENTS.RTC_OFFER, {
        roomId,
        targetSocketId,
        fromSocketId: socketId,
        fromUserId: userId,
        sdp,
      });
    });

    // ---- RTC ANSWER (relay to target) ----
    socket.on(SOCKET_EVENTS.RTC_ANSWER, (payload: unknown) => {
      const parsed = RtcAnswerSocketSchema.safeParse(payload);
      if (!parsed.success) return;

      const { roomId, targetSocketId, sdp } = parsed.data;
      const m = roomParticipants.get(roomId);
      if (!m?.has(socketId)) return;

      io.to(targetSocketId).emit(SOCKET_EVENTS.RTC_ANSWER, {
        roomId,
        targetSocketId,
        fromSocketId: socketId,
        fromUserId: userId,
        sdp,
      });
    });

    // ---- RTC ICE CANDIDATE (relay to target) ----
    socket.on(SOCKET_EVENTS.RTC_ICE_CANDIDATE, (payload: unknown) => {
      const parsed = RtcIceCandidateSocketSchema.safeParse(payload);
      if (!parsed.success) return;

      const { roomId, targetSocketId, candidate } = parsed.data;
      const m = roomParticipants.get(roomId);
      if (!m?.has(socketId)) return;

      io.to(targetSocketId).emit(SOCKET_EVENTS.RTC_ICE_CANDIDATE, {
        roomId,
        targetSocketId,
        fromSocketId: socketId,
        candidate,
      });
    });

    // ---- MUTE STATE ----
    socket.on(SOCKET_EVENTS.MUTE_STATE_CHANGED, (payload: unknown) => {
      const parsed = MuteStateSocketSchema.safeParse(payload);
      if (!parsed.success) return;

      const { roomId, isMuted } = parsed.data;
      const m = roomParticipants.get(roomId);
      const p = m?.get(socketId);
      if (p) {
        p.isMuted = isMuted;
        socket.to(roomId).emit(SOCKET_EVENTS.MUTE_STATE_CHANGED, {
          roomId,
          userId,
          socketId,
          isMuted,
        });
      }
    });

    // ---- SPEAKING STATE ----
    socket.on(SOCKET_EVENTS.SPEAKING_STATE_CHANGED, (payload: unknown) => {
      const parsed = SpeakingStateSocketSchema.safeParse(payload);
      if (!parsed.success) return;

      const { roomId, isSpeaking } = parsed.data;
      const m = roomParticipants.get(roomId);
      const p = m?.get(socketId);
      if (p) {
        p.isSpeaking = isSpeaking;
        socket.to(roomId).emit(SOCKET_EVENTS.SPEAKING_STATE_CHANGED, {
          roomId,
          userId,
          socketId,
          isSpeaking,
        });
      }
    });

    // ---- DEAFEN STATE (local only, but broadcast so UI can show) ----
    socket.on(SOCKET_EVENTS.DEAFEN_STATE_CHANGED, (payload: unknown) => {
      const parsed = DeafenStateSocketSchema.safeParse(payload);
      if (!parsed.success) return;

      const { roomId, isDeafened } = parsed.data;
      const m = roomParticipants.get(roomId);
      const p = m?.get(socketId);
      if (p) {
        p.isDeafened = isDeafened;
        socket.to(roomId).emit(SOCKET_EVENTS.DEAFEN_STATE_CHANGED, {
          roomId,
          userId,
          socketId,
          isDeafened,
        });
      }
    });

    // ---- DISCONNECT: cleanup all rooms ----
    socket.on("disconnect", () => {
      const rooms = socketRooms.get(socketId);
      if (rooms) {
        for (const roomId of rooms) {
          removeSocketFromRoom(socketId, roomId);
          socket.to(roomId).emit(SOCKET_EVENTS.PARTICIPANT_LEFT, { roomId, userId, socketId });
        }
        socketRooms.delete(socketId);
      }
      logger.info({ userId, socketId }, "Socket disconnected");
    });
  });
}
