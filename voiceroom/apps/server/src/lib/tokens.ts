// apps/server/src/lib/tokens.ts
// Refresh token helpers — generate, store, verify, rotate
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";

/**
 * Signs an access JWT.
 * Short-lived (15m by default) — stored only in memory on the client.
 */
export function signAccessToken(payload: { sub: string; email: string; name: string }): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRES_IN });
}

/**
 * Signs a refresh token opaque value (UUID).
 * The actual expiry is tracked in the DB, not in the token itself.
 * This lets us revoke tokens server-side.
 */
export function generateRefreshTokenValue(): string {
  return uuidv4();
}

/**
 * Persists a refresh token record in the database.
 */
export async function storeRefreshToken(
  prisma: PrismaClient,
  userId: string,
  tokenValue: string
): Promise<void> {
  const expiresAt = new Date();
  // default 7 days — parse from env string like "7d"
  const days = parseInt(env.JWT_REFRESH_EXPIRES_IN.replace("d", ""), 10) || 7;
  expiresAt.setDate(expiresAt.getDate() + days);

  await prisma.refreshToken.create({
    data: { token: tokenValue, userId, expiresAt },
  });
}

/**
 * Validates a refresh token from the DB.
 * Returns the userId if valid, throws on invalid/expired/revoked.
 */
export async function validateRefreshToken(
  prisma: PrismaClient,
  tokenValue: string
): Promise<string> {
  const record = await prisma.refreshToken.findUnique({ where: { token: tokenValue } });

  if (!record) throw new Error("Refresh token not found");
  if (record.revokedAt) throw new Error("Refresh token revoked");
  if (record.expiresAt < new Date()) throw new Error("Refresh token expired");

  return record.userId;
}

/**
 * Rotates a refresh token: revokes the old one, issues a new one.
 * This is a security best practice — single-use refresh tokens.
 */
export async function rotateRefreshToken(
  prisma: PrismaClient,
  oldTokenValue: string,
  userId: string
): Promise<string> {
  // Revoke the old token
  await prisma.refreshToken.update({
    where: { token: oldTokenValue },
    data: { revokedAt: new Date() },
  });

  // Issue new token
  const newToken = generateRefreshTokenValue();
  await storeRefreshToken(prisma, userId, newToken);
  return newToken;
}

/**
 * Revokes all refresh tokens for a user (logout).
 */
export async function revokeAllUserTokens(prisma: PrismaClient, userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
