// apps/server/src/modules/rooms/rooms.repository.ts
// Data access for Room, RoomMember, Invite
import { PrismaClient } from "@prisma/client";
import type { CreateRoomInput, UpdateRoomInput } from "@voiceroom/shared";

export class RoomsRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateRoomInput & { ownerId: string; passwordHash?: string | null }) {
    return this.prisma.room.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        isPrivate: data.isPrivate ?? false,
        passwordHash: data.passwordHash ?? null,
        maxCapacity: data.maxCapacity ?? 10,
        ownerId: data.ownerId,
      },
      include: { owner: { select: { id: true, name: true } } },
    });
  }

  async findById(id: string) {
    return this.prisma.room.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true } },
        _count: { select: { members: true } },
      },
    });
  }

  async findManyPublic(opts?: { page?: number; pageSize?: number }) {
    const page = opts?.page ?? 1;
    const pageSize = Math.min(opts?.pageSize ?? 20, 50);
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      this.prisma.room.findMany({
        where: { isPrivate: false },
        skip,
        take: pageSize,
        orderBy: { updatedAt: "desc" },
        include: {
          owner: { select: { id: true, name: true } },
          _count: { select: { members: true } },
        },
      }),
      this.prisma.room.count({ where: { isPrivate: false } }),
    ]);

    return { items, total, page, pageSize, hasMore: skip + items.length < total };
  }

  async findManyForUser(userId: string, opts?: { page?: number; pageSize?: number }) {
    const page = opts?.page ?? 1;
    const pageSize = Math.min(opts?.pageSize ?? 20, 50);
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      this.prisma.room.findMany({
        where: { members: { some: { userId } } },
        skip,
        take: pageSize,
        orderBy: { updatedAt: "desc" },
        include: {
          owner: { select: { id: true, name: true } },
          _count: { select: { members: true } },
        },
      }),
      this.prisma.room.count({ where: { members: { some: { userId } } } }),
    ]);

    return { items, total, page, pageSize, hasMore: skip + items.length < total };
  }

  async update(id: string, data: UpdateRoomInput & { passwordHash?: string | null }) {
    return this.prisma.room.update({
      where: { id },
      data: {
        ...(data.name != null && { name: data.name }),
        ...(data.description !== undefined && { description: data.description ?? null }),
        ...(data.isPrivate !== undefined && { isPrivate: data.isPrivate }),
        ...(data.passwordHash !== undefined && { passwordHash: data.passwordHash }),
        ...(data.maxCapacity != null && { maxCapacity: data.maxCapacity }),
      },
      include: { owner: { select: { id: true, name: true } } },
    });
  }

  async delete(id: string) {
    return this.prisma.room.delete({ where: { id } });
  }

  async addMember(roomId: string, userId: string, role: string = "member") {
    return this.prisma.roomMember.upsert({
      where: { userId_roomId: { userId, roomId } },
      create: { roomId, userId, role },
      update: { role },
    });
  }

  async removeMember(roomId: string, userId: string) {
    return this.prisma.roomMember.deleteMany({ where: { roomId, userId } });
  }

  async getMember(roomId: string, userId: string) {
    return this.prisma.roomMember.findUnique({
      where: { userId_roomId: { userId, roomId } },
      include: { user: true },
    });
  }

  async isMember(roomId: string, userId: string) {
    const m = await this.prisma.roomMember.findUnique({
      where: { userId_roomId: { userId, roomId } },
    });
    return !!m;
  }

  async createInvite(roomId: string, createdById: string, maxUses?: number | null, expiresInHours?: number | null) {
    const code = `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const expiresAt = expiresInHours
      ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
      : null;
    return this.prisma.invite.create({
      data: { roomId, createdById, code, maxUses: maxUses ?? null, expiresAt },
      include: { room: { select: { id: true, name: true } } },
    });
  }

  async findInviteByCode(code: string) {
    return this.prisma.invite.findUnique({
      where: { code },
      include: { room: true },
    });
  }

  async incrementInviteUsedCount(id: string) {
    return this.prisma.invite.update({
      where: { id },
      data: { usedCount: { increment: 1 } },
    });
  }
}
