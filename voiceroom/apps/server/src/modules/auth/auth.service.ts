// apps/server/src/modules/auth/auth.service.ts
import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import type { RegisterInput, LoginInput } from "@voiceroom/shared";
import {
  signAccessToken,
  generateRefreshTokenValue,
  storeRefreshToken,
  validateRefreshToken,
  rotateRefreshToken,
  revokeAllUserTokens,
} from "../../lib/tokens.js";
import type { UserPublic, AuthTokens } from "@voiceroom/shared";

class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
  }
}

export class AuthService {
  constructor(
    private prisma: PrismaClient,
    private fastify: FastifyInstance
  ) {}

  async register(input: RegisterInput): Promise<{ user: UserPublic; tokens: AuthTokens }> {
    // Check if email is already taken
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new AuthError("Email already registered", "EMAIL_TAKEN", 409);
    }

    // Hash password with argon2id (recommended variant)
    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MiB
      timeCost: 3,
      parallelism: 1,
    });

    const user = await this.prisma.user.create({
      data: { name: input.name, email: input.email, passwordHash },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: { userId: user.id, action: "user.register", meta: { email: input.email } },
    });

    const tokens = await this._issueTokens(user);
    return { user: this._toPublic(user), tokens };
  }

  async login(input: LoginInput): Promise<{ user: UserPublic; tokens: AuthTokens }> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });

    // Use constant-time comparison to prevent timing attacks
    const valid = user ? await argon2.verify(user.passwordHash, input.password) : false;

    if (!user || !valid) {
      // Generic error to prevent email enumeration
      throw new AuthError("Invalid email or password", "INVALID_CREDENTIALS", 401);
    }

    await this.prisma.auditLog.create({
      data: { userId: user.id, action: "user.login", meta: { email: input.email } },
    });

    const tokens = await this._issueTokens(user);
    return { user: this._toPublic(user), tokens };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let userId: string;
    try {
      userId = await validateRefreshToken(this.prisma, refreshToken);
    } catch (err) {
      throw new AuthError("Invalid or expired refresh token", "INVALID_REFRESH_TOKEN", 401);
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AuthError("User not found", "USER_NOT_FOUND", 401);

    // Rotate refresh token (single-use pattern)
    const newRefreshToken = await rotateRefreshToken(this.prisma, refreshToken, userId);
    const accessToken = signAccessToken({ sub: user.id, email: user.email, name: user.name });

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(userId: string): Promise<void> {
    await revokeAllUserTokens(this.prisma, userId);
    await this.prisma.auditLog.create({
      data: { userId, action: "user.logout" },
    });
  }

  async me(userId: string): Promise<UserPublic> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AuthError("User not found", "USER_NOT_FOUND", 404);
    return this._toPublic(user);
  }

  private async _issueTokens(user: { id: string; email: string; name: string }): Promise<AuthTokens> {
    const accessToken = signAccessToken({ sub: user.id, email: user.email, name: user.name });
    const refreshTokenValue = generateRefreshTokenValue();
    await storeRefreshToken(this.prisma, user.id, refreshTokenValue);
    return { accessToken, refreshToken: refreshTokenValue };
  }

  private _toPublic(user: { id: string; name: string; email: string; createdAt: Date }): UserPublic {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
