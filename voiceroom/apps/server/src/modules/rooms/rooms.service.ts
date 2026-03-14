// apps/server/src/modules/rooms/rooms.service.ts
// Business logic: create room, join intent, kick, authorize
import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";
import type {
  CreateRoomInput,
  UpdateRoomInput,
  JoinRoomIntentInput,
  KickUserInput,
  CreateInviteInput,
} from "@voiceroom/shared";
import type { RoomPublic, RoomMemberPublic, PaginatedResponse } from "@voiceroom/shared";
import { RoomsRepository } from "./rooms.repository.js";
import { env } from "../../config/env.js";

class RoomError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
  }
}

export class RoomsService {
  private repo: RoomsRepository;

  constructor(private prisma: PrismaClient) {
    this.repo = new RoomsRepository(prisma);
  }

  async create(ownerId: string, input: CreateRoomInput): Promise<RoomPublic> {
    let passwordHash: string | null = null;
    if (input.password && input.password.length > 0) {
      passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    }

    const room = await this.repo.create({
      ...input,
      ownerId,
      passwordHash,
      maxCapacity: input.maxCapacity ?? env.DEFAULT_ROOM_MAX_CAPACITY,
    });

    await this.repo.addMember(room.id, ownerId, "owner");
    await this.prisma.auditLog.create({
      data: { userId: ownerId, action: "room.create", meta: { roomId: room.id, name: room.name } },
    });

    return this._toPublic(room);
  }

  async getById(roomId: string, userId?: string): Promise<RoomPublic | null> {
    const room = await this.repo.findById(roomId);
    if (!room) return null;
    if (room.isPrivate && userId) {
      const isMember = await this.repo.isMember(roomId, userId);
      if (!isMember) return null; // Don't leak private room existence
    }
    if (room.isPrivate && !userId) return null;
    return this._toPublic(room);
  }

  async listPublic(opts?: { page?: number; pageSize?: number }): Promise<PaginatedResponse<RoomPublic>> {
    const { items, total, page, pageSize, hasMore } = await this.repo.findManyPublic(opts);
    return {
      items: items.map((r) => this._toPublic(r)),
      total,
      page,
      pageSize,
      hasMore,
    };
  }

  async listForUser(userId: string, opts?: { page?: number; pageSize?: number }): Promise<PaginatedResponse<RoomPublic>> {
    const { items, total, page, pageSize, hasMore } = await this.repo.findManyForUser(userId, opts);
    return {
      items: items.map((r) => this._toPublic(r)),
      total,
      page,
      pageSize,
      hasMore,
    };
  }

  async update(roomId: string, userId: string, input: UpdateRoomInput): Promise<RoomPublic> {
    const member = await this.repo.getMember(roomId, userId);
    if (!member) throw new RoomError("Room not found or access denied", "ROOM_NOT_FOUND", 404);
    if (member.role !== "owner" && member.role !== "admin") {
      throw new RoomError("Only owner or admin can update room", "FORBIDDEN", 403);
    }

    let passwordHash: string | null | undefined = undefined;
    if (input.password !== undefined) {
      passwordHash = input.password ? await argon2.hash(input.password, { type: argon2.argon2id }) : null;
    }

    const room = await this.repo.update(roomId, { ...input, passwordHash });
    await this.prisma.auditLog.create({
      data: { userId, action: "room.update", meta: { roomId } },
    });
    return this._toPublic(room);
  }

  async delete(roomId: string, userId: string): Promise<void> {
    const member = await this.repo.getMember(roomId, userId);
    if (!member) throw new RoomError("Room not found or access denied", "ROOM_NOT_FOUND", 404);
    if (member.role !== "owner") throw new RoomError("Only owner can delete room", "FORBIDDEN", 403);

    await this.repo.delete(roomId);
    await this.prisma.auditLog.create({
      data: { userId, action: "room.delete", meta: { roomId } },
    });
  }

