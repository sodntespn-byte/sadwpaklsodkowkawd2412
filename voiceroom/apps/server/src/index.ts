// ============================================================
// apps/server/src/index.ts — Fastify server entry point
// ============================================================
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { Server as SocketIOServer } from "socket.io";
import { env } from "./config/env.js";
import { prismaPlugin } from "./plugins/prisma.plugin.js";
import { jwtPlugin } from "./plugins/jwt.plugin.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { roomRoutes } from "./modules/rooms/rooms.routes.js";
import { userRoutes } from "./modules/users/users.routes.js";
import { initSocketServer } from "./signaling/socket.server.js";
import { logger } from "./lib/logger.js";

async function bootstrap() {
  const fastify = Fastify({ loggerInstance: logger, disableRequestLogging: false });

  // ---- Security & Utility Plugins ----
  await fastify.register(helmet, {
    // CSP not needed for API-only server
    contentSecurityPolicy: false,
  });

  await fastify.register(cors, {
    origin: env.FRONTEND_URL,
    credentials: true,
  });

  await fastify.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
    errorResponseBuilder: (_req, context) => ({
      success: false,
      error: "Too many requests",
      code: "RATE_LIMIT_EXCEEDED",
      retryAfter: context.after,
    }),
  });

  // ---- App Plugins (Prisma, JWT) ----
  await fastify.register(prismaPlugin);
  await fastify.register(jwtPlugin);

  // ---- Health Check ----
  fastify.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

  // ---- HTTP Routes ----
  await fastify.register(authRoutes, { prefix: "/auth" });
  await fastify.register(roomRoutes, { prefix: "/rooms" });
  await fastify.register(userRoutes, { prefix: "/users" });

  // ---- HTTP Routes ----
  await fastify.register(authRoutes, { prefix: "/auth" });
  await fastify.register(roomRoutes, { prefix: "/rooms" });
  await fastify.register(userRoutes, { prefix: "/users" });

  try {
    await fastify.listen({ port: env.PORT, host: "0.0.0.0" });
    // Socket.IO attaches to the same HTTP server (created by Fastify on listen)
    const io = new SocketIOServer(fastify.server!, {
      cors: { origin: env.FRONTEND_URL, credentials: true },
      transports: ["websocket", "polling"],
      pingTimeout: 20000,
      pingInterval: 10000,
    });
    fastify.decorate("io", io);
    initSocketServer(io, fastify.prisma, logger);
    logger.info({ port: env.PORT }, "VoiceRoom server is running");
  } catch (err) {
    logger.error(err, "Failed to start server");
    process.exit(1);
  }

  // ---- Graceful Shutdown ----
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down gracefully...");
    await fastify.close();
    await fastify.prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

bootstrap();
