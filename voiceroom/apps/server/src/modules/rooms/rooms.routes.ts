// apps/server/src/modules/rooms/rooms.routes.ts
import { FastifyPluginAsync } from "fastify";
import {
  CreateRoomSchema,
  UpdateRoomSchema,
  JoinRoomIntentSchema,
  KickUserSchema,
  CreateInviteSchema,
} from "@voiceroom/shared";
import { RoomsService } from "./rooms.service.js";

export const roomRoutes: FastifyPluginAsync = async (fastify) => {
  const roomsService = new RoomsService(fastify.prisma);

  // GET /rooms — list public rooms (optional auth to also see own private)
  fastify.get("/", async (req, reply) => {
    const page = Number((req.query as any).page) || 1;
    const pageSize = Math.min(Number((req.query as any).pageSize) || 20, 50);

    try {
      const data = await roomsService.listPublic({ page, pageSize });
      return reply.code(200).send({ success: true, data });
    } catch (err: any) {
      return reply.code(err.statusCode || 500).send({
        success: false,
        error: err.message,
        code: err.code || "LIST_ROOMS_ERROR",
      });
    }
  });

  // GET /rooms/my — list rooms the user is member of (requires auth)
  fastify.get("/my", { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const userId = req.user.sub;
    const page = Number((req.query as any).page) || 1;
    const pageSize = Math.min(Number((req.query as any).pageSize) || 20, 50);

    try {
      const data = await roomsService.listForUser(userId, { page, pageSize });
      return reply.code(200).send({ success: true, data });
    } catch (err: any) {
      return reply.code(err.statusCode || 500).send({
        success: false,
        error: err.message,
        code: err.code || "LIST_MY_ROOMS_ERROR",
      });
    }
  });

  // POST /rooms — create room (requires auth)
  fastify.post("/", { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const parsed = CreateRoomSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(422).send({
        success: false,
        error: "Validation error",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const room = await roomsService.create(req.user.sub, parsed.data);
      return reply.code(201).send({ success: true, data: room });
    } catch (err: any) {
      return reply.code(err.statusCode || 400).send({
        success: false,
        error: err.message,
        code: err.code || "CREATE_ROOM_ERROR",
      });
    }
  });

  // GET /rooms/:id — get room by id (optional auth; private rooms require auth + membership)
  fastify.get("/:id", { preHandler: [fastify.optionalAuthenticate] }, async (req, reply) => {
    const roomId = (req.params as { id: string }).id;
    const userId = (req as any).user?.sub;

    try {
      const room = await roomsService.getById(roomId, userId);
      if (!room) return reply.code(404).send({ success: false, error: "Room not found", code: "ROOM_NOT_FOUND" });
      return reply.code(200).send({ success: true, data: room });
    } catch (err: any) {
      return reply.code(err.statusCode || 500).send({
        success: false,
        error: err.message,
        code: err.code || "GET_ROOM_ERROR",
      });
    }
  });

  // PATCH /rooms/:id — update room (owner/admin)
  fastify.patch("/:id", { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const roomId = (req.params as { id: string }).id;
    const parsed = UpdateRoomSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(422).send({
        success: false,
        error: "Validation error",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const room = await roomsService.update(roomId, req.user.sub, parsed.data);
      return reply.code(200).send({ success: true, data: room });
    } catch (err: any) {
      return reply.code(err.statusCode || 400).send({
        success: false,
        error: err.message,
        code: err.code || "UPDATE_ROOM_ERROR",
      });
    }
  });

  // DELETE /rooms/:id — delete room (owner only)
  fastify.delete("/:id", { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const roomId = (req.params as { id: string }).id;

    try {
      await roomsService.delete(roomId, req.user.sub);
      return reply.code(204).send();
    } catch (err: any) {
      return reply.code(err.statusCode || 400).send({
        success: false,
        error: err.message,
        code: err.code || "DELETE_ROOM_ERROR",
      });
    }
  });

  // POST /rooms/:id/join-intent — validate join (password, invite, capacity). Returns room + member.
  fastify.post("/:id/join-intent", { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const roomId = (req.params as { id: string }).id;
    const parsed = JoinRoomIntentSchema.safeParse(req.body || {});

    if (!parsed.success) {
      return reply.code(422).send({
        success: false,
        error: "Validation error",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const result = await roomsService.joinIntent(roomId, req.user.sub, parsed.data);
      return reply.code(200).send({ success: true, data: result });
    } catch (err: any) {
      return reply.code(err.statusCode || 403).send({
        success: false,
        error: err.message,
        code: err.code || "JOIN_INTENT_ERROR",
      });
    }
  });

  // POST /rooms/:id/invite — create invite (owner/admin)
  fastify.post("/:id/invite", { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const roomId = (req.params as { id: string }).id;
    const parsed = CreateInviteSchema.safeParse(req.body || {});

    if (!parsed.success) {
      return reply.code(422).send({
        success: false,
        error: "Validation error",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const invite = await roomsService.createInvite(roomId, req.user.sub, parsed.data);
      return reply.code(201).send({ success: true, data: invite });
    } catch (err: any) {
      return reply.code(err.statusCode || 400).send({
        success: false,
        error: err.message,
        code: err.code || "CREATE_INVITE_ERROR",
      });
    }
  });

  // POST /rooms/:id/kick — kick user (owner/admin)
  fastify.post("/:id/kick", { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const roomId = (req.params as { id: string }).id;
    const parsed = KickUserSchema.safeParse(req.body);

    if (!parsed.success) {
      return reply.code(422).send({
        success: false,
        error: "Validation error",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      await roomsService.kick(roomId, req.user.sub, parsed.data);
      return reply.code(204).send();
    } catch (err: any) {
      return reply.code(err.statusCode || 400).send({
        success: false,
        error: err.message,
        code: err.code || "KICK_ERROR",
      });
    }
  });
};
