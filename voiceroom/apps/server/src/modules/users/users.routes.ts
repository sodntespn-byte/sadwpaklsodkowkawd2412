// apps/server/src/modules/users/users.routes.ts
import { FastifyPluginAsync } from "fastify";
import { UpdateUserSchema } from "@voiceroom/shared";
import { AuthService } from "../auth/auth.service.js";

export const userRoutes: FastifyPluginAsync = async (fastify) => {
  const authService = new AuthService(fastify.prisma, fastify);

  // GET /users/me — current user (requires auth)
  fastify.get("/me", { preHandler: [fastify.authenticate] }, async (req, reply) => {
    try {
      const user = await authService.me(req.user.sub);
      return reply.code(200).send({ success: true, data: user });
    } catch (err: any) {
      return reply.code(err.statusCode || 404).send({
        success: false,
        error: err.message,
        code: err.code || "USER_NOT_FOUND",
      });
    }
  });

  // PATCH /users/me — update current user (requires auth)
  fastify.patch("/me", { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const parsed = UpdateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(422).send({
        success: false,
        error: "Validation error",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const user = await fastify.prisma.user.update({
        where: { id: req.user.sub },
        data: { name: parsed.data.name },
      });
      return reply.code(200).send({
        success: true,
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt.toISOString(),
        },
      });
    } catch (err: any) {
      return reply.code(err.statusCode || 400).send({
        success: false,
        error: err.message,
        code: err.code || "UPDATE_USER_ERROR",
      });
    }
  });
};