  /** Join intent: validates user can join (capacity, password, private/invite). Does NOT add to room yet — signaling does that when socket joins. */
  async joinIntent(
    roomId: string,
    userId: string,
    input?: JoinRoomIntentInput
  ): Promise<{ room: RoomPublic; member: RoomMemberPublic }> {
    const room = await this.repo.findById(roomId);
    if (!room) throw new RoomError("Room not found", "ROOM_NOT_FOUND", 404);

    const participantCount = room._count.members;
    if (participantCount >= room.maxCapacity) {
      throw new RoomError("Room is full", "ROOM_FULL", 403);
    }

    if (room.isPrivate) {
      const isMember = await this.repo.isMember(roomId, userId);
      if (!isMember) {
        // Check invite by code if provided
        const code = input?.inviteCode;
        if (code) {
          const invite = await this.repo.findInviteByCode(code);
          if (
            invite &&
            invite.roomId === roomId &&
            (invite.expiresAt == null || invite.expiresAt > new Date()) &&
            (invite.maxUses == null || invite.usedCount < invite.maxUses)
          ) {
            await this.repo.incrementInviteUsedCount(invite.id);
          } else {
            throw new RoomError("Invalid or expired invite", "INVALID_INVITE", 403);
          }
        } else {
          throw new RoomError("Private room: invite or membership required", "ACCESS_DENIED", 403);
        }
      }
    }

    if (room.passwordHash) {
      const password = input?.password ?? "";
      const valid = await argon2.verify(room.passwordHash, password);
      if (!valid) throw new RoomError("Invalid room password", "INVALID_PASSWORD", 403);
    }

    await this.repo.addMember(roomId, userId, "member");
    const member = await this.repo.getMember(roomId, userId);
    if (!member) throw new RoomError("Failed to add member", "INTERNAL_ERROR", 500);

    return {
      room: this._toPublic(room),
      member: {
        userId: member.userId,
        roomId: member.roomId,
        role: member.role as "owner" | "admin" | "member",
        joinedAt: member.joinedAt.toISOString(),
        user: {
          id: member.user.id,
          name: member.user.name,
          email: member.user.email,
          createdAt: member.user.createdAt.toISOString(),
        },
      },
    };
  }

  async kick(roomId: string, requesterId: string, input: KickUserInput): Promise<void> {
    const requester = await this.repo.getMember(roomId, requesterId);
    if (!requester) throw new RoomError("Room not found", "ROOM_NOT_FOUND", 404);
    if (requester.role !== "owner" && requester.role !== "admin") {
      throw new RoomError("Only owner or admin can kick", "FORBIDDEN", 403);
    }
    const target = await this.repo.getMember(roomId, input.userId);
    if (!target) throw new RoomError("User is not in this room", "USER_NOT_IN_ROOM", 404);
    if (target.role === "owner") throw new RoomError("Cannot kick owner", "FORBIDDEN", 403);
    if (requester.role === "admin" && target.role === "admin") {
      throw new RoomError("Admin cannot kick another admin", "FORBIDDEN", 403);
    }

    await this.repo.removeMember(roomId, input.userId);
    await this.prisma.auditLog.create({
      data: {
        userId: requesterId,
        action: "room.kick",
        meta: { roomId, kickedUserId: input.userId, reason: input.reason },
      },
    });
  }

  async createInvite(roomId: string, userId: string, input?: CreateInviteInput) {
    const member = await this.repo.getMember(roomId, userId);
    if (!member) throw new RoomError("Room not found", "ROOM_NOT_FOUND", 404);
    if (member.role !== "owner" && member.role !== "admin") {
      throw new RoomError("Only owner or admin can create invite", "FORBIDDEN", 403);
    }

    const expiresAt = input?.expiresInHours
      ? new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000)
      : null;
    const invite = await this.repo.createInvite(
      roomId,
      userId,
      input?.maxUses ?? null,
      input?.expiresInHours ?? null
    );
    return {
      id: invite.id,
      code: invite.code,
      roomId: invite.roomId,
      expiresAt: invite.expiresAt?.toISOString() ?? null,
      maxUses: invite.maxUses,
      usedCount: invite.usedCount,
    };
  }

  private _toPublic(room: {
    id: string;
    name: string;
    description: string | null;
    isPrivate: boolean;
    passwordHash: string | null;
    maxCapacity: number;
    ownerId: string;
    owner: { id: string; name: string };
    createdAt: Date;
    _count?: { members: number };
  }): RoomPublic {
    const participantCount = room._count?.members ?? 0;
    return {
      id: room.id,
      name: room.name,
      description: room.description ?? null,
      isPrivate: room.isPrivate,
      hasPassword: !!room.passwordHash,
      maxCapacity: room.maxCapacity,
      ownerId: room.ownerId,
      owner: room.owner,
      participantCount,
      createdAt: room.createdAt.toISOString(),
    };
  }
}
