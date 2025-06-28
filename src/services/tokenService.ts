import jwt from "jsonwebtoken";
import crypto from "crypto";
import { User } from "../models/User";

export interface TokenPayload {
  userId: string;
  email: string;
  role?: string;
  type?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface DecodedToken extends TokenPayload {
  iat: number;
  exp: number;
}

class TokenService {
  private readonly ACCESS_TOKEN_EXPIRY = "15m";
  private readonly REFRESH_TOKEN_EXPIRY = "7d";
  private readonly PASSWORD_RESET_EXPIRY = "1h";
  private readonly EMAIL_VERIFICATION_EXPIRY = "24h";

  // Generate access token
  generateAccessToken(payload: TokenPayload): string {
    const tokenPayload = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role || "user",
      type: "access",
    };

    return jwt.sign(tokenPayload, process.env.JWT_SECRET!, {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
      issuer: process.env.APP_NAME || "apollo-api",
      audience: process.env.CLIENT_URL || "http://localhost:3000",
    });
  }

  // Generate refresh token
  generateRefreshToken(payload: TokenPayload): string {
    const tokenPayload = {
      userId: payload.userId,
      email: payload.email,
      type: "refresh",
      jti: crypto.randomUUID(), // Unique token ID for revocation
    };

    return jwt.sign(tokenPayload, process.env.JWT_REFRESH_SECRET!, {
      expiresIn: this.REFRESH_TOKEN_EXPIRY,
      issuer: process.env.APP_NAME || "apollo-api",
      audience: process.env.CLIENT_URL || "http://localhost:3000",
    });
  }

  // Generate token pair
  generateTokenPair(payload: TokenPayload): TokenPair {
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
    };
  }

  // Verify access token
  verifyAccessToken(token: string): DecodedToken {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!, {
        issuer: process.env.APP_NAME || "apollo-api",
        audience: process.env.CLIENT_URL || "http://localhost:3000",
      }) as DecodedToken;

      if (decoded.type !== "access") {
        throw new Error("Invalid token type");
      }

      return decoded;
    } catch (error) {
      throw new Error("Invalid access token");
    }
  }

  // Verify refresh token
  verifyRefreshToken(token: string): DecodedToken {
    try {
      const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET!, {
        issuer: process.env.APP_NAME || "apollo-api",
        audience: process.env.CLIENT_URL || "http://localhost:3000",
      }) as DecodedToken;

      if (decoded.type !== "refresh") {
        throw new Error("Invalid token type");
      }

      return decoded;
    } catch (error) {
      throw new Error("Invalid refresh token");
    }
  }

  // Generate password reset token
  generatePasswordResetToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  // Generate email verification token
  generateEmailVerificationToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  // Generate temporary access token for password reset
  generatePasswordResetJWT(userId: string, email: string): string {
    const payload = {
      userId,
      email,
      type: "password_reset",
    };

    return jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: this.PASSWORD_RESET_EXPIRY,
      issuer: process.env.APP_NAME || "apollo-api",
    });
  }

  // Verify password reset JWT
  verifyPasswordResetJWT(token: string): DecodedToken {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!, {
        issuer: process.env.APP_NAME || "apollo-api",
      }) as DecodedToken;

      if (decoded.type !== "password_reset") {
        throw new Error("Invalid token type");
      }

      return decoded;
    } catch (error) {
      throw new Error("Invalid password reset token");
    }
  }

  // Generate email verification JWT
  generateEmailVerificationJWT(userId: string, email: string): string {
    const payload = {
      userId,
      email,
      type: "email_verification",
    };

    return jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: this.EMAIL_VERIFICATION_EXPIRY,
      issuer: process.env.APP_NAME || "apollo-api",
    });
  }

  // Verify email verification JWT
  verifyEmailVerificationJWT(token: string): DecodedToken {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!, {
        issuer: process.env.APP_NAME || "apollo-api",
      }) as DecodedToken;

      if (decoded.type !== "email_verification") {
        throw new Error("Invalid token type");
      }

      return decoded;
    } catch (error) {
      throw new Error("Invalid email verification token");
    }
  }

  // Refresh access token using refresh token
  async refreshAccessToken(
    refreshToken: string
  ): Promise<{ accessToken: string }> {
    // Verify refresh token
    const decoded = this.verifyRefreshToken(refreshToken);

    // Check if user exists and refresh token matches
    const user = await User.findById(decoded.userId);
    if (!user || user.refreshToken !== refreshToken) {
      throw new Error("Invalid refresh token");
    }

    // Check if account is locked
    // if (user.accountLocked) {
    //   throw new Error('Account is locked');
    // }

    // Generate new access token
    const accessToken = this.generateAccessToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    return { accessToken };
  }

  // Revoke refresh token
  async revokeRefreshToken(userId: string): Promise<void> {
    await User.findByIdAndUpdate(userId, {
      $unset: { refreshToken: 1 },
    });
  }

  // Revoke all user sessions
  async revokeAllUserTokens(userId: string): Promise<void> {
    await User.findByIdAndUpdate(userId, {
      $unset: { refreshToken: 1 },
      tokenVersion: { $inc: 1 }, // Increment version to invalidate all tokens
    });
  }

  // Extract token from Authorization header
  extractTokenFromHeader(
    authHeader: string | undefined
  ): string | null | undefined {
    if (!authHeader) return null;

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return null;
    }

    return parts[1];
  }

  // Get token expiration time
  getTokenExpiration(token: string): Date | null {
    try {
      const decoded = jwt.decode(token) as any;
      if (!decoded || !decoded.exp) return null;

      return new Date(decoded.exp * 1000);
    } catch (error) {
      return null;
    }
  }

  // Check if token is expired
  isTokenExpired(token: string): boolean {
    const expiration = this.getTokenExpiration(token);
    if (!expiration) return true;

    return expiration.getTime() < Date.now();
  }

  // Generate API key for external integrations
  generateApiKey(userId: string, name: string): string {
    const payload = {
      userId,
      name,
      type: "api_key",
      created: Date.now(),
    };

    return jwt.sign(payload, process.env.JWT_SECRET!, {
      issuer: process.env.APP_NAME || "apollo-api",
      // API keys don't expire unless explicitly revoked
    });
  }

  // Verify API key
  verifyApiKey(apiKey: string): DecodedToken {
    try {
      const decoded = jwt.verify(apiKey, process.env.JWT_SECRET!, {
        issuer: process.env.APP_NAME || "apollo-api",
      }) as DecodedToken;

      if (decoded.type !== "api_key") {
        throw new Error("Invalid token type");
      }

      return decoded;
    } catch (error) {
      throw new Error("Invalid API key");
    }
  }

  // Generate secure random token
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString("hex");
  }

  // Hash token for database storage
  hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  // Compare token with hash
  compareTokenHash(token: string, hash: string): boolean {
    const tokenHash = this.hashToken(token);
    return crypto.timingSafeEqual(
      Buffer.from(tokenHash, "hex"),
      Buffer.from(hash, "hex")
    );
  }
}

export const tokenService = new TokenService();
