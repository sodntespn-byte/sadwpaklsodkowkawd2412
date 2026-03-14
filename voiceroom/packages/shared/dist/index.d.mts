import { z } from 'zod';

type UserRole = "owner" | "admin" | "member";
interface UserPublic {
    id: string;
    name: string;
    email: string;
    createdAt: string;
}
interface RoomPublic {
    id: string;
    name: string;
    description: string | null;
    isPrivate: boolean;
    hasPassword: boolean;
    maxCapacity: number;
    ownerId: string;
    owner: {
        id: string;
        name: string;
    };
    participantCount: number;
    createdAt: string;
}
interface RoomMemberPublic {
    userId: string;
    roomId: string;
    role: UserRole;
    joinedAt: string;
    user: UserPublic;
}
/** Represents a participant currently in a voice room (in-memory / real-time) */
interface Participant {
    userId: string;
    socketId: string;
    name: string;
    isMuted: boolean;
    isSpeaking: boolean;
    /** Whether the user has muted their own incoming audio (local deafen) */
    isDeafened: boolean;
    joinedAt: number;
}
interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}
interface AuthResponse {
    user: UserPublic;
    tokens: AuthTokens;
}
interface ApiSuccess<T> {
    success: true;
    data: T;
}
interface ApiError {
    success: false;
    error: string;
    code?: string;
    details?: unknown;
}
type ApiResponse<T> = ApiSuccess<T> | ApiError;
interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}
interface InvitePublic {
    id: string;
    code: string;
    roomId: string;
    expiresAt: string | null;
    maxUses: number | null;
    usedCount: number;
}

declare const SOCKET_EVENTS: {
    readonly CONNECT: "connect";
    readonly DISCONNECT: "disconnect";
    readonly CONNECT_ERROR: "connect_error";
    readonly JOIN_ROOM: "join-room";
    readonly LEAVE_ROOM: "leave-room";
    readonly ROOM_STATE: "room-state";
    readonly PARTICIPANT_JOINED: "participant-joined";
    readonly PARTICIPANT_LEFT: "participant-left";
    readonly ROOM_FULL: "room-full";
    readonly ROOM_NOT_FOUND: "room-not-found";
    readonly ACCESS_DENIED: "access-denied";
    readonly RTC_OFFER: "rtc-offer";
    readonly RTC_ANSWER: "rtc-answer";
    readonly RTC_ICE_CANDIDATE: "rtc-ice-candidate";
    readonly MUTE_STATE_CHANGED: "mute-state-changed";
    readonly SPEAKING_STATE_CHANGED: "speaking-state-changed";
    readonly DEAFEN_STATE_CHANGED: "deafen-state-changed";
    readonly KICKED: "kicked";
    readonly USER_KICKED: "user-kicked";
    readonly ERROR: "error";
    readonly PING: "ping";
    readonly PONG: "pong";
};
type SocketEventName = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];
interface JoinRoomPayload {
    roomId: string;
    /** Required if room is private + password-protected */
    password?: string;
}
interface LeaveRoomPayload {
    roomId: string;
}
interface RoomStatePayload {
    roomId: string;
    participants: Participant[];
}
interface ParticipantJoinedPayload {
    roomId: string;
    participant: Participant;
}
interface ParticipantLeftPayload {
    roomId: string;
    userId: string;
    socketId: string;
}
interface RtcOfferPayload {
    roomId: string;
    targetSocketId: string;
    fromSocketId: string;
    fromUserId: string;
    sdp: RTCSessionDescriptionInit;
}
interface RtcAnswerPayload {
    roomId: string;
    targetSocketId: string;
    fromSocketId: string;
    fromUserId: string;
    sdp: RTCSessionDescriptionInit;
}
interface RtcIceCandidatePayload {
    roomId: string;
    targetSocketId: string;
    fromSocketId: string;
    candidate: RTCIceCandidateInit;
}
interface MuteStateChangedPayload {
    roomId: string;
    userId: string;
    socketId: string;
    isMuted: boolean;
}
interface SpeakingStateChangedPayload {
    roomId: string;
    userId: string;
    socketId: string;
    isSpeaking: boolean;
}
interface DeafenStateChangedPayload {
    roomId: string;
    userId: string;
    socketId: string;
    isDeafened: boolean;
}
interface KickedPayload {
    roomId: string;
    reason?: string;
}
interface ErrorPayload {
    code: string;
    message: string;
}

