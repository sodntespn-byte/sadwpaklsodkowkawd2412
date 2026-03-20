// packages/shared/src/schemas.ts
// Zod validation schemas used for HTTP and Socket payloads
import { z } from "zod";

// ---- Auth ----

export const RegisterSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

// ---- Rooms ----

export const CreateRoomSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(300).optional(),
  isPrivate: z.boolean().default(false),
  password: z.string().max(100).optional(),
  maxCapacity: z.number().int().min(2).max(50).default(10),
});

export const UpdateRoomSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(300).optional(),
  isPrivate: z.boolean().optional(),
  password: z.string().max(100).optional().nullable(),
  maxCapacity: z.number().int().min(2).max(50).optional(),
});

export const JoinRoomIntentSchema = z.object({
  password: z.string().optional(),
  inviteCode: z.string().optional(),
});

export const KickUserSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().max(200).optional(),
});

export const CreateInviteSchema = z.object({
  maxUses: z.number().int().min(1).max(1000).optional(),
  expiresInHours: z.number().int().min(1).max(720).optional(),
});

// ---- Users ----

export const UpdateUserSchema = z.object({
  name: z.string().min(2).max(50).optional(),
});

// ---- Socket Payloads (validated on server) ----

export const JoinRoomSocketSchema = z.object({
  roomId: z.string().uuid(),
  password: z.string().optional(),
});

export const LeaveRoomSocketSchema = z.object({
  roomId: z.string().uuid(),
});

export const RtcOfferSocketSchema = z.object({
  roomId: z.string().uuid(),
  targetSocketId: z.string().min(1),
  sdp: z.object({
    type: z.enum(["offer"]),
    sdp: z.string().min(1),
  }),
});

export const RtcAnswerSocketSchema = z.object({
  roomId: z.string().uuid(),
  targetSocketId: z.string().min(1),
  sdp: z.object({
    type: z.enum(["answer"]),
    sdp: z.string().min(1),
  }),
});

export const RtcIceCandidateSocketSchema = z.object({
  roomId: z.string().uuid(),
  targetSocketId: z.string().min(1),
  candidate: z.object({
    candidate: z.string(),
    sdpMid: z.string().nullable().optional(),
    sdpMLineIndex: z.number().nullable().optional(),
    usernameFragment: z.string().nullable().optional(),
  }),
});

export const MuteStateSocketSchema = z.object({
  roomId: z.string().uuid(),
  isMuted: z.boolean(),
});

export const SpeakingStateSocketSchema = z.object({
  roomId: z.string().uuid(),
  isSpeaking: z.boolean(),
});

export const DeafenStateSocketSchema = z.object({
  roomId: z.string().uuid(),
  isDeafened: z.boolean(),
});

// Inferred TypeScript types from Zod schemas
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type CreateRoomInput = z.infer<typeof CreateRoomSchema>;
export type UpdateRoomInput = z.infer<typeof UpdateRoomSchema>;
export type CreateInviteInput = z.infer<typeof CreateInviteSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
