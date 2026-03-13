// ============================================================
// packages/shared/src/types.ts
// Core domain types shared between frontend and backend
// ============================================================

export type UserRole = "owner" | "admin" | "member";

export interface UserPublic {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface RoomPublic {
  id: string;
  name: string;
  description: string | null;
  isPrivate: boolean;
  hasPassword: boolean;
  maxCapacity: number;
  ownerId: string;
  owner: { id: string; name: string };
  participantCount: number;
  createdAt: string;
}

export interface RoomMemberPublic {
  userId: string;
  roomId: string;
  role: UserRole;
  joinedAt: string;
  user: UserPublic;
}

/** Represents a participant currently in a voice room (in-memory / real-time) */
export interface Participant {
  userId: string;
  socketId: string;
  name: string;
  isMuted: boolean;
  isSpeaking: boolean;
  /** Whether the user has muted their own incoming audio (local deafen) */
  isDeafened: boolean;
  joinedAt: number; // unix timestamp ms
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: UserPublic;
  tokens: AuthTokens;
}

// ---- HTTP API response wrappers ----

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ---- Pagination ----
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ---- Invite ----
export interface InvitePublic {
  id: string;
  code: string;
  roomId: string;
  expiresAt: string | null;
  maxUses: number | null;
  usedCount: number;
}