declare const RegisterSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    email: string;
    password: string;
}, {
    name: string;
    email: string;
    password: string;
}>;
declare const LoginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
declare const RefreshTokenSchema: z.ZodObject<{
    refreshToken: z.ZodString;
}, "strip", z.ZodTypeAny, {
    refreshToken: string;
}, {
    refreshToken: string;
}>;
declare const CreateRoomSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    isPrivate: z.ZodDefault<z.ZodBoolean>;
    password: z.ZodOptional<z.ZodString>;
    maxCapacity: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    isPrivate: boolean;
    maxCapacity: number;
    password?: string | undefined;
    description?: string | undefined;
}, {
    name: string;
    password?: string | undefined;
    description?: string | undefined;
    isPrivate?: boolean | undefined;
    maxCapacity?: number | undefined;
}>;
declare const UpdateRoomSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    isPrivate: z.ZodOptional<z.ZodBoolean>;
    password: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    maxCapacity: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    password?: string | null | undefined;
    description?: string | undefined;
    isPrivate?: boolean | undefined;
    maxCapacity?: number | undefined;
}, {
    name?: string | undefined;
    password?: string | null | undefined;
    description?: string | undefined;
    isPrivate?: boolean | undefined;
    maxCapacity?: number | undefined;
}>;
declare const JoinRoomIntentSchema: z.ZodObject<{
    password: z.ZodOptional<z.ZodString>;
    inviteCode: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    password?: string | undefined;
    inviteCode?: string | undefined;
}, {
    password?: string | undefined;
    inviteCode?: string | undefined;
}>;
declare const KickUserSchema: z.ZodObject<{
    userId: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    userId: string;
    reason?: string | undefined;
}, {
    userId: string;
    reason?: string | undefined;
}>;
declare const CreateInviteSchema: z.ZodObject<{
    maxUses: z.ZodOptional<z.ZodNumber>;
    expiresInHours: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    maxUses?: number | undefined;
    expiresInHours?: number | undefined;
}, {
    maxUses?: number | undefined;
    expiresInHours?: number | undefined;
}>;
declare const UpdateUserSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
}, {
    name?: string | undefined;
}>;
declare const JoinRoomSocketSchema: z.ZodObject<{
    roomId: z.ZodString;
    password: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    roomId: string;
    password?: string | undefined;
}, {
    roomId: string;
    password?: string | undefined;
}>;
declare const LeaveRoomSocketSchema: z.ZodObject<{
    roomId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    roomId: string;
}, {
    roomId: string;
}>;
declare const RtcOfferSocketSchema: z.ZodObject<{
    roomId: z.ZodString;
    targetSocketId: z.ZodString;
    sdp: z.ZodObject<{
        type: z.ZodEnum<["offer"]>;
        sdp: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "offer";
        sdp: string;
    }, {
        type: "offer";
        sdp: string;
    }>;
}, "strip", z.ZodTypeAny, {
    roomId: string;
    targetSocketId: string;
    sdp: {
        type: "offer";
        sdp: string;
    };
}, {
    roomId: string;
    targetSocketId: string;
    sdp: {
        type: "offer";
        sdp: string;
    };
}>;
declare const RtcAnswerSocketSchema: z.ZodObject<{
    roomId: z.ZodString;
    targetSocketId: z.ZodString;
    sdp: z.ZodObject<{
        type: z.ZodEnum<["answer"]>;
        sdp: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "answer";
        sdp: string;
    }, {
        type: "answer";
        sdp: string;
    }>;
}, "strip", z.ZodTypeAny, {
    roomId: string;
    targetSocketId: string;
    sdp: {
        type: "answer";
        sdp: string;
    };
}, {
    roomId: string;
    targetSocketId: string;
    sdp: {
        type: "answer";
        sdp: string;
    };
}>;
declare const RtcIceCandidateSocketSchema: z.ZodObject<{
    roomId: z.ZodString;
    targetSocketId: z.ZodString;
    candidate: z.ZodObject<{
        candidate: z.ZodString;
        sdpMid: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        sdpMLineIndex: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        usernameFragment: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        candidate: string;
        sdpMid?: string | null | undefined;
        sdpMLineIndex?: number | null | undefined;
        usernameFragment?: string | null | undefined;
    }, {
        candidate: string;
        sdpMid?: string | null | undefined;
        sdpMLineIndex?: number | null | undefined;
        usernameFragment?: string | null | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    roomId: string;
    targetSocketId: string;
    candidate: {
        candidate: string;
        sdpMid?: string | null | undefined;
        sdpMLineIndex?: number | null | undefined;
        usernameFragment?: string | null | undefined;
    };
}, {
    roomId: string;
    targetSocketId: string;
    candidate: {
        candidate: string;
        sdpMid?: string | null | undefined;
        sdpMLineIndex?: number | null | undefined;
        usernameFragment?: string | null | undefined;
    };
}>;
declare const MuteStateSocketSchema: z.ZodObject<{
    roomId: z.ZodString;
    isMuted: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    roomId: string;
    isMuted: boolean;
}, {
    roomId: string;
    isMuted: boolean;
}>;
declare const SpeakingStateSocketSchema: z.ZodObject<{
    roomId: z.ZodString;
    isSpeaking: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    roomId: string;
    isSpeaking: boolean;
}, {
    roomId: string;
    isSpeaking: boolean;
}>;
declare const DeafenStateSocketSchema: z.ZodObject<{
    roomId: z.ZodString;
    isDeafened: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    roomId: string;
    isDeafened: boolean;
}, {
    roomId: string;
    isDeafened: boolean;
}>;
type RegisterInput = z.infer<typeof RegisterSchema>;
type LoginInput = z.infer<typeof LoginSchema>;
type CreateRoomInput = z.infer<typeof CreateRoomSchema>;
type UpdateRoomInput = z.infer<typeof UpdateRoomSchema>;
type CreateInviteInput = z.infer<typeof CreateInviteSchema>;
type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

export { type ApiError, type ApiResponse, type ApiSuccess, type AuthResponse, type AuthTokens, type CreateInviteInput, CreateInviteSchema, type CreateRoomInput, CreateRoomSchema, type DeafenStateChangedPayload, DeafenStateSocketSchema, type ErrorPayload, type InvitePublic, JoinRoomIntentSchema, type JoinRoomPayload, JoinRoomSocketSchema, KickUserSchema, type KickedPayload, type LeaveRoomPayload, LeaveRoomSocketSchema, type LoginInput, LoginSchema, type MuteStateChangedPayload, MuteStateSocketSchema, type PaginatedResponse, type Participant, type ParticipantJoinedPayload, type ParticipantLeftPayload, RefreshTokenSchema, type RegisterInput, RegisterSchema, type RoomMemberPublic, type RoomPublic, type RoomStatePayload, type RtcAnswerPayload, RtcAnswerSocketSchema, type RtcIceCandidatePayload, RtcIceCandidateSocketSchema, type RtcOfferPayload, RtcOfferSocketSchema, SOCKET_EVENTS, type SocketEventName, type SpeakingStateChangedPayload, SpeakingStateSocketSchema, type UpdateRoomInput, UpdateRoomSchema, type UpdateUserInput, UpdateUserSchema, type UserPublic, type UserRole };
