// apps/server/src/modules/auth/auth.routes.ts
import { FastifyPluginAsync } from "fastify";
import { RegisterSchema, LoginSchema, RefreshTokenSchema } from "@voiceroom/shared";
import { AuthService } from "./auth.service.js";

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const authService = new AuthService(fastify.prisma, fastify);

  // POST /auth/register
  fastify.post("/register", async (req, reply) => {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(422).send({
        success: false,
        error: "Validation error",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const result = await authService.register(parsed.data);
      return reply.code(201).send({ success: true, data: result });
    } catch (err: any) {
      return reply.code(err.statusCode || 400).send({
        success: false,
        error: err.message,
        code: err.code || "REGISTER_ERROR",
      });
    }
  });

  // POST /auth/login
  fastify.post("/login", async (req, reply) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(422).send({
        success: false,
        error: "Validation error",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const result = await authService.login(parsed.data);
      return reply.code(200).send({ success: true, data: result });
    } catch (err: any) {
      return reply.code(err.statusCode || 400).send({
        success: false,
        error: err.message,
        code: err.code || "LOGIN_ERROR",
      });
    }
  });

  // POST /auth/refresh
  fastify.post("/refresh", async (req, reply) => {
    const parsed = RefreshTokenSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(422).send({
        success: false,
        error: "Validation error",
        code: "VALIDATION_ERROR",
      });
    }

    try {
      const tokens = await authService.refresh(parsed.data.refreshToken);
      return reply.code(200).send({ success: true, data: tokens });
    } catch (err: any) {
      return reply.code(err.statusCode || 401).send({
        success: false,
        error: err.message,
        code: err.code || "REFRESH_ERROR",
      });
    }
  });

  // POST /auth/logout  (requires auth)
  fastify.post("/logout", { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const userId = req.user.sub;
    await authService.logout(userId);
    return reply.code(200).send({ success: true, data: { message: "Logged out successfully" } });
  });

  // GET /auth/me  (requires auth)
  fastify.get("/me", { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const user = await authService.me(req.user.sub);
    return reply.code(200).send({ success: true, data: user });
  });
};
