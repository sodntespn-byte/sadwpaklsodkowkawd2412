// apps/server/src/plugins/jwt.plugin.ts
// Registers @fastify/jwt and exposes sign/verify helpers
import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { env } from "../config/env.js";

export interface JwtAccessPayload {
  sub: string; // userId
  email: string;
  name: string;
  iat?: number;
  exp?: number;
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    optionalAuthenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtAccessPayload;
    user: JwtAccessPayload;
  }
}

const jwtPlugin: FastifyPluginAsync = fp(async (fastify) => {
  fastify.register(fastifyJwt, {
    secret: env.JWT_ACCESS_SECRET,
    sign: { expiresIn: env.JWT_ACCESS_EXPIRES_IN },
  });

  // Prebuilt authenticate hook for protected routes
  fastify.decorate("authenticate", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      reply.code(401).send({ success: false, error: "Unauthorized", code: "INVALID_TOKEN" });
    }
  });

  // Optional auth: set req.user if valid token present, never 401
  fastify.decorate("optionalAuthenticate", async (req: FastifyRequest, _reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      // Leave req.user undefined
    }
  });
});

export { jwtPlugin };
